import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFeatureEnabled, useFeatureTreatment } from "../../src/hooks/useFeatureTreatment";
import { featureTreatmentService } from "../../src/services/featureTreatmentService";

vi.mock("../../src/services/featureTreatmentService", () => ({ featureTreatmentService: { getTreatment: vi.fn() } }));
const mockedGet = vi.mocked(featureTreatmentService.getTreatment);

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedGet.mockReset();
});

describe("useFeatureTreatment", () => {
  it("is loading, then resolves to the flag's treatment", async () => {
    mockedGet.mockResolvedValue("T1");
    const { result } = renderHook(() => useFeatureTreatment("CUSTOMERS_TAB"), { wrapper });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.treatment).toBe("T1"));
    expect(mockedGet).toHaveBeenCalledWith("CUSTOMERS_TAB");
  });
});

describe("useFeatureEnabled", () => {
  it("is true only for the on treatment", async () => {
    mockedGet.mockResolvedValue("T1");
    const { result } = renderHook(() => useFeatureEnabled("CUSTOMERS_TAB", "T1"), { wrapper });
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  /*
   * Outcomes are thunks, not promises: a bare `Promise.reject(...)` in the
   * array literal rejects immediately, before the loop even starts, and sat
   * unhandled through the prior iterations' `waitFor` cycles — tripping
   * Vitest's unhandled-rejection detector and failing `test:coverage` even
   * though every assertion passed. Building it inside the loop means it's
   * created and awaited by the same `renderHook` call, with no gap.
   */
  it("stays false for control, a missing flag, or a failed lookup — without retrying", async () => {
    const outcomes = [() => Promise.resolve("C"), () => Promise.resolve(null), () => Promise.reject(new Error("HTTP 500"))];
    for (const outcome of outcomes) {
      mockedGet.mockReset().mockReturnValue(outcome());
      const { result } = renderHook(() => useFeatureEnabled("CUSTOMERS_TAB", "T1"), { wrapper });
      await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1));
      expect(result.current).toBe(false);
    }
  });
});
