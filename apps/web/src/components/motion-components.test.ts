import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("design system button components", () => {
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
