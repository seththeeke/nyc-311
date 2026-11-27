-- `dispatch_efficiency_daily` warehouse job — 20-ml-driver-assignment.md §2 (Leg 0c).
-- Applied by hand as a warehouse job in Test, then Prod (identical SQL), like v1-wbr.sql.
-- One row per UTC day, trailing 42 days. Every value is a varchar (job results are
-- stored as strings). Rendered on /data by GenericResultTable.
--
-- Rules this follows:
-- * order_events / operator_events are deduped on (id, sequence_number) first.
-- * Fleet time is #213's classification (v1-wbr.sql): an interval runs from an
--   operator event to its next one (or now), classed by its opening event;
--   OPERATOR_REMOVED intervals are excluded. Intervals are split at UTC midnight.
-- * dispatch_policy: the policy stamped on the day's TRANSIT_STARTED events (§2.4).
--   UNSTAMPED = before the stamps existed (all C); MIXED = the flag changed that day.
-- * Waiting order at time t: accepted before t, and its first ORDER_SCHEDULED is
--   after t (or hasn't happened).
-- * Distances use pathPlanningService's flat-earth miles (69 mi per degree of
--   latitude, longitude scaled by cos(40.7128)).
-- * Long jobs (the job-mix guardrail): descriptors whose expected work is >= 90 min
--   (Cave-in, Rough/Pitted/Cracked Roads, Crash Cushion Defect, Guard Rail - Street).
WITH
params AS (
  SELECT
    date_add('day', -41, current_date) AS first_day,
    69.0 AS lat_miles,
    69.0 * cos(radians(40.7128)) AS lng_miles
),
days AS (
  SELECT d AS day
  FROM params
  CROSS JOIN UNNEST(sequence(params.first_day, current_date, INTERVAL '1' DAY)) AS t (d)
),
oe AS (
  SELECT DISTINCT order_id, sequence_number, event_type, occurred_at, payload
  FROM order_events
),
op AS (
  SELECT DISTINCT operator_id, sequence_number, event_type, occurred_at, payload
  FROM operator_events
),
operator_latest AS (
  SELECT operator_id, rate_per_hour
  FROM (
    SELECT operator_id, rate_per_hour,
      ROW_NUMBER() OVER (PARTITION BY operator_id ORDER BY last_event_sequence DESC, warehouse_ingested_at DESC) AS rn
    FROM operator_snapshots
  ) t
  WHERE rn = 1
),
order_latest AS (
  SELECT order_id, location_id, sla_deadline, request_id
  FROM (
    SELECT order_id, location_id, sla_deadline, request_id,
      ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY last_event_sequence DESC, warehouse_ingested_at DESC) AS rn
    FROM order_snapshots
  ) t
  WHERE rn = 1
),
location_latest AS (
  SELECT location_id, try_cast(latitude AS double) AS lat, try_cast(longitude AS double) AS lng
  FROM (
    SELECT location_id, latitude, longitude,
      ROW_NUMBER() OVER (PARTITION BY location_id ORDER BY warehouse_ingested_at DESC) AS rn
    FROM locations
  ) t
  WHERE rn = 1
),
request_latest AS (
  SELECT request_id, descriptor
  FROM (
    SELECT request_id, descriptor,
      ROW_NUMBER() OVER (PARTITION BY request_id ORDER BY warehouse_ingested_at DESC) AS rn
    FROM requests
  ) t
  WHERE rn = 1
),
-- Order lifecycle: first accept, first schedule, first resolve.
order_times AS (
  SELECT
    order_id,
    MIN(CASE WHEN event_type = 'ORDER_ACCEPTED' THEN from_iso8601_timestamp(occurred_at) END) AS accepted_at,
    MIN(CASE WHEN event_type = 'ORDER_SCHEDULED' THEN from_iso8601_timestamp(occurred_at) END) AS first_scheduled_at,
    MIN(CASE WHEN event_type = 'ORDER_RESOLVED' THEN from_iso8601_timestamp(occurred_at) END) AS resolved_at
  FROM oe
  GROUP BY order_id
),
accepted_orders AS (
  SELECT ot.*, ol.sla_deadline, rq.descriptor
  FROM order_times ot
  LEFT JOIN order_latest ol ON ol.order_id = ot.order_id
  LEFT JOIN request_latest rq ON rq.request_id = ol.request_id
  WHERE ot.accepted_at IS NOT NULL
),
-- Operator events with their neighbours.
op_seq AS (
  SELECT
    operator_id, sequence_number, event_type, payload,
    from_iso8601_timestamp(occurred_at) AS at,
    LEAD(from_iso8601_timestamp(occurred_at)) OVER w AS next_at,
    LEAD(event_type) OVER w AS next_event_type,
    LEAD(payload) OVER w AS next_payload,
    LAG(from_iso8601_timestamp(occurred_at)) OVER w AS prev_at
  FROM op
  WINDOW w AS (PARTITION BY operator_id ORDER BY sequence_number)
),
intervals AS (
  SELECT
    s.operator_id,
    CASE s.event_type
      WHEN 'TRANSIT_STARTED' THEN 'TRANSIT'
      WHEN 'WORK_STARTED' THEN 'WORKING'
      WHEN 'OPERATOR_REMOVED' THEN NULL
      ELSE 'IDLE'
    END AS activity,
    s.at AS started_at,
    COALESCE(s.next_at, current_timestamp) AS ended_at,
    r.rate_per_hour
  FROM op_seq s
  JOIN operator_latest r ON r.operator_id = s.operator_id
),
day_slices AS (
  SELECT
    d.day,
    i.operator_id,
    i.activity,
    i.started_at,
    i.rate_per_hour,
    (to_unixtime(LEAST(i.ended_at, with_timezone(CAST(d.day AS timestamp), 'UTC') + INTERVAL '1' DAY))
      - to_unixtime(GREATEST(i.started_at, with_timezone(CAST(d.day AS timestamp), 'UTC')))) / 3600.0 AS hours
  FROM intervals i
  JOIN days d
    ON i.started_at < with_timezone(CAST(d.day AS timestamp), 'UTC') + INTERVAL '1' DAY
   AND i.ended_at > with_timezone(CAST(d.day AS timestamp), 'UTC')
  WHERE i.activity IS NOT NULL
),
fleet_daily AS (
  SELECT
    day,
    SUM(hours) AS paid_hours,
    SUM(CASE WHEN activity = 'WORKING' THEN hours ELSE 0 END) AS working_hours,
    SUM(CASE WHEN activity = 'TRANSIT' THEN hours ELSE 0 END) AS transit_hours,
    SUM(CASE WHEN activity = 'IDLE' THEN hours ELSE 0 END) AS idle_hours,
    SUM(hours * rate_per_hour) AS fleet_cost
  FROM day_slices
  GROUP BY day
),
-- Idle hours whose interval began with at least one order waiting.
idle_starts_with_work AS (
  SELECT DISTINCT i.operator_id, i.started_at
  FROM (SELECT DISTINCT operator_id, started_at FROM day_slices WHERE activity = 'IDLE') i
  JOIN accepted_orders a
    ON a.accepted_at < i.started_at
   AND (a.first_scheduled_at IS NULL OR a.first_scheduled_at > i.started_at)
),
idle_with_work AS (
  SELECT s.day, SUM(s.hours) AS idle_with_work_hours
  FROM day_slices s
  JOIN idle_starts_with_work w ON w.operator_id = s.operator_id AND w.started_at = s.started_at
  WHERE s.activity = 'IDLE'
  GROUP BY s.day
),
-- One row per trip: TRANSIT_STARTED followed by WORK_STARTED.
trips AS (
  SELECT
    date(at) AS day,
    operator_id,
    at AS transit_at,
    prev_at AS freed_at,
    json_extract_scalar(payload, '$.dispatch_policy') AS dispatch_policy,
    (to_unixtime(next_at) - to_unixtime(at)) / 60.0 AS transit_minutes,
    sqrt(
      power((try_cast(json_extract_scalar(next_payload, '$.location.lat') AS double)
        - try_cast(json_extract_scalar(payload, '$.location.lat') AS double)) * 69.0, 2)
      + power((try_cast(json_extract_scalar(next_payload, '$.location.lng') AS double)
        - try_cast(json_extract_scalar(payload, '$.location.lng') AS double)) * 69.0 * cos(radians(40.7128)), 2)
    ) AS drive_miles
  FROM op_seq
  WHERE event_type = 'TRANSIT_STARTED' AND next_event_type = 'WORK_STARTED'
),
trips_daily AS (
  SELECT
    day,
    COUNT(*) AS trips,
    AVG(transit_minutes) AS avg_transit_minutes,
    AVG(drive_miles) AS avg_drive_miles,
    CASE
      WHEN COUNT(dispatch_policy) = 0 THEN 'UNSTAMPED'
      WHEN COUNT(DISTINCT dispatch_policy) = 1 AND COUNT(dispatch_policy) = COUNT(*) THEN MAX(dispatch_policy)
      ELSE 'MIXED'
    END AS dispatch_policy
  FROM trips
  GROUP BY day
),
-- Match delay: from the later of (order accepted, operator freed) to ORDER_SCHEDULED.
scheduled_ev AS (
  SELECT order_id, from_iso8601_timestamp(occurred_at) AS scheduled_at, json_extract_scalar(payload, '$.operator_id') AS operator_id
  FROM oe
  WHERE event_type = 'ORDER_SCHEDULED'
),
match_delays AS (
  SELECT
    date(s.scheduled_at) AS day,
    (to_unixtime(s.scheduled_at) - to_unixtime(GREATEST(a.accepted_at, t.freed_at))) / 60.0 AS match_delay_minutes
  FROM scheduled_ev s
  JOIN accepted_orders a ON a.order_id = s.order_id
  JOIN trips t
    ON t.operator_id = s.operator_id
   AND abs(to_unixtime(t.transit_at) - to_unixtime(s.scheduled_at)) < 60
  WHERE t.freed_at IS NOT NULL
),
match_daily AS (
  SELECT
    day,
    approx_percentile(GREATEST(match_delay_minutes, 0), 0.5) AS p50_match_delay_minutes,
    AVG(CASE WHEN match_delay_minutes < 2 THEN 1.0 ELSE 0.0 END) AS share_matched_under_2_min
  FROM match_delays
  GROUP BY day
),
completed_daily AS (
  SELECT date(at) AS day, COUNT(*) AS jobs_completed
  FROM op_seq
  WHERE event_type = 'WORK_COMPLETED'
  GROUP BY date(at)
),
accepted_daily AS (
  SELECT
    date(accepted_at) AS day,
    COUNT(*) AS orders_accepted,
    AVG(CASE WHEN descriptor IN ('Cave-in', 'Rough, Pitted or Cracked Roads', 'Crash Cushion Defect', 'Guard Rail - Street') THEN 1.0 ELSE 0.0 END)
      AS long_job_share_accepted
  FROM accepted_orders
  GROUP BY date(accepted_at)
),
resolved_daily AS (
  SELECT
    date(resolved_at) AS day,
    COUNT(*) AS orders_resolved,
    approx_percentile((to_unixtime(resolved_at) - to_unixtime(accepted_at)) / 3600.0, 0.5) AS median_ttr_hours,
    AVG(CASE WHEN resolved_at > from_iso8601_timestamp(sla_deadline) THEN 1.0 ELSE 0.0 END) AS sla_miss_rate,
    AVG(CASE WHEN descriptor IN ('Cave-in', 'Rough, Pitted or Cracked Roads', 'Crash Cushion Defect', 'Guard Rail - Street') THEN 1.0 ELSE 0.0 END)
      AS long_job_share_resolved
  FROM accepted_orders
  WHERE resolved_at IS NOT NULL
  GROUP BY date(resolved_at)
),
materials_daily AS (
  SELECT
    date(from_iso8601_timestamp(occurred_at)) AS day,
    SUM(COALESCE(try_cast(json_extract_scalar(payload, '$.materials_cost_actual') AS double), 0)) AS materials_cost
  FROM oe
  WHERE event_type = 'ORDER_RESOLVED'
  GROUP BY date(from_iso8601_timestamp(occurred_at))
),
-- Backlog age, sampled at the top of every hour.
hours AS (
  SELECT d.day, with_timezone(h, 'UTC') AS sample_at
  FROM days d
  CROSS JOIN UNNEST(sequence(CAST(d.day AS timestamp), CAST(d.day AS timestamp) + INTERVAL '23' HOUR, INTERVAL '1' HOUR)) AS t (h)
  WHERE with_timezone(h, 'UTC') <= current_timestamp
),
backlog_samples AS (
  SELECT h.day, h.sample_at, (to_unixtime(h.sample_at) - to_unixtime(a.accepted_at)) / 3600.0 AS age_hours
  FROM hours h
  JOIN accepted_orders a
    ON a.accepted_at < h.sample_at
   AND (a.first_scheduled_at IS NULL OR a.first_scheduled_at > h.sample_at)
),
backlog_daily AS (
  SELECT
    day,
    approx_percentile(age_hours, 0.9) AS backlog_p90_age_hours,
    CAST(COUNT(*) AS double) / COUNT(DISTINCT sample_at) AS avg_backlog
  FROM backlog_samples
  GROUP BY day
),
-- From dispatch_decisions (§2.4): holds, pass-overs, and the nearest considered order.
decisions AS (
  SELECT DISTINCT planner_run_id, order_id, operator_id, decided_at, decision_type, considered_order_ids, distance_miles, recheck_at
  FROM dispatch_decisions
),
pass_overs AS (
  SELECT date(from_iso8601_timestamp(d.decided_at)) AS day, c.considered_id, COUNT(*) AS times_passed_over
  FROM decisions d
  CROSS JOIN UNNEST(CAST(json_parse(d.considered_order_ids) AS array(varchar))) AS c (considered_id)
  WHERE d.decision_type = 'ASSIGN' AND c.considered_id <> d.order_id
  GROUP BY date(from_iso8601_timestamp(d.decided_at)), c.considered_id
),
pass_overs_daily AS (
  SELECT day, MAX(times_passed_over) AS max_pass_overs
  FROM pass_overs
  GROUP BY day
),
decision_origins AS (
  SELECT d.planner_run_id, d.order_id, d.decided_at, d.distance_miles,
    try_cast(json_extract_scalar(o.payload, '$.location.lat') AS double) AS op_lat,
    try_cast(json_extract_scalar(o.payload, '$.location.lng') AS double) AS op_lng,
    d.considered_order_ids
  FROM decisions d
  JOIN op_seq o
    ON o.operator_id = d.operator_id
   AND o.event_type = 'TRANSIT_STARTED'
   AND abs(to_unixtime(o.at) - to_unixtime(from_iso8601_timestamp(d.decided_at))) < 60
  WHERE d.decision_type = 'ASSIGN'
),
nearest_considered AS (
  SELECT
    date(from_iso8601_timestamp(x.decided_at)) AS day,
    x.planner_run_id,
    x.order_id,
    MAX(x.distance_miles) AS chosen_miles,
    MIN(sqrt(power((l.lat - x.op_lat) * 69.0, 2) + power((l.lng - x.op_lng) * 69.0 * cos(radians(40.7128)), 2))) AS nearest_miles
  FROM decision_origins x
  CROSS JOIN UNNEST(CAST(json_parse(x.considered_order_ids) AS array(varchar))) AS c (considered_id)
  JOIN order_latest ol ON ol.order_id = c.considered_id
  JOIN location_latest l ON l.location_id = ol.location_id
  WHERE l.lat IS NOT NULL AND l.lng IS NOT NULL
  GROUP BY date(from_iso8601_timestamp(x.decided_at)), x.planner_run_id, x.order_id
),
nearest_daily AS (
  SELECT day, AVG(chosen_miles) AS avg_chosen_miles, AVG(nearest_miles) AS avg_nearest_considered_miles
  FROM nearest_considered
  GROUP BY day
),
holds_daily AS (
  SELECT
    date(from_iso8601_timestamp(decided_at)) AS day,
    COUNT(*) AS holds,
    SUM((to_unixtime(from_iso8601_timestamp(recheck_at)) - to_unixtime(from_iso8601_timestamp(decided_at))) / 60.0) AS hold_minutes_planned
  FROM decisions
  WHERE decision_type = 'HOLD'
  GROUP BY date(from_iso8601_timestamp(decided_at))
),
-- Double claims: a TRANSIT_STARTED followed by another TRANSIT_STARTED with no WORK_COMPLETED/WORK_ABORTED between.
double_claims_daily AS (
  SELECT date(at) AS day, COUNT(*) AS double_claims
  FROM op_seq
  WHERE event_type = 'TRANSIT_STARTED' AND next_event_type = 'TRANSIT_STARTED'
  GROUP BY date(at)
)
SELECT
  date_format(d.day, '%Y-%m-%d') AS day,
  COALESCE(t.dispatch_policy, 'NO_TRIPS') AS dispatch_policy,
  CAST(COALESCE(c.jobs_completed, 0) AS varchar) AS jobs_completed,
  CAST(ROUND(f.paid_hours, 2) AS varchar) AS paid_hours,
  CAST(ROUND(f.paid_hours / 24.0, 2) AS varchar) AS avg_drivers_on_clock,
  CAST(ROUND(COALESCE(c.jobs_completed, 0) / NULLIF(f.paid_hours, 0), 4) AS varchar) AS jobs_per_paid_driver_hour,
  CAST(ROUND(COALESCE(ac.orders_accepted, 0) / NULLIF(COALESCE(c.jobs_completed, 0) / NULLIF(f.paid_hours, 0) * 24.0, 0), 2) AS varchar)
    AS implied_fleet_for_demand,
  CAST(ROUND((f.idle_hours + f.transit_hours) / NULLIF(f.paid_hours, 0), 4) AS varchar) AS non_productive_share,
  CAST(ROUND(f.idle_hours / NULLIF(f.paid_hours, 0), 4) AS varchar) AS idle_share,
  CAST(ROUND(f.transit_hours / NULLIF(f.paid_hours, 0), 4) AS varchar) AS transit_share,
  CAST(ROUND(f.working_hours / NULLIF(f.paid_hours, 0), 4) AS varchar) AS working_share,
  CAST(ROUND(f.idle_hours / NULLIF(f.paid_hours / 24.0, 0), 2) AS varchar) AS idle_hours_per_driver_day,
  CAST(ROUND(COALESCE(iw.idle_with_work_hours, 0), 2) AS varchar) AS idle_hours_with_work_waiting,
  CAST(ROUND(t.avg_transit_minutes, 2) AS varchar) AS avg_transit_minutes,
  CAST(ROUND(t.avg_drive_miles, 2) AS varchar) AS avg_drive_miles,
  CAST(ROUND(n.avg_nearest_considered_miles, 2) AS varchar) AS avg_nearest_considered_miles,
  CAST(ROUND(m.p50_match_delay_minutes, 2) AS varchar) AS p50_match_delay_minutes,
  CAST(ROUND(m.share_matched_under_2_min, 4) AS varchar) AS share_matched_under_2_min,
  CAST(COALESCE(ac.orders_accepted, 0) AS varchar) AS orders_accepted,
  CAST(COALESCE(r.orders_resolved, 0) AS varchar) AS orders_resolved,
  CAST(ROUND(r.median_ttr_hours, 2) AS varchar) AS median_ttr_hours,
  CAST(ROUND(r.sla_miss_rate, 4) AS varchar) AS sla_miss_rate,
  CAST(ROUND(b.backlog_p90_age_hours, 2) AS varchar) AS backlog_p90_age_hours,
  CAST(ROUND(b.avg_backlog, 1) AS varchar) AS avg_backlog,
  CAST(ROUND(f.fleet_cost, 2) AS varchar) AS fleet_cost,
  CAST(ROUND((f.fleet_cost + COALESCE(md.materials_cost, 0)) / NULLIF(r.orders_resolved, 0), 2) AS varchar) AS fleet_cost_per_resolved_order,
  CAST(ROUND(ac.long_job_share_accepted, 4) AS varchar) AS long_job_share_accepted,
  CAST(ROUND(r.long_job_share_resolved, 4) AS varchar) AS long_job_share_resolved,
  CAST(po.max_pass_overs AS varchar) AS max_pass_overs,
  CAST(COALESCE(hd.holds, 0) AS varchar) AS holds,
  CAST(ROUND(COALESCE(hd.hold_minutes_planned, 0), 1) AS varchar) AS hold_minutes_planned,
  CAST(COALESCE(dc.double_claims, 0) AS varchar) AS double_claims
FROM days d
LEFT JOIN fleet_daily f ON f.day = d.day
LEFT JOIN idle_with_work iw ON iw.day = d.day
LEFT JOIN trips_daily t ON t.day = d.day
LEFT JOIN match_daily m ON m.day = d.day
LEFT JOIN completed_daily c ON c.day = d.day
LEFT JOIN accepted_daily ac ON ac.day = d.day
LEFT JOIN resolved_daily r ON r.day = d.day
LEFT JOIN materials_daily md ON md.day = d.day
LEFT JOIN backlog_daily b ON b.day = d.day
LEFT JOIN pass_overs_daily po ON po.day = d.day
LEFT JOIN nearest_daily n ON n.day = d.day
LEFT JOIN holds_daily hd ON hd.day = d.day
LEFT JOIN double_claims_daily dc ON dc.day = d.day
ORDER BY d.day
