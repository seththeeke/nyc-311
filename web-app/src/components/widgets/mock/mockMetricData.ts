/*
 * WIP (work in progress): hard-coded sample values for the mock secondary-workspace
 * tiles (12-UX-workspace-refactor.md §6). No service calls, no hooks, no
 * backend — swap each for a real hook when its metric is built.
 */
export interface MockMetricSample {
  value: string;
  detail: string;
}

export const MOCK_TOTAL_REQUESTS: MockMetricSample = { value: "4,892", detail: "↑ 12% vs. last week" };
export const MOCK_SERVICED: MockMetricSample = { value: "4,625", detail: "94.5% completion" };
export const MOCK_TOTAL_COST_EST: MockMetricSample = { value: "$421,380", detail: "↓ 8% vs. last week" };
export const MOCK_MEAN_TIME_TO_RESOLVE: MockMetricSample = { value: "2h 14m", detail: "mean, closed requests" };
export const MOCK_MEDIAN_TIME_TO_RESOLVE: MockMetricSample = { value: "1h 38m", detail: "median, closed requests" };
