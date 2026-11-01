import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useInView } from "../../../src/components/team/useInView";

function Probe({ attach = true }: { attach?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { inView, seen } = useInView(ref);
  return <div ref={attach ? ref : undefined}>{`${inView} ${seen}`}</div>;
}

afterEach(() => vi.unstubAllGlobals());

describe("useInView", () => {
  it("tracks the element in and out of view, and remembers it was seen", () => {
    let report: (entries: { isIntersecting: boolean }[]) => void = () => undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
          report = callback;
        }
        observe(): void {}
        disconnect = disconnect;
      },
    );
    const { unmount } = render(<Probe />);
    expect(screen.getByText("false false")).toBeInTheDocument();
    act(() => report([{ isIntersecting: true }]));
    expect(screen.getByText("true true")).toBeInTheDocument();
    act(() => report([{ isIntersecting: false }]));
    expect(screen.getByText("false true")).toBeInTheDocument();
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("counts everything as in view without IntersectionObserver, and waits for an element", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe />);
    expect(screen.getByText("true true")).toBeInTheDocument();
    render(<Probe attach={false} />);
    expect(screen.getByText("false false")).toBeInTheDocument();
  });
});
