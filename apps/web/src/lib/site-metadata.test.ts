import { describe, expect, it } from "vitest";

import {
  buildMetadata,
  buildProductStructuredData,
  buildSitemapEntries
} from "./site-metadata";

describe("buildMetadata", () => {
  it("includes locale-specific canonical metadata and alternates", () => {
    const metadata = buildMetadata({ locale: "ru", pathname: "/pricing" });

    expect(metadata.title).toContain("FinAdvisor");
    expect(metadata.alternates?.canonical).toContain("/ru/pricing");
    expect(metadata.alternates?.languages?.en).toContain("/en/pricing");
    expect(metadata.openGraph?.locale).toBe("ru");
    expect(metadata.title).toContain("Управляйте бизнесом уверенно, опираясь на цифры");
    expect(metadata.description).toContain("Составьте финансовый план ресторана");
  });
});

describe("buildProductStructuredData", () => {
  it("returns localized product structured data without invented pricing", () => {
    const data = buildProductStructuredData("uz");

    expect(data["@type"]).toBe("SoftwareApplication");
    expect(data.inLanguage).toBe("uz");
    expect(data.url).toContain("/uz");
    expect(data.description).toContain("Restoraningiz uchun moliyaviy reja");
    expect(data).not.toHaveProperty("offers");
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
