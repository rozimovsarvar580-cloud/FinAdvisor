import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import ruMessages from "@/messages/ru.json";
import uzMessages from "@/messages/uz.json";

vi.mock("@/i18n/navigation", () => ({
  Link: "a"
}));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    useReducedMotion: () => true
  };
});

import { LandingPage } from "./landing-page";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("landing page", () => {
  it.each([
    ["en", enMessages],
    ["ru", ruMessages],
    ["uz", uzMessages]
  ] as const)("renders the complete planning hero in %s", (locale, messages) => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      }
    );

    const { container } = render(
      <NextIntlClientProvider
        locale={locale}
        messages={messages as unknown as AbstractIntlMessages}
      >
        <LandingPage />
      </NextIntlClientProvider>
    );

    expect(
      screen.getByRole("heading", { level: 1, name: messages.landing.hero.title })
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: messages.landing.hero.primaryCta })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: messages.landing.hero.secondaryCta })
    ).toBeTruthy();
    expect(
      screen.getByRole("group", {
        name: messages.landing.hero.dashboard.ariaLabel
      })
    ).toBeTruthy();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();

    const stats = screen.getByRole("region", {
      name: messages.landing.stats.ariaLabel
    });
    expect(stats.textContent).toContain("5");
    expect(stats.textContent).toContain("4");
    expect(stats.textContent).toContain("3");

    for (const question of messages.landing.problem.cards) {
      expect(
        screen.getByRole("heading", { level: 3, name: question.title })
      ).toBeTruthy();
    }
    expect(messages.landing.problem.cards).toHaveLength(5);

    for (const step of messages.landing.steps.items) {
      expect(
        screen.getByRole("heading", { level: 3, name: step.title })
      ).toBeTruthy();
    }
    expect(messages.landing.steps.items).toHaveLength(4);

    for (const feature of messages.landing.features.items) {
      expect(
        screen.getByRole("heading", { level: 3, name: feature.title })
      ).toBeTruthy();
    }
    expect(messages.landing.features.items).toHaveLength(8);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: messages.landing.investors.title
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: messages.landing.desktop.title
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: messages.landing.desktop.cta })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: messages.landing.pricing.title
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: messages.landing.faq.title
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: messages.landing.cta.title
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: messages.landing.cta.button })
    ).toBeTruthy();

    for (const item of Object.values(messages.landing.faq.items)) {
      expect(screen.getByRole("button", { name: item.question })).toBeTruthy();
    }
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.landing.faq.items.q1.question
      })
    );
    expect(
      screen.getByText(messages.landing.faq.items.q1.answer)
    ).toBeTruthy();

    expect(screen.getByRole("contentinfo")).toBeTruthy();
    expect(
      screen.getByRole("navigation", {
        name: messages.landing.footer.ariaLabel
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("link", {
        name: messages.landing.footer.howItWorks
      })
    ).toBeTruthy();
  });
});
