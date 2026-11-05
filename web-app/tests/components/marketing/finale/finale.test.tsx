import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CityStrip, PASS_MS, PATCH_LINES } from "../../../../src/components/marketing/finale/CityStrip";
import { PatchMascot } from "../../../../src/components/marketing/finale/PatchMascot";
import { FinalCta } from "../../../../src/components/marketing/FinalCta";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PatchMascot", () => {
  it("is a named image", () => {
    render(<PatchMascot />);
    expect(screen.getByRole("img", { name: "Patch, the BoroughSim repair truck" })).toBeInTheDocument();
  });
});

describe("CityStrip", () => {
  it("has Patch say a new line on every pothole pass while playing", () => {
    vi.useFakeTimers();
    render(<CityStrip playing={true} />);
    expect(screen.getByText(PATCH_LINES[0])).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(PASS_MS));
    expect(screen.getByText(PATCH_LINES[1])).toBeInTheDocument();
  });

  it("holds its first line when not playing", () => {
    vi.useFakeTimers();
    render(<CityStrip playing={false} />);
    act(() => vi.advanceTimersByTime(PASS_MS * 3));
    expect(screen.getByText(PATCH_LINES[0])).toBeInTheDocument();
  });
});

describe("FinalCta", () => {
  it("closes on a large Enter fleet over Patch's street", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const onEnter = vi.fn();
    render(<FinalCta onEnter={onEnter} reducedMotion={false} />);
    expect(screen.getByRole("heading", { level: 2, name: "The city is moving right now." })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Patch/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Enter fleet/ }));
    expect(onEnter).toHaveBeenCalled();
  });
});
