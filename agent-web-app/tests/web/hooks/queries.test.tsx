import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { useRun } from "../../../web/hooks/queries.ts";
import { makeRunDetail, stubApi, testClient } from "../fixtures.tsx";

describe("useRun", () => {
  it("polls only while the run is running", async () => {
    const client = testClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    stubApi({ "/agents/a/runs/1": makeRunDetail({ status: "SUCCEEDED" }) });
    const { result } = renderHook(() => useRun("a", "1"), { wrapper });
    await waitFor(() => expect(result.current.data?.status).toBe("SUCCEEDED"));
    const query = client.getQueryCache().find({ queryKey: ["run", "a", "1"] });
    /* QueryOptions doesn't type refetchInterval (it's an observer option), so read it loosely. */
    const interval = (query?.options as { refetchInterval?: (q: unknown) => unknown }).refetchInterval;
    expect(interval?.(query)).toBe(false);
  });
});
