import { describe, expect, it, vi } from "vitest";
import { act, render, screen, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRoutes } from "../../src/routes/AppRoutes";
import { ThemeProvider } from "../../src/components/shell/ThemeProvider";
import { authResult, ADMIN_USER } from "../testUtils/authFixtures";

/* The secondary workspace mounts CapacityWidget on every route; keep it off the network. */
vi.mock("../../src/hooks/useFleetLocations", () => ({
  useFleetLocations: () => ({ locations: { operators: [] }, isLoading: false, error: null }),
}));
/* Every flag resolves to T1, so flag-gated routes render, except MARKETING_PAGE, off unless a test turns it on. */
let marketing = "C";
vi.mock("../../src/hooks/useFeatureTreatment", () => ({
  useFeatureTreatment: (flagKey: string) => ({ treatment: flagKey === "MARKETING_PAGE" ? marketing : "T1", isLoading: false }),
  useFeatureEnabled: () => true,
}));
let webGl = false;
/* Without WebGL the map shows its fallback; with it, the real city view mounts over a fake MapLibre, which needs WebGL2. */
vi.mock("maplibre-gl", async () => ({ Map: (await import("../components/map/fakeMapLibre")).FakeMap, setWorkerUrl: () => undefined }));
vi.mock("../../src/components/three/webgl", () => ({ isWebGlAvailable: () => webGl }));
vi.mock("../../src/hooks/usePollerMetrics", () => ({
  usePollerMetrics: () => ({ data: { cursor: null, metrics: [] }, isPending: false, isError: false }),
}));
/* Logged-out by default (matches every existing redirect-to-/login test); a handful of tests below flip this to exercise the admin-only lazy pages. */
let loggedIn = false;
vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => authResult(loggedIn ? { user: ADMIN_USER } : {}),
}));

/**
 * Renders, then awaits the lazy page's import inside act(), so React commits
 * the page within act. Outside act, React 19 holds a Suspense reveal until
 * 300ms after its fallback showed (FALLBACK_THROTTLE_MS), which cost every
 * first visit to a lazy page ~300ms of idle waiting in this file.
 */
async function renderAt(path: string): Promise<RenderResult> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  const result = render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
  await act(() => vi.dynamicImportSettled());
  return result;
}

describe("AppRoutes", () => {
  it("renders the map at / (its WebGL fallback here)", async () => {
    await renderAt("/");
    expect(await screen.findByRole("heading", { name: "3-D map unavailable" })).toBeInTheDocument();
  });

  it("renders the map underneath at /about (the About drawer itself lives in the sidebar footer)", async () => {
    await renderAt("/about");
    expect(await screen.findByRole("heading", { name: "3-D map unavailable" })).toBeInTheDocument();
  });

  it("renders the Meet the Team page at /team while MEET_THE_TEAM is on", async () => {
    await renderAt("/team");
    expect(await screen.findByRole("heading", { level: 1, name: "Meet the Team" })).toBeInTheDocument();
  });

  it("renders Team Chat at /team/chat while MEET_THE_TEAM is on", async () => {
    await renderAt("/team/chat");
    expect(await screen.findByRole("heading", { level: 1, name: "Team Chat" })).toBeInTheDocument();
  });

  it("renders the map on a /job/:orderId deep link", async () => {
    await renderAt("/job/01MOCKORDER001");
    expect(await screen.findByRole("heading", { name: "3-D map unavailable" })).toBeInTheDocument();
  });

  it("sends the old /mapv2 paths to the map at /", async () => {
    await renderAt("/mapv2/job/01MOCKORDER001");
    expect(await screen.findByRole("heading", { name: "3-D map unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("aria-current", "page");
  });

  it("mounts the city view at / and /about when WebGL2 is available", async () => {
    webGl = true;
    try {
      const { unmount } = await renderAt("/");
      expect(await screen.findByRole("application", { name: /3-D map of the fleet/ })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/");
      unmount();
      await renderAt("/about");
      expect(await screen.findByRole("application", { name: /3-D map of the fleet/ })).toBeInTheDocument();
    } finally {
      webGl = false;
    }
  });

  it("shows the marketing page at / while MARKETING_PAGE is on, and Enter fleet lands on the map", async () => {
    marketing = "T1";
    window.sessionStorage.clear();
    try {
      await renderAt("/");
      expect(await screen.findByRole("heading", { level: 1, name: /BoroughSim fixes it/ })).toBeInTheDocument();
      await userEvent.click(screen.getAllByRole("button", { name: /Enter fleet/ })[0]);
      expect(await screen.findByRole("heading", { name: "3-D map unavailable" })).toBeInTheDocument();
    } finally {
      marketing = "C";
      window.sessionStorage.clear();
    }
  });

  it("renders DataPage at /data", async () => {
    await renderAt("/data");
    expect(await screen.findByRole("heading", { name: "Data" })).toBeInTheDocument();
  });

  it("renders MonitoringPage at /monitoring", async () => {
    await renderAt("/monitoring");
    expect(await screen.findByRole("heading", { name: "Monitoring" })).toBeInTheDocument();
  });

  it("renders IngestionMonitoringPage at /monitoring/ingestion", async () => {
    await renderAt("/monitoring/ingestion");
    expect(await screen.findByRole("heading", { name: "Ingestion" })).toBeInTheDocument();
  });

  it("renders PipelineMonitoringPage at /monitoring/pipeline", async () => {
    await renderAt("/monitoring/pipeline");
    expect(await screen.findByRole("heading", { name: "Pipeline" })).toBeInTheDocument();
  });

  it("renders LambdaMonitoringPage at /monitoring/lambda-health", async () => {
    await renderAt("/monitoring/lambda-health");
    expect(await screen.findByRole("heading", { name: "Lambda Health" })).toBeInTheDocument();
  });

  it("renders IntegrationTestReportPage at /monitoring/integration-tests", async () => {
    await renderAt("/monitoring/integration-tests");
    expect(await screen.findByRole("heading", { name: "Integration Tests" })).toBeInTheDocument();
  });

  it("renders LoginPage at /login", async () => {
    await renderAt("/login");
    expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
  });

  it("redirects /admin to /login when logged out (mock mode's default session state)", async () => {
    await renderAt("/admin");
    expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
  });

  it("redirects /admin/capacity to /login when logged out", async () => {
    await renderAt("/admin/capacity");
    expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
  });

  it("redirects /admin/scheduling to /login when logged out", async () => {
    await renderAt("/admin/scheduling");
    expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
  });

  it("redirects /admin/warehouse to /login when logged out", async () => {
    await renderAt("/admin/warehouse");
    expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
  });

  it("redirects /admin/feature-flags to /login when logged out", async () => {
    await renderAt("/admin/feature-flags");
    expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
  });

  it("wraps every page in the 3-panel shell: menu, primary workspace, and the secondary workspace", async () => {
    await renderAt("/");
    expect(screen.getByRole("complementary", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Primary workspace" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Secondary workspace" })).toBeInTheDocument();
  });

  it("keeps the shell on a monitoring page, with the secondary workspace collapsed to its handle", async () => {
    await renderAt("/monitoring/pipeline");
    expect(screen.getByRole("complementary", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Primary workspace" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Secondary workspace" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show secondary panel" })).toBeInTheDocument();
  });

  it("keeps the shell around the login page (renders inside the primary workspace)", async () => {
    await renderAt("/login");
    const primary = screen.getByRole("region", { name: "Primary workspace" });
    expect(primary).toContainElement(await screen.findByRole("heading", { name: "Admin sign in" }));
    expect(screen.getByRole("complementary", { name: "Menu" })).toBeInTheDocument();
  });

  it("locked Admin flow: clicking an admin item while signed out lands on /login inside the shell", async () => {
    await renderAt("/");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^Admin/ }));
    await user.click(await screen.findByRole("link", { name: /Capacity/ }));
    const primary = screen.getByRole("region", { name: "Primary workspace" });
    expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
    expect(primary).toContainElement(screen.getByRole("heading", { name: "Admin sign in" }));
    expect(screen.getByRole("complementary", { name: "Secondary workspace" })).toBeInTheDocument();
  });

  it("renders ResidentsPage at /residents", async () => {
    await renderAt("/residents");
    expect(await screen.findByRole("heading", { level: 1, name: "Residents" })).toBeInTheDocument();
  });

  it("renders the Contacts page at /contacts while CONTACTS_PAGE is on", async () => {
    await renderAt("/contacts");
    expect(await screen.findByRole("heading", { level: 1, name: "Contacts" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Status")).toBeInTheDocument();
  });

  it("redirects the old /residents/contacts tab to /contacts", async () => {
    await renderAt("/residents/contacts");
    expect(await screen.findByRole("heading", { level: 1, name: "Contacts" })).toBeInTheDocument();
  });

  it("renders ResidentIdeaPage at a resident/idea deep link", async () => {
    await renderAt("/residents/hawthorn/ideas/01IDEA");
    expect(await screen.findByRole("heading", { level: 1, name: "Idea Detail" })).toBeInTheDocument();
  });

  describe("while signed in as an admin", () => {
    it("renders AdminPage at /admin", async () => {
      loggedIn = true;
      try {
        await renderAt("/admin");
        expect(await screen.findByRole("heading", { name: "Admin" })).toBeInTheDocument();
      } finally {
        loggedIn = false;
      }
    });

    it("renders CapacityManagementPage at /admin/capacity", async () => {
      loggedIn = true;
      try {
        await renderAt("/admin/capacity");
        expect(await screen.findByRole("heading", { name: "Capacity" })).toBeInTheDocument();
      } finally {
        loggedIn = false;
      }
    });

    it("renders SchedulingManagementPage at /admin/scheduling", async () => {
      loggedIn = true;
      try {
        await renderAt("/admin/scheduling");
        expect(await screen.findByRole("heading", { name: "Scheduling" })).toBeInTheDocument();
      } finally {
        loggedIn = false;
      }
    });

    it("renders AdminWarehousePage at /admin/warehouse", async () => {
      loggedIn = true;
      try {
        await renderAt("/admin/warehouse");
        expect(await screen.findByRole("heading", { name: "Data Warehouse" })).toBeInTheDocument();
      } finally {
        loggedIn = false;
      }
    });

    it("renders FeatureFlagsPage at /admin/feature-flags", async () => {
      loggedIn = true;
      try {
        await renderAt("/admin/feature-flags");
        expect(await screen.findByRole("heading", { name: "Feature Flags" })).toBeInTheDocument();
      } finally {
        loggedIn = false;
      }
    });
  });
});
