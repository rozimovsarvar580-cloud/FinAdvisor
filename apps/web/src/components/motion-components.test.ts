import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CountUp,
  Marquee,
  Reveal,
  StaggerList
} from "@/components/motion-components";
import { Button } from "@/components/ui/button";

describe("design system motion and button components", () => {
  it("renders all motion components with their children", () => {
    const markup = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(Reveal, null, createElement("span", null, "Reveal")),
        createElement(
          StaggerList,
          null,
          createElement("span", null, "First"),
          createElement("span", null, "Second")
        ),
        createElement(CountUp, { value: 42, locale: "en-US" }),
        createElement(Marquee, null, createElement("span", null, "Marquee"))
      )
    );

    expect(markup).toContain("Reveal");
    expect(markup).toContain("First");
    expect(markup).toContain("Second");
    expect(markup).toContain("Marquee");
    expect(markup).toContain("0");
  });

  it("supports the approved interactive button variants", () => {
    const variants = ["primary", "gradient", "accent", "outline", "ghost"] as const;
    const markup = variants
      .map((variant) =>
        renderToStaticMarkup(
          createElement(Button, { key: variant, variant }, variant)
        )
      )
      .join("");

    expect(markup).toContain("hover:-translate-y-0.5");
    expect(markup).toContain("active:scale-[0.97]");
    expect(markup).toContain("bg-[image:var(--gradient-brand)]");
    expect(markup).toContain("bg-accent");
  });
});
