import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { describe, expect, it } from "vitest";

import enMessages from "@/messages/en.json";

import {
  TaxRuleProvenanceList,
  type TaxRuleProvenance
} from "./tax-rule-provenance";

function renderRules(rules: TaxRuleProvenance[]) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={enMessages as unknown as AbstractIntlMessages}
    >
      <TaxRuleProvenanceList sourceName="Official source" rules={rules} />
    </NextIntlClientProvider>
  );
}

describe("tax rule provenance", () => {
  it("labels an unverified tax rule as an estimate", () => {
    renderRules([
      {
        key: "turnover_tax",
        rate: "0.04",
        source_url: "https://example.test/tax",
        effective_date: "TODO(VERIFY)",
        verified: false,
        verified_by: null
      }
    ]);

    expect(screen.getByText("Estimate — not verified")).toBeDefined();
    expect(screen.getByText("Configured rate: 0.04%")).toBeDefined();
    expect(screen.getByRole("link", { name: "Official source" }).getAttribute("href"))
      .toBe("https://example.test/tax");
    expect(screen.queryByText(/Verified by:/)).toBeNull();
  });

  it("shows the verifier only for a verified rule", () => {
    renderRules([
      {
        key: "profit_tax",
        rate: "0.15",
        source_url: "https://example.test/profit-tax",
        effective_date: "2026-01-01",
        verified: true,
        verified_by: "official review"
      }
    ]);

    expect(screen.getByText("Verified")).toBeDefined();
    expect(screen.getByText("Verified by: official review")).toBeDefined();
  });
});
