import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders an accessible button and invokes its click handler", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save changes</Button>);

    const button = screen.getByRole("button", { name: "Save changes" });
    fireEvent.click(button);

    expect(button).toBeTruthy();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not invoke its click handler when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save changes
      </Button>
    );

    const button = screen.getByRole("button", { name: "Save changes" });
    fireEvent.click(button);

    expect(button.hasAttribute("disabled")).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each([
    ["primary", "bg-primary"],
    ["gradient", "bg-[image:var(--gradient-brand)]"],
    ["accent", "bg-accent"],
    ["outline", "border-border"],
    ["ghost", "hover:bg-primary/10"]
  ] as const)("applies the %s variant", (variant, className) => {
    render(<Button variant={variant}>Action</Button>);

    expect(screen.getByRole("button", { name: "Action" }).className).toContain(
      className
    );
  });

  it.each([
    ["sm", "h-9 px-3"],
    ["md", "h-10 px-4 py-2"],
    ["lg", "h-11 px-8"]
  ] as const)("applies the %s size", (size, className) => {
    render(<Button size={size}>Action</Button>);

    expect(screen.getByRole("button", { name: "Action" }).className).toContain(
      className
    );
  });

  it("supports hover, press, focus-visible, and reduced-motion states", () => {
    render(<Button>Action</Button>);
    const button = screen.getByRole("button", { name: "Action" });

    expect(button.className).toContain("motion-safe:hover:-translate-y-0.5");
    expect(button.className).toContain("motion-safe:active:scale-[0.97]");
    expect(button.className).toContain("focus-visible:ring-2");
    expect(button.className).toContain("hover:shadow-xl");
    expect(button.className).toContain("motion-reduce:transition-none");
  });

  it("shows a decorative loading indicator and prevents interaction while loading", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save changes
      </Button>
    );
    const button = screen.getByRole("button", {
      name: "Save changes"
    }) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.querySelector('[aria-hidden="true"]')).not.toBeNull();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
