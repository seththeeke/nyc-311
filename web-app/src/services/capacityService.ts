import { fetchAuthSession } from "aws-amplify/auth";
import { config } from "../config";
import { CapacityStatusSchema, OperatorSchema, type CapacityStatus, type Operator } from "../models/operator";
import { MOCK_OPERATORS } from "../test-data/operators";

/*
 * One interface, two implementations, selected by config.dataMode
 * (CLAUDE.md §5.1, 10-capacity-modeling-and-integration.md §2.1-§2.2) —
 * same shape as every other service. The whole Capacity page sits behind
 * AdminRoute, so every method here assumes an authenticated session
 * already exists (unlike authService.getCurrentUser, which tolerates
 * "not signed in" as a normal outcome).
 */
export interface CapacityService {
  getCapacityStatus(): Promise<CapacityStatus>;
  addCapacity(ratePerHour?: number): Promise<Operator>;
  removeCapacity(operatorId: string): Promise<Operator>;
}

async function authorizedFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  if (!idToken) {
    throw new Error("Not authenticated");
  }
  return fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${idToken}` },
  });
}

class LiveCapacityService implements CapacityService {
  async getCapacityStatus(): Promise<CapacityStatus> {
    const response = await authorizedFetch("/capacity");
    if (!response.ok) {
      throw new Error(`Failed to fetch capacity status: HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    return CapacityStatusSchema.parse(body);
  }

  async addCapacity(ratePerHour?: number): Promise<Operator> {
    const response = await authorizedFetch("/capacity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ratePerHour !== undefined ? { rate_per_hour: ratePerHour } : {}),
    });
    if (!response.ok) {
      throw new Error(`Failed to add capacity: HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    return OperatorSchema.parse(body);
  }

  async removeCapacity(operatorId: string): Promise<Operator> {
    const response = await authorizedFetch(`/capacity/${encodeURIComponent(operatorId)}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error(`Failed to remove capacity: HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    return OperatorSchema.parse(body);
  }
}

const MOCK_DEFAULT_RATE_PER_HOUR = 45;

/*
 * Generates data on the fly for write operations, per CLAUDE.md §5.1's
 * in-memory-mode contract — the first mutating mock service in this
 * codebase. Module-scope mutable state (not persisted across a reload),
 * same lifecycle as every other mock service's read-only data.
 */
let mockOperators: Operator[] = MOCK_OPERATORS.map((operator) => ({ ...operator }));
let mockOperatorCounter = mockOperators.length;

class MockCapacityService implements CapacityService {
  async getCapacityStatus(): Promise<CapacityStatus> {
    const roster = mockOperators.filter((operator) => operator.status === "ACTIVE");
    const availableCount = roster.filter(
      (operator) => operator.current_activity === "IDLE" && !operator.removal_requested_at
    ).length;
    const hourlyBurnRate = roster.reduce((sum, operator) => sum + operator.rate_per_hour, 0);
    return { available_count: availableCount, fleet_size: roster.length, hourly_burn_rate: hourlyBurnRate, roster };
  }

  async addCapacity(ratePerHour?: number): Promise<Operator> {
    const operator: Operator = {
      operator_id: `01MOCKOPERATOR${String(mockOperatorCounter).padStart(3, "0")}`,
      status: "ACTIVE",
      current_activity: "IDLE",
      removal_requested_at: null,
      start_datetime: new Date().toISOString(),
      end_datetime: null,
      rate_per_hour: ratePerHour ?? MOCK_DEFAULT_RATE_PER_HOUR,
      last_event_sequence: 0,
    };
    mockOperatorCounter += 1;
    mockOperators = [...mockOperators, operator];
    return operator;
  }

  /** Mock mode never has a busy Operator (no execution flow exists yet), so removal always finalizes immediately. */
  async removeCapacity(operatorId: string): Promise<Operator> {
    const existing = mockOperators.find((operator) => operator.operator_id === operatorId);
    if (!existing) {
      throw new Error(`No Operator found for operator_id ${operatorId}`);
    }
    if (existing.status === "INACTIVE") {
      throw new Error(`Operator ${operatorId} is already removed`);
    }
    const updated: Operator = { ...existing, status: "INACTIVE", end_datetime: new Date().toISOString() };
    mockOperators = mockOperators.map((operator) => (operator.operator_id === operatorId ? updated : operator));
    return updated;
  }
}

export const capacityService: CapacityService =
  config.dataMode === "live" ? new LiveCapacityService() : new MockCapacityService();
