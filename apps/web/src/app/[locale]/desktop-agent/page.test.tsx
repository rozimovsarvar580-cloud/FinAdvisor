import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import DesktopAgentPage from "./page";

describe("desktop agent download page", () => {
  it("shows downloads, system requirements, installation steps, and the unsigned warning", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en as unknown as AbstractIntlMessages}>
        <DesktopAgentPage />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole("heading", { name: "System requirements" })).toBeTruthy();
    expect(screen.getByText("A 64-bit processor.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Installation" })).toBeTruthy();
    expect(screen.getByText("Launch FinAdvisor Agent and sign in to your account.")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toContain("installer is currently unsigned");
    expect(screen.getAllByRole("link").some((link) => link.getAttribute("href")?.includes("releases/latest/download"))).toBe(true);
  });
});
