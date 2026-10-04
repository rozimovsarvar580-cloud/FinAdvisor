export type MarketplaceDeal = {
  id: string;
  title: string;
  sector: string;
  stage: "Idea" | "Pilot" | "Scale";
  risk: "Low" | "Medium" | "High";
  raised: number;
  target: number;
  targetReturn: number;
  summary: string;
};

export type DealFilters = {
  sector?: string;
  stage?: string;
  risk?: string;
};

export function filterDeals(
  deals: MarketplaceDeal[],
  filters: DealFilters = {}
): MarketplaceDeal[] {
  const { sector, stage, risk } = filters;

  return deals.filter((deal) => {
    if (sector && sector !== "all" && deal.sector !== sector) {
      return false;
    }

    if (stage && stage !== "all" && deal.stage !== stage) {
      return false;
    }

    if (risk && risk !== "all" && deal.risk !== risk) {
      return false;
    }

    return true;
  });
}

export function summarizeDeals(deals: MarketplaceDeal[]) {
  const totalRaised = deals.reduce((sum, deal) => sum + deal.raised, 0);
  const totalTarget = deals.reduce((sum, deal) => sum + deal.target, 0);
  const averageReturn =
    deals.length > 0
      ? deals.reduce((sum, deal) => sum + deal.targetReturn, 0) / deals.length
      : 0;

  return {
    totalDeals: deals.length,
    totalRaised,
    totalTarget,
    averageReturn: Number(averageReturn.toFixed(1))
  };
}
