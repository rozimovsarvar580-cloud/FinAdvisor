import pricingCatalogJson from "../../../api/src/finadvisor_api/pricing_catalog.json";

type PricingPeriod = "weekly" | "monthly" | "yearly";
type FreePlan = {
  id: "free";
  priceByPeriod: Record<PricingPeriod, string>;
  featureKeys: readonly ["onePlan", "basicCalculations", "webPreview"];
  highlighted: false;
};
type ProPlan = {
  id: "pro";
  priceByPeriod: Record<PricingPeriod, string>;
  featureKeys: readonly [
    "aiAnalysis",
    "credit",
    "tax",
    "revenue",
    "profit",
    "calculators",
    "businessPlan"
  ];
  highlighted: true;
};
type BusinessPlan = {
  id: "business";
  priceByPeriod: Record<PricingPeriod, string>;
  featureKeys: readonly [
    "aiAnalysis",
    "credit",
    "tax",
    "revenue",
    "profit",
    "calculators",
    "businessPlan",
    "agentSynergy",
    "desktopAgent",
    "accountantOwnerAccounts"
  ];
  highlighted: false;
};
type PricingCatalog = {
  billingPeriods: readonly PricingPeriod[];
  placeholderMarker: "TODO(DECISION D1)";
  placeholderPeriods: readonly PricingPeriod[];
  plans: readonly [FreePlan, ProPlan, BusinessPlan];
};

const pricingCatalog = pricingCatalogJson as unknown as PricingCatalog;

export const billingPeriods = pricingCatalog.billingPeriods;

export type BillingPeriod = (typeof billingPeriods)[number];

export const pricingPlans = pricingCatalog.plans;

export const placeholderPricingPeriods = pricingCatalog.placeholderPeriods;
export const pricingPlaceholderMarker = pricingCatalog.placeholderMarker;

export const comparisonFeatures = [
  "plans",
  "calculations",
  "aiWriting",
  "exports",
  "collaboration"
] as const;
