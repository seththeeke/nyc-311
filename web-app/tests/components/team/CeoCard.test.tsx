import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CeoCard } from "../../../src/components/team/CeoCard";
import { CEO_ID, memberById } from "../../../src/components/team/teamRoster";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CeoCard", () => {
  it("shows the photo, tagline and links, then shrinks to a bar once scrolled past", () => {
    let report: (entries: { isIntersecting: boolean }[]) => void = () => undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
          report = callback;
        }
        observe(): void {}
        disconnect(): void {}
      },
    );
    render(<CeoCard member={memberById(CEO_ID)!} />);
    const card = screen.getByRole("region", { name: "Chief Executive Officer" });
    expect(card.className).toContain("sticky");
    expect(screen.getByRole("img", { name: "Seth Theeke" })).toHaveAttribute("src", "/team/seth-theeke.jpeg");
    expect(screen.getByText("Creator, builder, learning as much as possible")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/seththeeke");
    expect(screen.getByRole("link", { name: "LinkedIn" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View Contributions" })).not.toBeInTheDocument();

    act(() => report([{ isIntersecting: true }]));
    act(() => report([{ isIntersecting: false }]));
    expect(card.className).toContain("py-2");
    expect(screen.queryByText("Creator, builder, learning as much as possible")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Seth Theeke" }).className).toContain("size-9");
  });

  it("gives back the height it loses as a bottom margin, so the page below doesn't jump", () => {
    let report: (entries: { isIntersecting: boolean }[]) => void = () => undefined;
    let resized: () => void = () => undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
          report = callback;
        }
        observe(): void {}
        disconnect(): void {}
      },
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe(): void {}
        disconnect = disconnect;
      },
    );
    let height = 120;
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(() => height);
    const { unmount } = render(<CeoCard member={memberById(CEO_ID)!} />);
    const card = screen.getByRole("region", { name: "Chief Executive Officer" });
    act(() => resized());
    expect(card.style.marginBottom).toBe("0px");

    act(() => report([{ isIntersecting: true }]));
    act(() => report([{ isIntersecting: false }]));
    height = 52;
    act(() => resized());
    expect(card.style.marginBottom).toBe("68px");

    act(() => window.dispatchEvent(new Event("resize")));
    act(() => report([{ isIntersecting: true }]));
    height = 100;
    act(() => window.dispatchEvent(new Event("resize")));
    act(() => resized());
    expect(card.style.marginBottom).toBe("0px");

    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("skips the height tracking without a ResizeObserver", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    render(<CeoCard member={memberById(CEO_ID)!} />);
    expect(screen.getByRole("region", { name: "Chief Executive Officer" }).style.marginBottom).toBe("0px");
  });

  it("leaves out the photo when there isn't one", () => {
    render(<CeoCard member={{ ...memberById(CEO_ID)!, photo_url: null }} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
