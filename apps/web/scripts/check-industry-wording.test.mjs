import assert from "node:assert/strict";
import test from "node:test";

import { findIndustryWordingViolations } from "./check-industry-wording.mjs";

test("the wording guard detects restaurant terms in English, Russian, and Uzbek", () => {
  const violations = findIndustryWordingViolations("locale.json", {
    english: "Restaurants are not the only business type.",
    russian: "Ресторанный проект",
    uzbek: "Restoranlar uchun",
    cafe: "Kafe",
  });

  assert.deepEqual(
    violations.map(({ term }) => term.toLowerCase()),
    ["restaurants", "ресторанный", "restoranlar", "kafe"],
  );
});

test("the wording guard allows only explicitly marked example strings", () => {
  const violations = findIndustryWordingViolations(
    "apps/web/src/messages/en.json",
    {
      landing: {
        about: { story: { eyebrow: "Restaurant-only instructions" } },
        hero: { description: "Plans for every restaurant." },
      },
      finadvisor: {
        wizard: {
          eyebrow: "Restaurant example",
          formats: { cafe: "Cafe", family: "Family restaurant" },
        },
      },
      sectors: {
        restaurant_cafe: { name: "Restaurant or cafe" },
      },
    },
  );

  assert.deepEqual(
    violations.map(({ path }) => path),
    [
      "landing.about.story.eyebrow",
      "landing.hero.description",
      "finadvisor.wizard.formats.family",
    ],
  );
});
