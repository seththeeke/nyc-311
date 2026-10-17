import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { RecordingPlayer, STEP_PLAYBACK_MS } from "../../../src/components/residents/RecordingPlayer";

const recording = {
  video_url: null,
  captions_url: null,
  duration_seconds: 72,
  steps: [
    { at_seconds: 0, description: "Opens boroughsim.com" },
    { at_seconds: 24, description: "Clicks the pothole pin" },
    { at_seconds: 70, description: "Closes the tab" },
  ],
};

const caption = () => screen.getByText((_, element) => element?.getAttribute("aria-live") === "polite").textContent;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RecordingPlayer — step replay", () => {
  it("starts on the first step, plays through every step, and stops at the end", () => {
    render(<RecordingPlayer recording={recording} />);
    expect(caption()).toBe("Opens boroughsim.com");
    expect(screen.getByText("0:00 / 1:12")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => vi.advanceTimersByTime(STEP_PLAYBACK_MS));
    expect(caption()).toBe("Clicks the pothole pin");
    act(() => vi.advanceTimersByTime(STEP_PLAYBACK_MS * 3));
    expect(caption()).toBe("Closes the tab");
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("pauses, jumps to a step, and replays from the start once finished", () => {
    render(<RecordingPlayer recording={recording} />);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    act(() => vi.advanceTimersByTime(STEP_PLAYBACK_MS * 2));
    expect(caption()).toBe("Opens boroughsim.com");

    fireEvent.click(screen.getByRole("button", { name: "Jump to 1:10: Closes the tab" }));
    expect(caption()).toBe("Closes the tab");
    expect(screen.getByRole("button", { name: "Jump to 1:10: Closes the tab" })).toHaveAttribute("aria-current", "step");

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(caption()).toBe("Opens boroughsim.com");
  });
});

describe("RecordingPlayer — real recording", () => {
  it("plays the captured video, with captions when there are any", () => {
    const { container, rerender } = render(
      <RecordingPlayer recording={{ ...recording, video_url: "https://example.com/session.mp4", captions_url: "https://example.com/session.vtt" }} />,
    );
    expect(container.querySelector("video")).toHaveAttribute("src", "https://example.com/session.mp4");
    expect(container.querySelector("track")).toHaveAttribute("src", "https://example.com/session.vtt");
    rerender(<RecordingPlayer recording={{ ...recording, video_url: "https://example.com/session.mp4" }} />);
    expect(container.querySelector("track")).not.toHaveAttribute("src");
  });
});
