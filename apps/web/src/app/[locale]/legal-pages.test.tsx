import { describe, expect, it, vi } from "vitest";

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  })
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/components/legal/legal-document", () => ({
  LegalDocument: () => null
}));

import AiDisclaimerPage, {
  generateStaticParams as aiDisclaimerParams
} from "./ai-disclaimer/page";
import PrivacyPage, { generateStaticParams as privacyParams } from "./privacy/page";
import RefundPage, { generateStaticParams as refundParams } from "./refund/page";
import TermsPage, { generateStaticParams as termsParams } from "./terms/page";

const locales = ["uz", "ru", "en"] as const;
const routes = [
  { page: TermsPage, params: termsParams, document: "terms" },
  { page: PrivacyPage, params: privacyParams, document: "privacy" },
  { page: RefundPage, params: refundParams, document: "refund" },
  { page: AiDisclaimerPage, params: aiDisclaimerParams, document: "aiDisclaimer" }
] as const;

describe("localized legal page routes", () => {
  it.each(routes)("$document exposes every supported locale", ({ params }) => {
    expect(params()).toEqual(locales.map((locale) => ({ locale })));
  });

  it.each(routes)("$document renders the matching document in every locale", async ({
    page,
    document
  }) => {
    for (const locale of locales) {
      const element = await page({ params: Promise.resolve({ locale }) });
      expect(element.props.document).toBe(document);
    }
  });

  it.each(routes)("$document rejects unsupported locales", async ({ page }) => {
    await expect(page({ params: Promise.resolve({ locale: "fr" }) }))
      .rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
    notFound.mockClear();
  });
});
