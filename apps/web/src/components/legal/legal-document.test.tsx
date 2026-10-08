import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import ruMessages from "@/messages/ru.json";
import uzMessages from "@/messages/uz.json";

vi.mock("@/i18n/navigation", () => ({
  Link: "a"
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() })
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn()
}));

import { SignupForm } from "@/components/auth/signup-form";
import { Footer } from "@/components/layout/footer";
import { LegalDocument } from "./legal-document";

const locales = [
  ["en", enMessages],
  ["ru", ruMessages],
  ["uz", uzMessages]
] as const;

const documents = ["terms", "privacy", "refund", "aiDisclaimer"] as const;
const aiDisclaimerRequirements = {
  en: ["are estimates", "are not financial, investment, tax, accounting, or legal advice"],
  ru: ["являются оценками", "не являются финансовой, инвестиционной, налоговой, бухгалтерской или юридической консультацией"],
  uz: ["baholardir", "moliyaviy, investitsion, soliq, buxgalteriya yoki yuridik maslahat emas"]
} as const;

function renderWithMessages(
  locale: (typeof locales)[number][0],
  messages: (typeof locales)[number][1],
  children: React.ReactNode
) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages as unknown as AbstractIntlMessages}
    >
      {children}
    </NextIntlClientProvider>
  );
}

describe("legal documents", () => {
  it.each(locales)("states the estimate and no-advice limits in the %s AI disclaimer", (locale, messages) => {
    const [estimatePhrase, noAdvicePhrase] = aiDisclaimerRequirements[locale];
    const { estimates, notAdvice } = messages.legal.aiDisclaimer.sections;

    expect(estimates.body.toLowerCase()).toContain(estimatePhrase);
    expect(notAdvice.body.toLowerCase()).toContain(noAdvicePhrase);
  });

  it.each(locales.flatMap(([locale, messages]) =>
    documents.map((document) => [locale, messages, document] as const)
  ))("renders the %s %s draft with its translated sections", (locale, messages, document) => {
    const content = messages.legal[document];
    renderWithMessages(locale, messages, <LegalDocument document={document} />);

    expect(
      screen.getByRole("heading", { level: 1, name: content.title })
    ).toBeTruthy();
    expect(screen.getByText(content.draftNotice)).toBeTruthy();
    expect(content.draftNotice).toContain("TODO(LEGAL)");
    for (const section of Object.values(content.sections)) {
      expect(
        screen.getByRole("heading", { level: 2, name: section.title })
      ).toBeTruthy();
      expect(screen.getByText(section.body)).toBeTruthy();
    }
  });

  it.each(locales)("links every legal document from the %s footer", (locale, messages) => {
    renderWithMessages(locale, messages, <Footer />);

    expect(
      screen.getByRole("link", { name: messages.common.footer.terms }).getAttribute("href")
    ).toBe("/terms");
    expect(
      screen.getByRole("link", { name: messages.common.footer.privacy }).getAttribute("href")
    ).toBe("/privacy");
    expect(
      screen.getByRole("link", { name: messages.common.footer.refund }).getAttribute("href")
    ).toBe("/refund");
    expect(
      screen.getByRole("link", { name: messages.common.footer.aiDisclaimer })
      .getAttribute("href")
    ).toBe("/ai-disclaimer");
  });

  it.each(locales)("links the signup consent to terms and privacy in %s", (locale, messages) => {
    const { container } = renderWithMessages(
      locale,
      messages,
      <SignupForm callbackUrl={`/${locale}/app`} />
    );

    expect(screen.getByRole("checkbox")).toBeTruthy();
    expect(container.querySelector('a[href="/terms"]')?.textContent).toBeTruthy();
    expect(container.querySelector('a[href="/privacy"]')?.textContent).toBeTruthy();
    expect(container.querySelector("#signup-terms-consent")).toBeTruthy();
  });
});
