import { db, locationById } from "./db";
import type { Operator, TrackingPoint } from "../lib/types";

// Client-side stand-in for what would, in the real system, be per-Operator
// `TransitStarted`/`WorkStarted`/`WorkCompleted` OperatorEvents plus GPS
// tracking pings. Ticks every TICK_MS, mutates the in-memory db, and MSW
// handlers just read the latest state — the frontend polls like it would
// against a real API.
const TICK_MS = 2000;
const TRAIL_MAX_POINTS = 80;
const ARRIVE_THRESHOLD_DEG = 0.0009; // ~100m at NYC latitudes

const workTicksRemaining = new Map<string, number>();

function distance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  return Math.hypot(a.latitude - b.latitude, a.longitude - b.longitude);
}

function step(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }, fraction: number) {
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * fraction,
    longitude: from.longitude + (to.longitude - from.longitude) * fraction,
  };
}

function recordTrail(operator_id: string, point: { latitude: number; longitude: number }) {
  const entry: TrackingPoint = { ...point, occurred_at: new Date().toISOString() };
  const trail = db.trails.get(operator_id) ?? [];
  trail.push(entry);
  if (trail.length > TRAIL_MAX_POINTS) trail.splice(0, trail.length - TRAIL_MAX_POINTS);
  db.trails.set(operator_id, trail);
}

function completeWork(op: Operator) {
  const order = db.orders.find((o) => o.order_id === op._assigned_order_id);
  if (order) {
    const now = new Date().toISOString();
    const nextSeq = order.last_event_sequence + 1;
    db.orderEvents.push({ order_id: order.order_id, sequence_number: nextSeq, event_type: "StageSucceeded", stage: "Resolve", payload: {}, occurred_at: now, actor: "system" });
    db.orderEvents.push({ order_id: order.order_id, sequence_number: nextSeq + 1, event_type: "OrderResolved", stage: null, payload: {}, occurred_at: now, actor: "system" });
    order.current_stage = "Resolve";
    order.status = "resolved";
    order.last_event_sequence = nextSeq + 1;
    order.updated_at = now;
  }

  op.current_activity = "idle";
  op._destination_location_id = null;
  op._assigned_order_id = null;
  workTicksRemaining.delete(op.operator_id);

  // Pick up the next unassigned in-flight Order for this Operator's agency, if any.
  const nextOrder = db.orders.find(
    (o) => o.current_stage === "Execute" && o.status === "in_progress" && !o.assigned_operator_id && o._agency === op.function_type
  );
  if (nextOrder) {
    const loc = locationById(nextOrder.location_id);
    if (loc) {
      op.current_activity = "transit";
      op._destination_location_id = nextOrder.location_id;
      op._assigned_order_id = nextOrder.order_id;
      nextOrder.assigned_operator_id = op.operator_id;
      db.operatorEvents.push({
        operator_id: op.operator_id,
        sequence_number: op.last_event_sequence + 1,
        event_type: "TransitStarted",
        payload: { order_id: nextOrder.order_id },
        occurred_at: new Date().toISOString(),
        actor: "system",
      });
      op.last_event_sequence += 1;
    }
  }
}

function tick() {
  for (const op of db.operators) {
    if (!op._position || op.current_activity === "off_shift") continue;

    if (op.current_activity === "transit" && op._destination_location_id) {
      const dest = locationById(op._destination_location_id);
      if (!dest) continue;
      const d = distance(op._position, dest);
      if (d < ARRIVE_THRESHOLD_DEG) {
        op._position = { latitude: dest.latitude, longitude: dest.longitude };
        recordTrail(op.operator_id, op._position);
        op.current_activity = "working";
        workTicksRemaining.set(op.operator_id, 4 + Math.floor(Math.random() * 4));
        db.operatorEvents.push({
          operator_id: op.operator_id,
          sequence_number: op.last_event_sequence + 1,
          event_type: "WorkStarted",
          payload: { order_id: op._assigned_order_id },
          occurred_at: new Date().toISOString(),
          actor: "system",
        });
        op.last_event_sequence += 1;
      } else {
        op._position = step(op._position, dest, 0.18);
        recordTrail(op.operator_id, op._position);
      }
      op.updated_at = new Date().toISOString();
      continue;
    }

    if (op.current_activity === "working") {
      const remaining = (workTicksRemaining.get(op.operator_id) ?? 1) - 1;
      if (remaining <= 0) {
        db.operatorEvents.push({
          operator_id: op.operator_id,
          sequence_number: op.last_event_sequence + 1,
          event_type: "WorkCompleted",
          payload: { order_id: op._assigned_order_id },
          occurred_at: new Date().toISOString(),
          actor: "system",
        });
        op.last_event_sequence += 1;
        completeWork(op);
        if (op._position) recordTrail(op.operator_id, op._position);
      } else {
        workTicksRemaining.set(op.operator_id, remaining);
      }
      op.updated_at = new Date().toISOString();
      continue;
    }

    if (op.current_activity === "idle" && op._depot) {
      // small patrol jitter near the depot so idle trucks still read as "alive"
      const jitter = 0.0006;
      op._position = {
        latitude: op._position.latitude + (Math.random() - 0.5) * jitter,
        longitude: op._position.longitude + (Math.random() - 0.5) * jitter,
      };
      recordTrail(op.operator_id, op._position);
      op.updated_at = new Date().toISOString();
    }
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startSimulation() {
  if (intervalHandle) return;
  intervalHandle = setInterval(tick, TICK_MS);
}

export function stopSimulation() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}
