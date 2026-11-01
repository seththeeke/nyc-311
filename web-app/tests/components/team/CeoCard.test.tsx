import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CeoCard } from "../../../src/components/team/CeoCard";
import { CEO_ID, memberById } from "../../../src/components/team/teamRoster";

afterEach(() => vi.unstubAllGlobals());

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

  it("leaves out the photo when there isn't one", () => {
    render(<CeoCard member={{ ...memberById(CEO_ID)!, photo_url: null }} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
