import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

import { AboutPage } from "./about-page";

describe("about page", () => {
  it.each([
    ["en", enMessages],
    ["ru", ruMessages],
    ["uz", uzMessages]
  ] as const)("presents the mission, audience, approach, values, and CTA in %s", (locale, messages) => {
    render(
      <NextIntlClientProvider
        locale={locale}
        messages={messages as unknown as AbstractIntlMessages}
      >
        <AboutPage />
      </NextIntlClientProvider>
    );

    const about = messages.landing.about;

    expect(
      screen.getByRole("heading", { level: 1, name: about.hero.title })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: about.mission.title })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: about.approach.title })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: about.values.title })
    ).toBeTruthy();

    for (const step of about.approach.steps) {
      expect(screen.getByRole("heading", { level: 3, name: step.title })).toBeTruthy();
    }

    for (const value of Object.values(about.values.items)) {
      expect(screen.getByRole("heading", { level: 3, name: value.title })).toBeTruthy();
    }

    for (const audience of ["owner", "accountant", "investor"] as const) {
      const role = about.audience.roles[audience];
      fireEvent.mouseDown(screen.getByRole("tab", { name: role.label }), {
        button: 0
      });
      expect(screen.getByRole("heading", { level: 3, name: role.title })).toBeTruthy();
    }

    expect(screen.getAllByRole("link", { name: about.cta.button })).toHaveLength(1);
    expect(screen.getByRole("link", { name: about.hero.cta })).toBeTruthy();
  });
});
