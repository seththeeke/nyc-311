import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRoutes } from "../../src/routes/AppRoutes";
import { ThemeProvider } from "../../src/components/shell/ThemeProvider";

/* The secondary workspace mounts CapacityWidget on every route; keep it off the network. */
vi.mock("../../src/hooks/useFleetLocations", () => ({
  useFleetLocations: () => ({ locations: { operators: [] }, isLoading: false, error: null }),
}));
vi.mock("../../src/hooks/usePollerMetrics", () => ({
  usePollerMetrics: () => ({ data: { cursor: null, metrics: [] }, isPending: false, isError: false }),
}));

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

describe("AppRoutes", () => {
  it("renders HomePage (the fleet map) at /", () => {
    renderAt("/");
    expect(screen.getByText(/OpenStreetMap/)).toBeInTheDocument();
  });

  it("renders HomePage underneath at /about (the About drawer itself lives in the sidebar footer)", () => {
    renderAt("/about");
    expect(screen.getByText(/OpenStreetMap/)).toBeInTheDocument();
  });

  it("renders DataPage at /data", () => {
    renderAt("/data");
    expect(screen.getByRole("heading", { name: "Data" })).toBeInTheDocument();
  });

  it("renders MonitoringPage at /monitoring", () => {
    renderAt("/monitoring");
    expect(screen.getByRole("heading", { name: "Monitoring" })).toBeInTheDocument();
  });

  it("renders IngestionMonitoringPage at /monitoring/ingestion", () => {
    renderAt("/monitoring/ingestion");
    expect(screen.getByRole("heading", { name: "Ingestion" })).toBeInTheDocument();
  });

  it("renders PipelineMonitoringPage at /monitoring/pipeline", () => {
    renderAt("/monitoring/pipeline");
    expect(screen.getByRole("heading", { name: "Pipeline" })).toBeInTheDocument();
  });

  it("renders LambdaMonitoringPage at /monitoring/lambda-health", () => {
    renderAt("/monitoring/lambda-health");
    expect(screen.getByRole("heading", { name: "Lambda Health" })).toBeInTheDocument();
  });

  it("renders IntegrationTestReportPage at /monitoring/integration-tests", () => {
    renderAt("/monitoring/integration-tests");
    expect(screen.getByRole("heading", { name: "Integration Tests" })).toBeInTheDocument();
  });

  it("renders LoginPage at /login", () => {
    renderAt("/login");
    expect(screen.getByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
  });

  it("redirects /admin to /login when logged out (mock mode's default session state)", async () => {
    renderAt("/admin");
    expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
  });

  it("redirects /admin/capacity to /login when logged out", async () => {
    renderAt("/admin/capacity");
    expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
  });

  it("redirects /admin/scheduling to /login when logged out", async () => {
    renderAt("/admin/scheduling");
    expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
  });

  it("redirects /admin/warehouse to /login when logged out", async () => {
    renderAt("/admin/warehouse");
    expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
  });

  it("wraps every page in the 3-panel shell: menu, primary workspace, and the secondary workspace", () => {
    renderAt("/monitoring/pipeline");
    expect(screen.getByRole("complementary", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Primary workspace" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Secondary workspace" })).toBeInTheDocument();
  });

  it("keeps the shell around the login page (renders inside the primary workspace)", () => {
    renderAt("/login");
    const primary = screen.getByRole("region", { name: "Primary workspace" });
    expect(primary).toContainElement(screen.getByRole("heading", { name: "Admin sign in" }));
    expect(screen.getByRole("complementary", { name: "Menu" })).toBeInTheDocument();
  });

  it("locked Admin flow: clicking an admin item while signed out lands on /login inside the shell", async () => {
    renderAt("/");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("link", { name: /Capacity/ }));
    const primary = screen.getByRole("region", { name: "Primary workspace" });
    expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
    expect(primary).toContainElement(screen.getByRole("heading", { name: "Admin sign in" }));
    expect(screen.getByRole("complementary", { name: "Secondary workspace" })).toBeInTheDocument();
  });
});
