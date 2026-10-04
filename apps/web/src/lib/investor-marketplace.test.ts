import { describe, expect, it } from "vitest";

import {
  filterListings,
  formatMoneyString,
  summarizeListings,
  type MarketplaceListing
} from "./investor-marketplace";

const listings: MarketplaceListing[] = [
  {
    id: "project-1",
    business_name: "Samarqand Oshxona",
    city: "Samarqand",
    stage: "pilot",
    funding_target: "250000000.00",
    currency: "UZS",
    summary: "Owner provided restaurant project summary.",
    is_published: true,
    created_at: "2026-10-04T08:00:00Z"
  },
  {
    id: "project-2",
    business_name: "Toshkent Bistro",
    city: "Toshkent",
    stage: "scale",
    funding_target: "1250000000",
    currency: "UZS",
    summary: "Owner provided restaurant project summary.",
    is_published: true,
    created_at: "2026-10-03T08:00:00Z"
  }
];

describe("filterListings", () => {
  it("filters by stage", () => {
    const result = filterListings(listings, { stage: "pilot" });
    expect(result.map((listing) => listing.id)).toEqual(["project-1"]);
  });

  it("returns all listings for the all selector", () => {
    expect(filterListings(listings, { stage: "all" })).toHaveLength(2);
  });
});

describe("summarizeListings", () => {
  it("counts listings without computing financial figures", () => {
    expect(summarizeListings(listings)).toEqual({ totalListings: 2 });
    expect(summarizeListings([])).toEqual({ totalListings: 0 });
  });
});

describe("formatMoneyString", () => {
  it("groups integer and fractional digits without converting to floating point", () => {
    expect(formatMoneyString("1250000000.50")).toBe("1 250 000 000,50");
    expect(formatMoneyString("250000000")).toBe("250 000 000");
  });
});
