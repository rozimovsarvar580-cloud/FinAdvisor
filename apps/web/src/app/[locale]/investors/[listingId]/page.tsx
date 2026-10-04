import { InvestorMarketplaceListing } from "@/components/investor-marketplace-listing";

export default function InvestorListingPage({
  params
}: {
  params: { listingId: string };
}) {
  return <InvestorMarketplaceListing listingId={params.listingId} />;
}
