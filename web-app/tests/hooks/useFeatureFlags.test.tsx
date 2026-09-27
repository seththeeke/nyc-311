import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFeatureFlags } from "../../src/hooks/useFeatureFlags";
import { featureFlagService } from "../../src/services/featureFlagService";
import { MOCK_FEATURE_FLAGS } from "../../src/test-data/featureFlags";

vi.mock("../../src/services/featureFlagService", () => ({
  featureFlagService: {
    listFeatureFlags: vi.fn(),
    createFeatureFlag: vi.fn(),
    updateFeatureFlag: vi.fn(),
    deleteFeatureFlag: vi.fn(),
  },
}));

const service = vi.mocked(featureFlagService);
const flag = MOCK_FEATURE_FLAGS[0];
const input = { description: "", treatments: ["A"], default_treatment: "A", overrides: [], allocations: [] };

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  service.listFeatureFlags.mockResolvedValue([flag]);
});

describe("useFeatureFlags", () => {
  it("loads the flags", async () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await waitFor(() => expect(result.current.flags).toEqual([flag]));
    expect(result.current.error).toBeNull();
  });

  it("surfaces a load error", async () => {
    service.listFeatureFlags.mockRejectedValue(new Error("down"));
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await waitFor(() => expect(result.current.error?.message).toBe("down"));
  });

  it("runs each mutation and refetches the list afterward", async () => {
    service.createFeatureFlag.mockResolvedValue(flag);
    service.updateFeatureFlag.mockResolvedValue(flag);
    service.deleteFeatureFlag.mockResolvedValue(undefined);
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await waitFor(() => expect(result.current.flags).toBeDefined());

    await act(async () => {
      await result.current.createFlag({ ...input, flag_key: "K" });
      await result.current.updateFlag("K", { ...input, expected_version: 1 });
      await result.current.deleteFlag("K");
    });

    expect(service.createFeatureFlag).toHaveBeenCalledWith({ ...input, flag_key: "K" });
    expect(service.updateFeatureFlag).toHaveBeenCalledWith("K", { ...input, expected_version: 1 });
    expect(service.deleteFeatureFlag).toHaveBeenCalledWith("K");
    await waitFor(() => expect(service.listFeatureFlags.mock.calls.length).toBeGreaterThanOrEqual(2));
  });
});
