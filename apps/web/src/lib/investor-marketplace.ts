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
  status: "draft" | "published" | "archived";
  public_financial_fields: string[];
  request_financial_fields: string[];
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
  city?: string;
  minFunding?: string;
  maxFunding?: string;
};

export function filterListings(
  listings: MarketplaceListing[],
  filters: ListingFilters = {}
): MarketplaceListing[] {
  const { stage, city, minFunding, maxFunding } = filters;
  return listings.filter(
    (listing) => (!stage || stage === "all" || listing.stage === stage)
      && (!city || listing.city.toLocaleLowerCase().includes(city.toLocaleLowerCase()))
      && (!minFunding || compareMoney(listing.funding_target, minFunding) >= 0)
      && (!maxFunding || compareMoney(listing.funding_target, maxFunding) <= 0)
  );
}

function compareMoney(left: string, right: string): number {
  const normalize = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return `${whole.replace(/^0+(?=\d)/, "")}.${fraction.padEnd(2, "0").slice(0, 2)}`;
  };
  const a = normalize(left);
  const b = normalize(right);
  return a.length === b.length ? a.localeCompare(b) : a.length - b.length;
}

export function paginateListings<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  return { items: items.slice((currentPage - 1) * pageSize, currentPage * pageSize), currentPage, totalPages };
}

export function summarizeListings(listings: MarketplaceListing[]) {
  return { totalListings: listings.length };
}

export function formatMoneyString(value: string): string {
  const [integer, fraction] = value.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return fraction ? `${grouped},${fraction}` : grouped;
}
