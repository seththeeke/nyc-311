import { http, HttpResponse } from "msw";
import { db, locationById, nextCaseEventSequence } from "./db";
import type { Metrics, Operator, OrderStage, TrackingPoint } from "../lib/types";

export const MOCK_TOKEN = "mock-admin-token";

function isAuthed(request: Request): boolean {
  return request.headers.get("authorization") === `Bearer ${MOCK_TOKEN}`;
}

function computeMetrics(): Metrics {
  const order_volume_by_stage = { Ingest: 0, Schedule: 0, Execute: 0, Resolve: 0 } as Record<OrderStage, number>;
  const order_status_counts: Record<string, number> = {};
  const orders_by_borough: Record<string, number> = {};
  for (const o of db.orders) {
    order_volume_by_stage[o.current_stage] = (order_volume_by_stage[o.current_stage] ?? 0) + 1;
    order_status_counts[o.status] = (order_status_counts[o.status] ?? 0) + 1;
    orders_by_borough[o._borough] = (orders_by_borough[o._borough] ?? 0) + 1;
  }

  const requests_by_complaint_type: Record<string, number> = {};
  for (const r of db.requests) {
    requests_by_complaint_type[r.complaint_type] = (requests_by_complaint_type[r.complaint_type] ?? 0) + 1;
  }

  const case_counts_by_queue = { "system-failure": 0, "capacity-escalation": 0 } as Record<string, number>;
  const case_status_counts: Record<string, number> = {};
  for (const c of db.cases) {
    case_counts_by_queue[c.queue] = (case_counts_by_queue[c.queue] ?? 0) + 1;
    case_status_counts[c.status] = (case_status_counts[c.status] ?? 0) + 1;
  }
  const decided = db.cases.filter((c) => ["auto_resolved", "escalated", "resolved_by_admin", "closed"].includes(c.status));
  const autoResolved = db.cases.filter((c) => c.status === "auto_resolved" || c.status === "closed").length;
  const escalated = db.cases.filter((c) => c.status === "escalated" || c.status === "resolved_by_admin").length;

  return {
    order_volume_by_stage,
    order_status_counts,
    orders_by_borough,
    requests_by_complaint_type,
    case_counts_by_queue: case_counts_by_queue as Metrics["case_counts_by_queue"],
    case_status_counts,
    auto_resolve_rate: decided.length ? autoResolved / decided.length : 0,
    escalation_rate: decided.length ? escalated / decided.length : 0,
    active_operators: db.operators.filter((o) => o.status === "active").length,
    operators_on_duty: db.operators.filter((o) => o.current_activity !== "off_shift").length,
    active_shifts: db.shifts.filter((s) => s.status === "active").length,
    total_shifts: db.shifts.length,
    open_incidents: db.orders.filter((o) => o.status === "in_progress" || o.status === "blocked").length,
  };
}

function trackingFor(op: Operator) {
  const dest = locationById(op._destination_location_id);
  const trail: TrackingPoint[] = db.trails.get(op.operator_id) ?? [];
  const predicted_path =
    op.current_activity === "transit" && op._position && dest
      ? [
          { latitude: op._position.latitude, longitude: op._position.longitude },
          { latitude: dest.latitude, longitude: dest.longitude },
        ]
      : [];
  return {
    operator_id: op.operator_id,
    position: op._position,
    trail,
    predicted_path,
    destination: dest ? { latitude: dest.latitude, longitude: dest.longitude } : null,
    current_activity: op.current_activity,
  };
}

export const handlers = [
  http.get("/api/locations", () => HttpResponse.json(db.locations)),

  http.get("/api/orders", () => HttpResponse.json(db.orders)),
  http.get("/api/orders/:id", ({ params }) => {
    const order = db.orders.find((o) => o.order_id === params.id);
    if (!order) return HttpResponse.json({ message: "not found" }, { status: 404 });
    const events = db.orderEvents.filter((e) => e.order_id === order.order_id).sort((a, b) => a.sequence_number - b.sequence_number);
    return HttpResponse.json({ order, events });
  }),

  http.get("/api/cases", () => HttpResponse.json(db.cases)),
  http.get("/api/cases/:id", ({ params }) => {
    const c = db.cases.find((x) => x.case_id === params.id);
    if (!c) return HttpResponse.json({ message: "not found" }, { status: 404 });
    const events = db.caseEvents.filter((e) => e.case_id === c.case_id).sort((a, b) => a.sequence_number - b.sequence_number);
    return HttpResponse.json({ case: c, events });
  }),

  http.post("/api/cases/:id/resolve", async ({ params, request }) => {
    if (!isAuthed(request)) return HttpResponse.json({ message: "unauthorized" }, { status: 401 });
    const c = db.cases.find((x) => x.case_id === params.id);
    if (!c) return HttpResponse.json({ message: "not found" }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as { note?: string };
    const now = new Date().toISOString();
    c.status = "resolved_by_admin";
    c.assigned_owner = c.assigned_owner ?? db.users[0].user_id;
    c.updated_at = now;
    db.caseEvents.push({
      case_id: c.case_id,
      sequence_number: nextCaseEventSequence(c.case_id),
      event_type: "AdminResolved",
      payload: { note: body.note ?? "Resolved by admin." },
      occurred_at: now,
      actor: "admin",
    });
    return HttpResponse.json(c);
  }),

  http.post("/api/cases/:id/assign", async ({ params, request }) => {
    if (!isAuthed(request)) return HttpResponse.json({ message: "unauthorized" }, { status: 401 });
    const c = db.cases.find((x) => x.case_id === params.id);
    if (!c) return HttpResponse.json({ message: "not found" }, { status: 404 });
    const now = new Date().toISOString();
    c.assigned_owner = db.users[0].user_id;
    if (c.status === "created" || c.status === "under_investigation") c.status = "escalated";
    c.updated_at = now;
    db.caseEvents.push({
      case_id: c.case_id,
      sequence_number: nextCaseEventSequence(c.case_id),
      event_type: "EscalatedToHuman",
      payload: { reason: "Manually claimed by admin." },
      occurred_at: now,
      actor: "admin",
    });
    return HttpResponse.json(c);
  }),

  http.post("/api/cases/:id/close", async ({ params, request }) => {
    if (!isAuthed(request)) return HttpResponse.json({ message: "unauthorized" }, { status: 401 });
    const c = db.cases.find((x) => x.case_id === params.id);
    if (!c) return HttpResponse.json({ message: "not found" }, { status: 404 });
    const now = new Date().toISOString();
    c.status = "closed";
    c.updated_at = now;
    db.caseEvents.push({ case_id: c.case_id, sequence_number: nextCaseEventSequence(c.case_id), event_type: "Closed", payload: {}, occurred_at: now, actor: "admin" });
    return HttpResponse.json(c);
  }),

  http.get("/api/operators", () => HttpResponse.json(db.operators)),
  http.get("/api/operators/:id/tracking", ({ params }) => {
    const op = db.operators.find((o) => o.operator_id === params.id);
    if (!op) return HttpResponse.json({ message: "not found" }, { status: 404 });
    return HttpResponse.json(trackingFor(op));
  }),
  http.get("/api/tracking", () => HttpResponse.json(db.operators.filter((o) => o._position).map(trackingFor))),

  http.get("/api/shifts", () => HttpResponse.json(db.shifts)),

  http.get("/api/metrics", () => HttpResponse.json(computeMetrics())),

  http.post("/api/auth/login", () => {
    return HttpResponse.json({ token: MOCK_TOKEN, user: db.users[0] });
  }),
  http.get("/api/auth/me", ({ request }) => {
    if (!isAuthed(request)) return HttpResponse.json({ message: "unauthorized" }, { status: 401 });
    return HttpResponse.json(db.users[0]);
  }),
];
