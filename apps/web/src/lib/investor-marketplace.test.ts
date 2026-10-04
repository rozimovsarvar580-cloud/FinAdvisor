import { describe, expect, it } from "vitest";

import { filterDeals, summarizeDeals, type MarketplaceDeal } from "./investor-marketplace";

const deals: MarketplaceDeal[] = [
  {
    id: "aziz-cafe",
    title: "Aziz Cafe",
    sector: "Food & Hospitality",
    stage: "Pilot",
    risk: "Medium",
    raised: 250000,
    target: 500000,
    targetReturn: 18,
    summary: "Urban café expansion with delivery-backed demand."
  },
  {
    id: "samarkand-market",
    title: "Samarkand Market",
    sector: "Retail",
    stage: "Scale",
    risk: "Low",
    raised: 420000,
    target: 650000,
    targetReturn: 12,
    summary: "Fresh food retail chain in a dense central district."
  },
  {
    id: "qoshqadsay-logs",
    title: "Qoshqadsay Logistics",
    sector: "Logistics",
    stage: "Idea",
    risk: "High",
    raised: 90000,
    target: 300000,
    targetReturn: 26,
    summary: "Regional food logistics and cold-chain network."
  }
];

describe("filterDeals", () => {
  it("filters by sector, stage, and risk together", () => {
    const result = filterDeals(deals, {
      sector: "Food & Hospitality",
      stage: "Pilot",
      risk: "Medium"
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("aziz-cafe");
  });

  it("accepts the all selector for each filter", () => {
    const result = filterDeals(deals, {
      sector: "all",
      risk: "all",
      stage: "all"
    });

    expect(result).toHaveLength(3);
  });
});

describe("summarizeDeals", () => {
  it("adds the pipeline totals and average target return", () => {
    const summary = summarizeDeals(deals);

    expect(summary.totalDeals).toBe(3);
    expect(summary.totalRaised).toBe(760000);
    expect(summary.totalTarget).toBe(1450000);
    expect(summary.averageReturn).toBe(18.7);
  });
});
