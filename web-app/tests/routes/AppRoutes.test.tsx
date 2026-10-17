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
/* Every flag resolves to `treatment` (T1 unless a test says otherwise), so flag-gated routes render; Mapv2 shows its fallback here — its real map has its own tests. */
let treatment = "T1";
vi.mock("../../src/hooks/useFeatureTreatment", () => ({
  useFeatureTreatment: () => ({ treatment, isLoading: false }),
  useFeatureEnabled: () => true,
}));
let webGl = false;
/* The T2 takeover mounts the real city view; a fake map stands in for MapLibre, which needs WebGL2. */
vi.mock("maplibre-gl", async () => ({ Map: (await import("../components/mapv2/fakeMapLibre")).FakeMap, setWorkerUrl: () => undefined }));
vi.mock("../../src/components/three/webgl", () => ({ isWebGlAvailable: () => webGl }));
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
  it("renders HomePage (the fleet map) at /", async () => {
    renderAt("/");
    /* FLEET_MAP is lazy() (widgetRegistry.ts, keeps leaflet out of the main chunk); it resolves async. */
    expect(await screen.findByText(/OpenStreetMap/)).toBeInTheDocument();
  });

  it("renders HomePage underneath at /about (the About drawer itself lives in the sidebar footer)", async () => {
    renderAt("/about");
    expect(await screen.findByText(/OpenStreetMap/)).toBeInTheDocument();
  });

  it("renders MapV2Page at /mapv2 while MAP_V2 is on", async () => {
    renderAt("/mapv2");
    expect(await screen.findByRole("heading", { name: "3-D map unavailable" })).toBeInTheDocument();
  });

  it("keeps the same MapV2Page on a /mapv2/job/:orderId deep link", async () => {
    renderAt("/mapv2/job/01MOCKORDER001");
    expect(await screen.findByRole("heading", { name: "3-D map unavailable" })).toBeInTheDocument();
  });

  it("MAP_V2 = T2: sends / to the 3-D map and puts it under the About drawer", async () => {
    treatment = "T2";
    webGl = true;
    try {
      const { unmount } = renderAt("/");
      expect(await screen.findByRole("application", { name: /3-D map of the fleet/ })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/mapv2");
      unmount();
      renderAt("/about");
      expect(await screen.findByRole("application", { name: /3-D map of the fleet/ })).toBeInTheDocument();
      expect(screen.queryByText(/OpenStreetMap/)).not.toBeInTheDocument();
    } finally {
      treatment = "T1";
      webGl = false;
    }
  });

  it("renders DataPage at /data", async () => {
    renderAt("/data");
    expect(await screen.findByRole("heading", { name: "Data" })).toBeInTheDocument();
  });

  it("renders MonitoringPage at /monitoring", async () => {
    renderAt("/monitoring");
    expect(await screen.findByRole("heading", { name: "Monitoring" })).toBeInTheDocument();
  });

  it("renders IngestionMonitoringPage at /monitoring/ingestion", async () => {
    renderAt("/monitoring/ingestion");
    expect(await screen.findByRole("heading", { name: "Ingestion" })).toBeInTheDocument();
  });

  it("renders PipelineMonitoringPage at /monitoring/pipeline", async () => {
    renderAt("/monitoring/pipeline");
    expect(await screen.findByRole("heading", { name: "Pipeline" })).toBeInTheDocument();
  });

  it("renders LambdaMonitoringPage at /monitoring/lambda-health", async () => {
    renderAt("/monitoring/lambda-health");
    expect(await screen.findByRole("heading", { name: "Lambda Health" })).toBeInTheDocument();
  });

  it("renders IntegrationTestReportPage at /monitoring/integration-tests", async () => {
    renderAt("/monitoring/integration-tests");
    expect(await screen.findByRole("heading", { name: "Integration Tests" })).toBeInTheDocument();
  });

  it("renders LoginPage at /login", async () => {
    renderAt("/login");
    expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
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

  it("redirects /admin/feature-flags to /login when logged out", async () => {
    renderAt("/admin/feature-flags");
    expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
  });

  it("wraps every page in the 3-panel shell: menu, primary workspace, and the secondary workspace", () => {
    renderAt("/");
    expect(screen.getByRole("complementary", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Primary workspace" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Secondary workspace" })).toBeInTheDocument();
  });

  it("keeps the shell on a monitoring page, with the secondary workspace collapsed to its handle", () => {
    renderAt("/monitoring/pipeline");
    expect(screen.getByRole("complementary", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Primary workspace" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Secondary workspace" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show secondary panel" })).toBeInTheDocument();
  });

  it("keeps the shell around the login page (renders inside the primary workspace)", async () => {
    renderAt("/login");
    const primary = screen.getByRole("region", { name: "Primary workspace" });
    expect(primary).toContainElement(await screen.findByRole("heading", { name: "Admin sign in" }));
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
