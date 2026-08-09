// Mirrors docs/data-model.md. Demo-only fields on Operator are prefixed `_`.

export type Borough = "MANHATTAN" | "BROOKLYN" | "QUEENS" | "BRONX" | "STATEN ISLAND";

export interface Location {
  location_id: string;
  bbl: string;
  address: string;
  borough: Borough;
  community_board: string;
  zip: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface AdminUser {
  user_id: string;
  type: "admin";
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
  last_active_at: string;
  cognito_sub: string;
  email: string;
  display_name: string;
}

export interface Request {
  request_id: string;
  source: "nyc_311";
  external_unique_key: string;
  location_id: string;
  complaint_type: string;
  descriptor: string;
  agency: string;
  raw_payload: Record<string, unknown>;
  status: "draft" | "pending" | "promoted" | "filtered" | "duplicate" | "rejected";
  created_by: string | null;
  created_at: string;
}

export type OrderStage = "Ingest" | "Schedule" | "Execute" | "Resolve";
export type OrderStatus = "in_progress" | "blocked" | "resolved" | "failed";

export interface Order {
  order_id: string;
  request_id: string;
  location_id: string;
  current_stage: OrderStage;
  status: OrderStatus;
  retry_counts: Record<OrderStage, number>;
  priority_tier: "standard" | "high" | "critical";
  sla_deadline: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  assigned_operator_id: string | null;
  reassignment_count: number;
  case_id: string | null;
  created_at: string;
  updated_at: string;
  last_event_sequence: number;
  _complaint_type: string;
  _agency: string;
  _borough: Borough;
}

export interface OrderEvent {
  order_id: string;
  sequence_number: number;
  event_type: string;
  stage: OrderStage | null;
  payload: Record<string, unknown>;
  occurred_at: string;
  actor: "system" | "agent" | "admin";
}

export type CaseType = "workflow_execution_failure" | "location_resolution_failure" | "capacity_sla_breach";
export type Queue = "system-failure" | "capacity-escalation";
export type CaseStatus = "created" | "under_investigation" | "auto_resolved" | "escalated" | "resolved_by_admin" | "closed";

export interface Case {
  case_id: string;
  order_id: string | null;
  request_id: string | null;
  case_type: CaseType;
  queue: Queue;
  status: CaseStatus;
  sla_deadline: string;
  created_by: string;
  assigned_owner: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseEvent {
  case_id: string;
  sequence_number: number;
  event_type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  actor: "system" | "agent" | "admin";
}

export interface Shift {
  shift_id: string;
  pool: string;
  depot_id: string;
  rate_per_hour: number;
  scheduled_start: string;
  scheduled_end: string;
  status: "scheduled" | "active" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

export type OperatorActivity = "idle" | "transit" | "working" | "off_shift";

export interface Operator {
  operator_id: string;
  function_type: string;
  status: "active" | "inactive";
  current_shift_id: string | null;
  current_activity: OperatorActivity;
  created_at: string;
  updated_at: string;
  last_event_sequence: number;
  _depot: { latitude: number; longitude: number } | null;
  _position: { latitude: number; longitude: number } | null;
  _destination_location_id: string | null;
  _assigned_order_id: string | null;
  _display_name: string;
}

export interface OperatorEvent {
  operator_id: string;
  sequence_number: number;
  event_type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  actor: "system" | "agent" | "admin";
}

export interface TrackingPoint {
  latitude: number;
  longitude: number;
  occurred_at: string;
}

export interface OperatorTracking {
  operator_id: string;
  position: { latitude: number; longitude: number } | null;
  trail: TrackingPoint[];
  predicted_path: { latitude: number; longitude: number }[];
  destination: { latitude: number; longitude: number } | null;
  current_activity: OperatorActivity;
}

export interface Metrics {
  order_volume_by_stage: Record<OrderStage, number>;
  order_status_counts: Record<string, number>;
  orders_by_borough: Record<string, number>;
  requests_by_complaint_type: Record<string, number>;
  case_counts_by_queue: Record<Queue, number>;
  case_status_counts: Record<string, number>;
  auto_resolve_rate: number;
  escalation_rate: number;
  active_operators: number;
  operators_on_duty: number;
  active_shifts: number;
  total_shifts: number;
  open_incidents: number;
}
