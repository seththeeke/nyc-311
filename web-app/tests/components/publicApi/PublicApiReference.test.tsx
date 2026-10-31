import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { publicApiSpecService } from "../../../src/services/publicApiSpecService";

const updateSpec = vi.fn();
const swaggerUi = vi.fn();

vi.mock("../../../src/services/publicApiSpecService", () => ({
  DOCS_REQUESTER: "web-app:docs",
  publicApiSpecService: { getSpecYaml: vi.fn() },
}));
vi.mock("swagger-ui-dist/swagger-ui-es-bundle.js", () => ({ default: (options: unknown) => swaggerUi(options) }));
vi.mock("swagger-ui-dist/swagger-ui.css", () => ({}));

import { PublicApiReference } from "../../../src/components/publicApi/PublicApiReference";

const mockedGetSpec = vi.mocked(publicApiSpecService.getSpecYaml);

function renderReference() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PublicApiReference />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockedGetSpec.mockReset();
  updateSpec.mockReset();
  swaggerUi.mockReset();
  swaggerUi.mockReturnValue({ specActions: { updateSpec } });
});

describe("PublicApiReference", () => {
  it("renders the spec in Swagger UI, adding this page's X-Requester to calls that lack one", async () => {
    mockedGetSpec.mockResolvedValue("openapi: 3.1.0");
    renderReference();
    expect(screen.getByText("Loading…")).toBeInTheDocument();

    await waitFor(() => expect(updateSpec).toHaveBeenCalledWith("openapi: 3.1.0"));
    const options = swaggerUi.mock.calls[0][0] as {
      domNode: HTMLElement;
      requestInterceptor: (request: { headers: Record<string, string> }) => { headers: Record<string, string> };
    };
    expect(options.domNode).toBe(screen.getByTestId("swagger-ui"));
    expect(options.requestInterceptor({ headers: {} }).headers["X-Requester"]).toBe("web-app:docs");
    expect(options.requestInterceptor({ headers: { "X-Requester": "me" } }).headers["X-Requester"]).toBe("me");
  });

  it("shows an alert when the spec fails to load", async () => {
    mockedGetSpec.mockRejectedValue(new Error("HTTP 400"));
    renderReference();
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load the API spec: HTTP 400");
    expect(swaggerUi).not.toHaveBeenCalled();
  });

  it.each([new Error("bad spec"), "bad"])("shows an alert when Swagger UI fails (%s)", async (failure) => {
    mockedGetSpec.mockResolvedValue("openapi: 3.1.0");
    swaggerUi.mockImplementation(() => {
      throw failure;
    });
    renderReference();
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to render the API reference: bad");
  });

  it.each([
    ["loads", (settle: { resolve: (ui: typeof swaggerUi) => void }) => settle.resolve(swaggerUi)],
    ["fails", (settle: { reject: (err: Error) => void }) => settle.reject(new Error("late"))],
  ] as const)("does nothing when Swagger UI %s after unmount", async (_, finish) => {
    mockedGetSpec.mockResolvedValue("openapi: 3.1.0");
    const settle = {} as { resolve: (ui: typeof swaggerUi) => void; reject: (err: Error) => void };
    const loadSwagger = vi.fn(
      () =>
        new Promise<typeof swaggerUi>((resolve, reject) => {
          settle.resolve = resolve;
          settle.reject = reject;
        })
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <PublicApiReference loadSwagger={loadSwagger as never} />
      </QueryClientProvider>
    );
    await waitFor(() => expect(loadSwagger).toHaveBeenCalled());
    unmount();
    finish(settle as never);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(swaggerUi).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
