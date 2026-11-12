import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";
import ru from "@/messages/ru.json";
import uz from "@/messages/uz.json";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  }
}));

import ChangelogPage from "./page";

const locales = [
  ["en", en],
  ["ru", ru],
  ["uz", uz]
] as const;

describe("localized changelog page", () => {
  it.each(locales)("shows the v6 release in %s", async (locale, messages) => {
    const page = await ChangelogPage({ params: Promise.resolve({ locale }) });
    render(page);

    expect(screen.getByRole("heading", { name: messages.changelog.title })).toBeTruthy();
    expect(screen.getByRole("heading", { name: messages.changelog.releaseTitle })).toBeTruthy();
    expect(screen.getByText("v6")).toBeTruthy();
    expect(screen.getByText("2026-11-10")).toBeTruthy();
    for (const change of messages.changelog.changes) {
      expect(screen.getByText(change)).toBeTruthy();
    }
  });
});
