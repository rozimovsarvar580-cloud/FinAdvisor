export type ListingStage = "idea" | "pilot" | "scale";

export type MarketplaceListing = {
  id: string;
  plan_id: string | null;
  business_name: string;
  city: string;
  stage: ListingStage;
  funding_target: string;
  currency: "UZS";
  summary: string;
  is_published: boolean;
  created_at: string;
};

export type MarketplaceListingDetail = MarketplaceListing & {
  plan: {
    summary: string;
    sections: { title: string; content: string }[];
    calculations: Record<string, string | number | null>;
  };
};

export type ListingFilters = {
  stage?: ListingStage | "all";
};

export function filterListings(
  listings: MarketplaceListing[],
  filters: ListingFilters = {}
): MarketplaceListing[] {
  const { stage } = filters;
  return listings.filter(
    (listing) => !stage || stage === "all" || listing.stage === stage
  );
}

export function summarizeListings(listings: MarketplaceListing[]) {
  return { totalListings: listings.length };
}

export function formatMoneyString(value: string): string {
  const [integer, fraction] = value.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return fraction ? `${grouped},${fraction}` : grouped;
}
