import { describe, expect, it } from "vitest";

import { buildMetadata, buildSitemapEntries } from "./site-metadata";

describe("buildMetadata", () => {
  it("includes locale-specific canonical metadata and alternates", () => {
    const metadata = buildMetadata({ locale: "ru", pathname: "/pricing" });

    expect(metadata.title).toContain("FinAdvisor");
    expect(metadata.alternates?.canonical).toContain("/ru/pricing");
    expect(metadata.alternates?.languages?.en).toContain("/en/pricing");
    expect(metadata.openGraph?.locale).toBe("ru");
  });
});

describe("buildSitemapEntries", () => {
  it("returns one sitemap entry per locale and route", () => {
    const entries = buildSitemapEntries();

    expect(entries.length).toBeGreaterThan(6);
    expect(entries.some((entry) => entry.url.includes("/uz/"))).toBe(true);
    expect(entries.some((entry) => entry.url.includes("/ru/pricing"))).toBe(true);
  });
});
