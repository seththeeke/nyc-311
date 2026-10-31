import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PublicApiSpecDownload, SPEC_FILE_NAME } from "../../../src/components/publicApi/PublicApiSpecDownload";
import { publicApiSpecService } from "../../../src/services/publicApiSpecService";

vi.mock("../../../src/services/publicApiSpecService", () => ({ publicApiSpecService: { getSpecYaml: vi.fn() } }));
const mockedGetSpec = vi.mocked(publicApiSpecService.getSpecYaml);

function renderDownload() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PublicApiSpecDownload />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockedGetSpec.mockReset();
  URL.createObjectURL = vi.fn(() => "blob:spec");
  URL.revokeObjectURL = vi.fn();
});

describe("PublicApiSpecDownload", () => {
  it("offers the hosted spec as a YAML download once it has loaded, and frees it on unmount", async () => {
    mockedGetSpec.mockResolvedValue("openapi: 3.1.0\n");
    const { unmount } = renderDownload();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: "Download Swagger model" });
    expect(link).toHaveAttribute("href", "blob:spec");
    expect(link).toHaveAttribute("download", SPEC_FILE_NAME);
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:spec");
  });

  it("explains a failure to load the spec", async () => {
    mockedGetSpec.mockRejectedValue(new Error("HTTP 400"));
    renderDownload();
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load the API spec: HTTP 400");
  });
});
