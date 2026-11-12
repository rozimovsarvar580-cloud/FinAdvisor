import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";
import ru from "@/messages/ru.json";
import uz from "@/messages/uz.json";

vi.mock("@/i18n/navigation", () => ({ Link: "a" }));

import { InvestorBriefPage } from "./investor-brief-page";

let originalCreateObjectURL: PropertyDescriptor | undefined;
let originalRevokeObjectURL: PropertyDescriptor | undefined;

function renderPage(locale = "en", messages = en) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages as unknown as AbstractIntlMessages}
    >
      <InvestorBriefPage />
    </NextIntlClientProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalCreateObjectURL) {
    Object.defineProperty(URL, "createObjectURL", originalCreateObjectURL);
  } else {
    Reflect.deleteProperty(URL, "createObjectURL");
  }
  if (originalRevokeObjectURL) {
    Object.defineProperty(URL, "revokeObjectURL", originalRevokeObjectURL);
  } else {
    Reflect.deleteProperty(URL, "revokeObjectURL");
  }
  originalCreateObjectURL = undefined;
  originalRevokeObjectURL = undefined;
});

describe("investor brief page", () => {
  it.each([
    ["en", en],
    ["ru", ru],
    ["uz", uz]
  ] as const)("shows a public summary in %s", (locale, messages) => {
    renderPage(locale, messages);
    expect(screen.getByRole("heading", { name: messages.investorBrief.title })).toBeTruthy();
    expect(screen.getByRole("heading", { name: messages.investorBrief.summaryTitle })).toBeTruthy();
    expect(screen.getByText(messages.investorBrief.audienceText)).toBeTruthy();
  });

  it("requires consent, then displays and offers the PDF", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("%PDF-investor", {
        status: 200,
        headers: { "Content-Type": "application/pdf" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    const createObjectURL = vi.fn().mockReturnValue("blob:investor-brief");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL
    });
    renderPage();

    fireEvent.change(screen.getByLabelText(en.investorBrief.emailLabel), {
      target: { value: "owner@example.com" }
    });
    const submit = screen.getByRole("button", { name: en.investorBrief.submit });
    expect(submit).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(submit);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      email: "owner@example.com",
      consent: true,
      locale: "en"
    });
    expect((await screen.findByRole("status")).textContent).toBe(
      en.investorBrief.success
    );
    expect(screen.getByTitle(en.investorBrief.viewTitle).getAttribute("src")).toBe(
      "blob:investor-brief"
    );
    expect(screen.getByRole("link", { name: en.investorBrief.download }).getAttribute("href"))
      .toBe("blob:investor-brief");
    cleanup();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:investor-brief");
  });

  it("reports PDF service failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    renderPage();

    fireEvent.change(screen.getByLabelText(en.investorBrief.emailLabel), {
      target: { value: "owner@example.com" }
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: en.investorBrief.submit }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.investorBrief.failure
    );
  });
});
