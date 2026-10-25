import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DataPage } from "../../../src/components/pages/DataPage";
import { warehouseDataService } from "../../../src/services/warehouseDataService";
import type { WarehouseSchemaResponse } from "../../../src/models/warehouseSchema";

vi.mock("../../../src/services/warehouseDataService", () => ({
  warehouseDataService: { getSchema: vi.fn(), getJobRuns: vi.fn() },
}));

const mockedGetSchema = vi.mocked(warehouseDataService.getSchema);

const schema: WarehouseSchemaResponse = {
  tables: [
    { table_name: "order_events", columns: [{ name: "order_id", type: "string", comment: null }, { name: "request_id", type: "string", comment: null }] },
    { table_name: "requests", columns: [{ name: "request_id", type: "string", comment: null }] },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DataPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockedGetSchema.mockReset();
});

describe("DataPage", () => {
  it("shows the heading and a link back to Monitoring", () => {
    mockedGetSchema.mockResolvedValue({ tables: [] });
    renderPage();

    expect(screen.getByRole("heading", { name: "Data" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /monitoring/i })).toHaveAttribute("href", "/monitoring");
  });

  it("renders only the relationship diagram — no schema search, jobs, performance, or results views", async () => {
    mockedGetSchema.mockResolvedValue(schema);
    renderPage();

    expect(await screen.findByRole("img")).toHaveAccessibleName(/^Relationship diagram: 2 tables/);
    expect(screen.queryByLabelText("Search schema")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText(/job/i)).not.toBeInTheDocument();
  });

  it("does not fetch job runs", async () => {
    mockedGetSchema.mockResolvedValue(schema);
    renderPage();

    await screen.findByRole("img");
    expect(warehouseDataService.getJobRuns).not.toHaveBeenCalled();
  });

  it("shows a loading state while the schema is pending", () => {
    mockedGetSchema.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows an empty-state message when the catalog has no tables yet", async () => {
    mockedGetSchema.mockResolvedValue({ tables: [] });
    renderPage();

    expect(await screen.findByText("No warehouse tables catalogued yet.")).toBeInTheDocument();
  });

  it("shows an error message when the schema fetch fails", async () => {
    mockedGetSchema.mockRejectedValue(new Error("HTTP 500"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load warehouse schema: HTTP 500");
  });

  it("shows a generic error message for a non-Error rejection", async () => {
    mockedGetSchema.mockRejectedValue("boom");
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load warehouse schema.");
  });

  it("renders the relationship diagram from a single schema fetch", async () => {
    mockedGetSchema.mockResolvedValue({
      tables: [
        { table_name: "order_snapshots", columns: [{ name: "order_id", type: "string", comment: null }, { name: "request_id", type: "string", comment: null }] },
        { table_name: "requests", columns: [{ name: "request_id", type: "string", comment: null }] },
      ],
    });
    renderPage();

    expect(screen.getByRole("heading", { name: "Relationships" })).toBeInTheDocument();
    expect(await screen.findByRole("img")).toHaveAccessibleName("Relationship diagram: 2 tables, 1 foreign-key relationships");
    expect(mockedGetSchema).toHaveBeenCalledTimes(1);
  });

  it("shows no diagram while loading, on error, or with no tables", async () => {
    mockedGetSchema.mockResolvedValue({ tables: [] });
    renderPage();
    expect(await screen.findByText("No warehouse tables catalogued yet.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
