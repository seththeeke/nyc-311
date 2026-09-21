import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { TooltipLayer, tooltipTextFor } from "../../../src/components/shell/TooltipLayer";

function renderLayer() {
  return render(
    <div>
      <TooltipLayer />
      <button aria-label="Hide secondary panel">
        <svg data-testid="icon" />
      </button>
      <button>Save</button>
      <button data-tooltip="Custom hint">x</button>
      <button title="Native title">Titled</button>
      <button>{"long ".repeat(30)}</button>
      <a href="/somewhere">Somewhere</a>
      <em>not clickable</em>
      <span data-testid="plain">plain text</span>
    </div>,
  );
}

const hover = (el: Element) => fireEvent.pointerOver(el);
const settle = () => act(() => void vi.advanceTimersByTime(400));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("tooltipTextFor", () => {
  it("prefers data-tooltip, then aria-label, then visible text", () => {
    const el = document.createElement("button");
    el.textContent = "Visible";
    expect(tooltipTextFor(el)).toBe("Visible");
    el.setAttribute("aria-label", "Labelled");
    expect(tooltipTextFor(el)).toBe("Labelled");
    el.setAttribute("data-tooltip", "Explicit");
    expect(tooltipTextFor(el)).toBe("Explicit");
  });

  it("collapses whitespace, and returns null for empty, over-long, or natively-titled elements", () => {
    const el = document.createElement("button");
    el.textContent = "  two   words \n";
    expect(tooltipTextFor(el)).toBe("two words");
    el.textContent = "";
    expect(tooltipTextFor(el)).toBeNull();
    el.textContent = "x".repeat(81);
    expect(tooltipTextFor(el)).toBeNull();
    el.textContent = "ok";
    el.setAttribute("title", "native");
    expect(tooltipTextFor(el)).toBeNull();
  });
});

describe("TooltipLayer", () => {
  it("shows an icon-only button's aria-label after a short delay, not instantly", () => {
    renderLayer();
    hover(screen.getByTestId("icon"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    settle();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Hide secondary panel");
  });

  it("shows visible text for a text button and for a link, and data-tooltip when present", () => {
    renderLayer();
    hover(screen.getByRole("button", { name: "Save" }));
    settle();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Save");
    hover(screen.getByRole("link", { name: "Somewhere" }));
    settle();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Somewhere");
    hover(screen.getByRole("button", { name: "x" }));
    settle();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Custom hint");
  });

  it("shows nothing for non-clickable elements, native-title buttons, or over-long labels", () => {
    renderLayer();
    for (const el of [screen.getByTestId("plain"), screen.getByText("not clickable"), screen.getByRole("button", { name: "Titled" })]) {
      hover(el);
      settle();
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    }
    hover(screen.getByRole("button", { name: /long long/ }));
    settle();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("cancels a pending tooltip if the pointer leaves before the delay", () => {
    renderLayer();
    const save = screen.getByRole("button", { name: "Save" });
    hover(save);
    fireEvent.pointerOut(save, { relatedTarget: document.body });
    settle();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hides when the pointer leaves, but not when moving between children of the same control", () => {
    renderLayer();
    const button = screen.getByRole("button", { name: "Hide secondary panel" });
    hover(screen.getByTestId("icon"));
    settle();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.pointerOut(screen.getByTestId("icon"), { relatedTarget: button });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    hover(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.pointerOut(button, { relatedTarget: document.body });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hides on click, on Escape, and on scroll", () => {
    renderLayer();
    const save = screen.getByRole("button", { name: "Save" });
    const show = () => {
      fireEvent.pointerOut(save, { relatedTarget: document.body });
      hover(save);
      settle();
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    };

    show();
    fireEvent.pointerDown(save);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    show();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    show();
    fireEvent.keyDown(document, { key: "a" });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.scroll(window);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("moving straight to another control swaps the tooltip", () => {
    renderLayer();
    hover(screen.getByRole("button", { name: "Save" }));
    settle();
    hover(screen.getByRole("link", { name: "Somewhere" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    settle();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Somewhere");
  });

  it("positions the bubble inside the viewport, flipping above when there's no room below", () => {
    renderLayer();
    const save = screen.getByRole("button", { name: "Save" });
    save.getBoundingClientRect = () => ({ top: 760, bottom: 780, left: 2, right: 42, width: 40, height: 20, x: 2, y: 760, toJSON: () => ({}) });
    vi.stubGlobal("innerHeight", 790);
    hover(save);
    settle();
    const bubble = screen.getByRole("tooltip");
    expect(bubble.style.visibility).toBe("visible");
    expect(Number.parseFloat(bubble.style.left)).toBeGreaterThanOrEqual(8);
    /* jsdom-style zero-size bubble: above = anchor.top - gap - height. */
    expect(Number.parseFloat(bubble.style.top)).toBe(752);
    vi.unstubAllGlobals();
  });

  it("stops listening on unmount", () => {
    const { unmount } = renderLayer();
    unmount();
    expect(() => fireEvent.pointerOver(document.body)).not.toThrow();
  });
});
