import type { BillingPeriod } from "../config/pricing";

export type SubscriptionStatus = "active" | "trial" | "inactive";

export type Subscription = {
  planId: "free" | "pro" | "business";
  status: SubscriptionStatus;
  billingPeriod: BillingPeriod;
};

export interface BillingProvider {
  getSubscription(): Subscription;
}

export const mockBillingProvider: BillingProvider = {
  getSubscription() {
    return {
      planId: "pro",
      status: "active",
      billingPeriod: "monthly"
    };
  }
};
