import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePublicApiMetrics } from "../../src/hooks/usePublicApiMetrics";
import { usePublicApiSpec } from "../../src/hooks/usePublicApiSpec";
import { publicApiMetricsService } from "../../src/services/publicApiMetricsService";
import { publicApiSpecService } from "../../src/services/publicApiSpecService";
import { MOCK_PUBLIC_API_METRICS } from "../../src/test-data/publicApiMetrics";

vi.mock("../../src/services/publicApiMetricsService", () => ({ publicApiMetricsService: { getMetrics: vi.fn() } }));
vi.mock("../../src/services/publicApiSpecService", () => ({ publicApiSpecService: { getSpecYaml: vi.fn() } }));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.mocked(publicApiMetricsService.getMetrics).mockReset();
  vi.mocked(publicApiSpecService.getSpecYaml).mockReset();
});

describe("public API hooks", () => {
  it("usePublicApiMetrics resolves with the service's metrics", async () => {
    vi.mocked(publicApiMetricsService.getMetrics).mockResolvedValue(MOCK_PUBLIC_API_METRICS);
    const { result } = renderHook(() => usePublicApiMetrics(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_PUBLIC_API_METRICS);
  });

  it("usePublicApiSpec resolves with the spec text", async () => {
    vi.mocked(publicApiSpecService.getSpecYaml).mockResolvedValue("openapi: 3.1.0");
    const { result } = renderHook(() => usePublicApiSpec(), { wrapper });
    await waitFor(() => expect(result.current.data).toBe("openapi: 3.1.0"));
  });
});
