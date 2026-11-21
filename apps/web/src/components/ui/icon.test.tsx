import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Icon, type IconName } from "./icon";

const iconNames: IconName[] = [
  "arrowRight",
  "bank",
  "briefcase",
  "chart",
  "check",
  "close",
  "coins",
  "document",
  "fileCheck",
  "download",
  "menu",
  "moon",
  "plus",
  "shuffle",
  "sparkles",
  "sun",
  "target",
  "users",
  "wallet"
];

describe("Icon", () => {
  it.each(iconNames)(
    "renders %s with shared decorative SVG styling",
    (name) => {
      const { container } = render(<Icon name={name} />);
      const svg = container.querySelector("svg");

      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(svg?.getAttribute("stroke")).toBe("currentColor");
      expect(svg?.getAttribute("stroke-width")).toBe("1.8");
      expect(svg?.querySelectorAll("path").length).toBeGreaterThan(0);
    }
  );
});
