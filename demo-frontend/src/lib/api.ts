import type {
  AdminUser,
  Case,
  CaseEvent,
  Location,
  Metrics,
  Operator,
  OperatorTracking,
  Order,
  OrderEvent,
  Shift,
} from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((body as { message?: string }).message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  locations: () => fetch("/api/locations").then((r) => json<Location[]>(r)),
  orders: () => fetch("/api/orders").then((r) => json<Order[]>(r)),
  order: (id: string) => fetch(`/api/orders/${id}`).then((r) => json<{ order: Order; events: OrderEvent[] }>(r)),
  cases: () => fetch("/api/cases").then((r) => json<Case[]>(r)),
  case: (id: string) => fetch(`/api/cases/${id}`).then((r) => json<{ case: Case; events: CaseEvent[] }>(r)),
  resolveCase: (id: string, token: string, note?: string) =>
    fetch(`/api/cases/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ note }),
    }).then((r) => json<Case>(r)),
  assignCase: (id: string, token: string) =>
    fetch(`/api/cases/${id}/assign`, { method: "POST", headers: authHeaders(token) }).then((r) => json<Case>(r)),
  closeCase: (id: string, token: string) =>
    fetch(`/api/cases/${id}/close`, { method: "POST", headers: authHeaders(token) }).then((r) => json<Case>(r)),
  operators: () => fetch("/api/operators").then((r) => json<Operator[]>(r)),
  tracking: () => fetch("/api/tracking").then((r) => json<OperatorTracking[]>(r)),
  shifts: () => fetch("/api/shifts").then((r) => json<Shift[]>(r)),
  metrics: () => fetch("/api/metrics").then((r) => json<Metrics>(r)),
  login: () => fetch("/api/auth/login", { method: "POST" }).then((r) => json<{ token: string; user: AdminUser }>(r)),
};
