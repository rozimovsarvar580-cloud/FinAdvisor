import type { ComponentType } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

import AccountingLoading from "./accounting/loading";
import AppLoading from "./app/loading";
import DashboardLoading from "./dashboard/loading";
import LocaleErrorPage from "./error";
import InvestorsLoading from "./investors/loading";
import LocaleLoadingPage from "./loading";
import LocaleNotFoundPage from "./not-found";
import PlansLoading from "./plans/loading";

function renderWithMessages(children: React.ReactNode) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={enMessages as unknown as AbstractIntlMessages}
    >
      {children}
    </NextIntlClientProvider>
  );
}

const loadingPages: Array<[string, ComponentType]> = [
  ["locale routes", LocaleLoadingPage],
  ["plans", PlansLoading],
  ["investors", InvestorsLoading],
  ["dashboard", DashboardLoading],
  ["accounting", AccountingLoading],
  ["app workspace", AppLoading]
];

describe("localized route boundaries", () => {
  it.each(loadingPages)("renders the skeleton for %s", (_route, LoadingPage) => {
    renderWithMessages(<LoadingPage />);

    expect(screen.getByRole("status", { name: "Loading page" })).toBeTruthy();
  });

  it("renders the branded localized not-found boundary", () => {
    renderWithMessages(<LocaleNotFoundPage />);

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to home" })).toBeTruthy();
  });

  it("keeps exception details private and retries through the error boundary", () => {
    const reset = vi.fn();
    renderWithMessages(
      <LocaleErrorPage error={new Error("internal exception detail")} reset={reset} />
    );

    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeTruthy();
    expect(screen.queryByText("internal exception detail")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
