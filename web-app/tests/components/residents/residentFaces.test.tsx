import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const faces = vi.hoisted(() => ({ snapshot: null as string | null, webGl: true }));

vi.mock("../../../src/hooks/useResidentAvatar", () => ({ useResidentAvatar: () => faces.snapshot }));
vi.mock("../../../src/components/three/webgl", () => ({ isWebGlAvailable: () => faces.webGl }));
vi.mock("../../../src/components/residents/ResidentStage", () => ({
  default: ({ name }: { name: string }) => <canvas role="img" aria-label={`${name}, waving`} />,
}));

import { PersonaAvatar } from "../../../src/components/residents/PersonaAvatar";
import { PersonaSpotlight } from "../../../src/components/residents/PersonaSpotlight";
import { MOCK_RESIDENT_PERSONAS } from "../../../src/test-data/residentPersonas";

const juniper = MOCK_RESIDENT_PERSONAS[2];

beforeEach(() => {
  faces.snapshot = null;
  faces.webGl = true;
});

describe("PersonaAvatar with a model", () => {
  it("shows the snapshot instead of the initial once one is drawn", () => {
    faces.snapshot = "data:image/png;base64,J";
    const { container } = render(<PersonaAvatar name="Juniper" modelKey="juniper" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "data:image/png;base64,J");
    expect(container.firstChild).not.toHaveTextContent("J");
  });
});

describe("PersonaSpotlight", () => {
  it("stands the resident, waving, beside their profile", async () => {
    render(<PersonaSpotlight persona={juniper} onClose={() => undefined} />);
    expect(await screen.findByRole("img", { name: "Juniper, waving" })).toBeInTheDocument();
    expect(screen.getByText(juniper.backstory)).toBeInTheDocument();
  });

  it("falls back to the large avatar without WebGL or without a model", () => {
    faces.webGl = false;
    const { container, unmount } = render(<PersonaSpotlight persona={juniper} onClose={() => undefined} />);
    expect(screen.queryByRole("img", { name: "Juniper, waving" })).not.toBeInTheDocument();
    expect(container.querySelector(".h-12")).toHaveTextContent("J");
    unmount();
    faces.webGl = true;
    render(<PersonaSpotlight persona={{ ...juniper, model_key: null }} onClose={() => undefined} />);
    expect(screen.queryByRole("img", { name: "Juniper, waving" })).not.toBeInTheDocument();
  });
});
