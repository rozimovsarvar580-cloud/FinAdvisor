export const billingPeriods = ["weekly", "monthly", "yearly"] as const;

export type BillingPeriod = (typeof billingPeriods)[number];

export const pricingPlans = [
  {
    id: "free",
    priceByPeriod: {
      weekly: "$0",
      monthly: "$0",
      yearly: "$0"
    },
    featureKeys: ["onePlan", "basicCalculations", "webPreview"],
    highlighted: false
  },
  {
    id: "pro",
    priceByPeriod: {
      weekly: "$10",
      monthly: "$40",
      yearly: "$480"
    },
    featureKeys: ["unlimitedPlans", "aiPlanWriting", "documentExport"],
    highlighted: true
  },
  {
    id: "business",
    priceByPeriod: {
      weekly: "$20",
      monthly: "$80",
      yearly: "$960"
    },
    featureKeys: ["teamAccess", "advancedReports", "prioritySupport"],
    highlighted: false
  }
] as const;

export const comparisonFeatures = [
  "plans",
  "calculations",
  "aiWriting",
  "exports",
  "collaboration"
] as const;
