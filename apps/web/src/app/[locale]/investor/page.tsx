import { InvestorBriefPage } from "@/components/investor-brief/investor-brief-page";

export function generateStaticParams() {
  return ["uz", "ru", "en"].map((locale) => ({ locale }));
}

export default function InvestorPage() {
  return <InvestorBriefPage />;
}
