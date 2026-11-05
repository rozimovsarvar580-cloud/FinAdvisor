import { BillingPage } from "@/components/billing/billing-page";

export default function BillingRoute({
  searchParams
}: {
  searchParams: { plan?: string; period?: string };
}) {
  return (
    <BillingPage
      initialPlan={searchParams.plan}
      initialPeriod={searchParams.period}
    />
  );
}
