import locationsFixture from "../../sample-data/locations.json";
import usersFixture from "../../sample-data/users.json";
import requestsFixture from "../../sample-data/requests.json";
import ordersFixture from "../../sample-data/orders.json";
import orderEventsFixture from "../../sample-data/orderEvents.json";
import casesFixture from "../../sample-data/cases.json";
import caseEventsFixture from "../../sample-data/caseEvents.json";
import shiftsFixture from "../../sample-data/shifts.json";
import operatorsFixture from "../../sample-data/operators.json";
import operatorEventsFixture from "../../sample-data/operatorEvents.json";
import type {
  AdminUser,
  Case,
  CaseEvent,
  Location,
  Operator,
  OperatorEvent,
  Order,
  OrderEvent,
  Request as DemoRequest,
  Shift,
  TrackingPoint,
} from "../lib/types";

// A single mutable in-memory "database", seeded once from the static JSON
// fixtures and mutated by MSW handlers + the tracking simulation for the
// life of the browser tab. Resets on page refresh — this is a throwaway demo,
// not a persistence layer.
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const db = {
  locations: clone(locationsFixture) as Location[],
  users: clone(usersFixture) as AdminUser[],
  requests: clone(requestsFixture) as DemoRequest[],
  orders: clone(ordersFixture) as Order[],
  orderEvents: clone(orderEventsFixture) as OrderEvent[],
  cases: clone(casesFixture) as Case[],
  caseEvents: clone(caseEventsFixture) as CaseEvent[],
  shifts: clone(shiftsFixture) as Shift[],
  operators: clone(operatorsFixture) as Operator[],
  operatorEvents: clone(operatorEventsFixture) as OperatorEvent[],
  trails: new Map<string, TrackingPoint[]>(),
};

for (const op of db.operators) {
  if (op._position) {
    db.trails.set(op.operator_id, [{ ...op._position, occurred_at: op.updated_at }]);
  }
}

export function locationById(id: string | null | undefined): Location | undefined {
  if (!id) return undefined;
  return db.locations.find((l) => l.location_id === id);
}

export function nextCaseEventSequence(case_id: string): number {
  const events = db.caseEvents.filter((e) => e.case_id === case_id);
  return events.length ? Math.max(...events.map((e) => e.sequence_number)) + 1 : 0;
}
