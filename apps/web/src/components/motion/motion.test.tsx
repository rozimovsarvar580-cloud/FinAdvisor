import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({
  reduceMotion: false,
  animate: vi.fn(() => ({ stop: vi.fn() }))
}));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    animate: motionState.animate,
    useReducedMotion: () => motionState.reduceMotion
  };
});

import { CountUp } from "@/components/motion/count-up";
import { Marquee } from "@/components/motion/marquee";
import { Reveal } from "@/components/motion/reveal";
import { Stagger, StaggerList } from "@/components/motion/stagger";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  motionState.reduceMotion = false;
  motionState.animate.mockClear();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
  );
});

describe("motion kit", () => {
  it("reveals children while rendering them directly when reduced motion is enabled", () => {
    motionState.reduceMotion = true;

    const { container } = render(
      <Reveal className="reveal">
        <span>Reveal content</span>
      </Reveal>
    );

    expect(screen.getByText("Reveal content")).toBeTruthy();
    expect(container.firstElementChild?.classList.contains("reveal")).toBe(true);
    expect((container.firstElementChild as HTMLElement).style.opacity).not.toBe("0");
  });

  it("applies the reveal entrance state when motion is enabled", () => {
    const { container } = render(
      <Reveal>
        <span>Animated reveal</span>
      </Reveal>
    );

    expect(screen.getByText("Animated reveal")).toBeTruthy();
    expect((container.firstElementChild as HTMLElement).style.opacity).toBe("0");
  });

  it("renders stagger children without animation wrappers when reduced motion is enabled", () => {
    motionState.reduceMotion = true;

    const { container } = render(
      <Stagger className="items">
        <p>First item</p>
        <p>Second item</p>
      </Stagger>
    );

    expect(screen.getByText("First item")).toBeTruthy();
    expect(screen.getByText("Second item")).toBeTruthy();
    expect(container.firstElementChild?.classList.contains("grid")).toBe(true);
    expect(container.firstElementChild?.classList.contains("items")).toBe(true);
    expect(container.firstElementChild?.children).toHaveLength(2);
    expect(container.firstElementChild?.firstElementChild?.tagName).toBe("P");
  });

  it("wraps stagger items for the animated sequence when motion is enabled", () => {
    const { container } = render(
      <Stagger>
        <p>Animated first</p>
        <p>Animated second</p>
      </Stagger>
    );

    expect(screen.getByText("Animated first")).toBeTruthy();
    expect(screen.getByText("Animated second")).toBeTruthy();
    expect(container.firstElementChild?.children).toHaveLength(2);
    expect(container.firstElementChild?.firstElementChild?.tagName).toBe("DIV");
  });

  it("retains the StaggerList compatibility export", () => {
    expect(StaggerList).toBe(Stagger);
  });

  it("formats the final value and skips animation when reduced motion is enabled", () => {
    motionState.reduceMotion = true;

    render(<CountUp value={1234} locale="en-US" suffix=" UZS" />);

    expect(screen.getByText("1,234 UZS")).toBeTruthy();
    expect(motionState.animate).not.toHaveBeenCalled();
  });

  it("animates and formats the requested numeric value", () => {
    render(<CountUp value={42} locale="en-US" duration={2} />);

    expect(screen.getByText("0")).toBeTruthy();
    expect(motionState.animate).toHaveBeenCalledWith(
      0,
      42,
      expect.objectContaining({ duration: 2 })
    );
  });

  it("renders marquee content once without clipping when reduced motion is enabled", () => {
    motionState.reduceMotion = true;

    const { container } = render(
      <Marquee className="logos">
        <span>Brand</span>
      </Marquee>
    );

    expect(screen.getByText("Brand")).toBeTruthy();
    expect(container.querySelectorAll("span")).toHaveLength(1);
    expect(container.firstElementChild?.classList.contains("logos")).toBe(true);
    expect(
      container.firstElementChild?.classList.contains("overflow-hidden")
    ).toBe(false);
  });

  it("duplicates marquee items only for the animated loop", () => {
    const { container } = render(
      <Marquee>
        <span>Brand</span>
      </Marquee>
    );

    expect(container.querySelectorAll("span")).toHaveLength(2);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
