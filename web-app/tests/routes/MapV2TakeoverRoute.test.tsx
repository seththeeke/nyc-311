import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useFeatureTreatment } from "../../src/hooks/useFeatureTreatment";
import { isWebGlAvailable } from "../../src/components/three/webgl";
import { MapV2TakeoverRoute } from "../../src/routes/MapV2TakeoverRoute";

vi.mock("../../src/hooks/useFeatureTreatment", () => ({ useFeatureTreatment: vi.fn() }));
vi.mock("../../src/components/three/webgl", () => ({ isWebGlAvailable: vi.fn(() => true) }));

function renderWith(treatment: string | null | undefined, webGl = true) {
  vi.mocked(useFeatureTreatment).mockReturnValue({ treatment, isLoading: treatment === undefined });
  vi.mocked(isWebGlAvailable).mockReturnValue(webGl);
  render(<MapV2TakeoverRoute classic={<p>classic</p>} takeover={<p>takeover</p>} />);
}

describe("MapV2TakeoverRoute", () => {
  it("hands the route to Mapv2 on MAP_V2 = T2", () => {
    renderWith("T2");
    expect(screen.getByText("takeover")).toBeInTheDocument();
    expect(useFeatureTreatment).toHaveBeenCalledWith("MAP_V2");
  });

  it.each([["C"], ["T1"], [null], [undefined]])("keeps the classic map on %s (loading included, so it never waits)", (treatment) => {
    renderWith(treatment);
    expect(screen.getByText("classic")).toBeInTheDocument();
  });

  it("keeps the classic map on T2 when WebGL2 is unavailable", () => {
    renderWith("T2", false);
    expect(screen.getByText("classic")).toBeInTheDocument();
  });
});
