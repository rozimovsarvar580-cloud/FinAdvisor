import { describe, expect, it } from "vitest";

import { mockBillingProvider } from "./billing";

describe("mockBillingProvider", () => {
  it("returns the documented mock subscription state", () => {
    expect(mockBillingProvider.getSubscription()).toEqual({
      planId: "pro",
      status: "active",
      billingPeriod: "monthly"
    });
  });
});
