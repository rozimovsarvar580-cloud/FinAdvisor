import { describe, expect, it, vi } from "vitest";

import en from "@legacy-messages/en.json";
import ru from "@legacy-messages/ru.json";
import uz from "@legacy-messages/uz.json";

vi.mock("@/i18n/navigation", () => ({ Link: "a" }));

import FaqPage from "./page";

const locales = [
  ["en", en],
  ["ru", ru],
  ["uz", uz]
] as const;

describe("localized FAQ page", () => {
  it.each(locales)("renders 15 questions and contact link in %s", async (locale, messages) => {
    const page = await FaqPage({ params: Promise.resolve({ locale }) });
    const [, questions, contactLink] = page.props.children;

    expect(questions.props.children).toHaveLength(15);
    expect(contactLink.props.href).toBe("/contact");
    for (const [question] of messages.faq.items) {
      expect(questions.props.children.some((item: { key: string }) => item.key === question)).toBe(true);
    }
  });
});
