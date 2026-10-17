import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from "../../../src/components/shell/ThemeProvider";
import { IDLE_OPERATOR, WORKING_OPERATOR } from "../mapv2/fixtures";

let webGl = true;
vi.mock("../../../src/components/mapv2/webgl", () => ({ isWebGlAvailable: () => webGl }));
let fleet = { locations: { operators: [IDLE_OPERATOR, WORKING_OPERATOR] }, isLoading: false, error: null };
vi.mock("../../../src/hooks/useFleetLocations", () => ({ useFleetLocations: () => fleet }));

interface CityStubProps {
  selectedId: string | null;
  divingId: string | null;
  paused: boolean;
  onSelect: (id: string | null) => void;
  onDiveArrived: () => void;
}
/* The real city needs WebGL; this stand-in exposes the props the page drives and the callbacks it hands down. */
vi.mock("../../../src/components/mapv2/CityView", () => ({
  CityView: ({ selectedId, divingId, paused, onSelect, onDiveArrived }: CityStubProps) => (
    <div data-testid="city" data-selected={selectedId ?? ""} data-diving={divingId ?? ""} data-paused={String(paused)}>
      <button type="button" onClick={() => onSelect("OP-W")}>pick truck</button>
      <button type="button" onClick={onDiveArrived}>camera arrived</button>
    </div>
  ),
}));
vi.mock("../../../src/components/mapv2/DiveView", () => ({
  DiveView: ({ operator, onExit }: { operator: { name: string } | undefined; onExit: () => void }) => (
    <div data-testid="dive">
      {operator ? operator.name : "no operator"}
      <button type="button" onClick={onExit}>exit dive</button>
    </div>
  ),
}));
const { MapV2Page } = await import("../../../src/components/pages/MapV2Page");

function Path() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

function renderAt(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/mapv2/*" element={<MapV2Page />} />
        </Routes>
        <Path />
      </MemoryRouter>
    </ThemeProvider>
  );
}

beforeEach(() => {
  webGl = true;
  fleet = { locations: { operators: [IDLE_OPERATOR, WORKING_OPERATOR] }, isLoading: false, error: null };
});

describe("MapV2Page", () => {
  it("shows the fallback without WebGL", () => {
    webGl = false;
    renderAt("/mapv2");
    expect(screen.getByRole("heading", { name: "3-D map unavailable" })).toBeInTheDocument();
    expect(screen.queryByTestId("city")).not.toBeInTheDocument();
  });

  it("selects from the roster or the map, then dives: camera first, then the job URL", async () => {
    renderAt("/mapv2");
    expect(screen.getByRole("region", { name: "Fleet summary" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Vehicle 1/ }));
    expect(screen.getByTestId("city")).toHaveAttribute("data-selected", "OP-I");
    await userEvent.click(screen.getByRole("button", { name: "pick truck" }));
    expect(screen.getByRole("region", { name: "Vehicle 4 details" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dive into job" }));
    expect(screen.getByTestId("city")).toHaveAttribute("data-diving", "OP-W");
    expect(screen.getByRole("button", { name: "Diving in…" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "camera arrived" }));
    expect(screen.getByTestId("path")).toHaveTextContent("/mapv2/job/ORDER-1");
    expect(screen.getByTestId("dive")).toHaveTextContent("Vehicle 4");
    expect(screen.getByTestId("city")).toHaveAttribute("data-paused", "true");
    expect(screen.queryByRole("region", { name: "Fleet summary" })).not.toBeInTheDocument();
  });

  it("closes the vehicle card", async () => {
    renderAt("/mapv2");
    await userEvent.click(screen.getByRole("button", { name: "pick truck" }));
    await userEvent.click(screen.getByRole("button", { name: "Close vehicle details" }));
    expect(screen.queryByRole("region", { name: "Vehicle 4 details" })).not.toBeInTheDocument();
  });

  it("deep-links into a job and returns to the city with its truck selected", async () => {
    renderAt("/mapv2/job/ORDER-1");
    expect(screen.getByTestId("dive")).toHaveTextContent("Vehicle 4");
    await userEvent.click(screen.getByRole("button", { name: "exit dive" }));
    expect(screen.getByTestId("path")).toHaveTextContent(/^\/mapv2$/);
    expect(screen.getByTestId("city")).toHaveAttribute("data-selected", "OP-W");
  });

  it("returns home from a job that's no longer in the feed, with nothing selected", async () => {
    renderAt("/mapv2/job/GONE");
    expect(screen.getByTestId("dive")).toHaveTextContent("no operator");
    await userEvent.click(screen.getByRole("button", { name: "exit dive" }));
    expect(screen.getByTestId("city")).toHaveAttribute("data-selected", "");
  });

  it("navigates nowhere if the dived truck lost its job before the camera arrived", async () => {
    renderAt("/mapv2");
    await userEvent.click(screen.getByRole("button", { name: "camera arrived" }));
    expect(screen.getByTestId("path")).toHaveTextContent(/^\/mapv2$/);
  });

  it("renders with no fleet data yet", () => {
    fleet = { locations: undefined as never, isLoading: true, error: null };
    renderAt("/mapv2");
    expect(screen.getByRole("button", { name: /Roster · 0/ })).toBeInTheDocument();
  });
});
