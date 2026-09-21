import type { ReactElement } from "react";
import { MetricTileBody } from "../MetricTileBody";
import {
  MOCK_MEAN_TIME_TO_RESOLVE,
  MOCK_MEDIAN_TIME_TO_RESOLVE,
  MOCK_SERVICED,
  MOCK_TOTAL_COST_EST,
  MOCK_TOTAL_REQUESTS,
  type MockMetricSample,
} from "./mockMetricData";

function MockTile({ sample }: { sample: MockMetricSample }): ReactElement {
  return <MetricTileBody value={sample.value} detail={sample.detail} />;
}

export const TotalRequestsWidget = (): ReactElement => <MockTile sample={MOCK_TOTAL_REQUESTS} />;
export const ServicedWidget = (): ReactElement => <MockTile sample={MOCK_SERVICED} />;
export const TotalCostEstWidget = (): ReactElement => <MockTile sample={MOCK_TOTAL_COST_EST} />;
export const MeanTimeToResolveWidget = (): ReactElement => <MockTile sample={MOCK_MEAN_TIME_TO_RESOLVE} />;
export const MedianTimeToResolveWidget = (): ReactElement => <MockTile sample={MOCK_MEDIAN_TIME_TO_RESOLVE} />;
