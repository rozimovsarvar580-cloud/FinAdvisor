import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

import {
  PanelLoadingSkeleton,
  RouteLoadingSkeleton,
  RouteStatus
} from "./route-states";

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

describe("route states", () => {
  it("renders an accessible, theme-token loading skeleton", () => {
    renderWithMessages(<RouteLoadingSkeleton />);

    expect(screen.getByRole("status", { name: "Loading page" })).toBeTruthy();
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
  });

  it("renders an accessible workspace-panel skeleton and disables motion when requested", () => {
    renderWithMessages(<PanelLoadingSkeleton />);

    const status = screen.getByRole("status", { name: "Loading" });
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(status.querySelectorAll(".motion-reduce\\:animate-none")).toHaveLength(3);
  });

  it("renders branded not-found copy and a route home action", () => {
    renderWithMessages(<RouteStatus variant="notFound" />);

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeTruthy();
    expect(screen.getByText("FinAdvisor")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to home" })).toBeTruthy();
  });

  it("offers retry and home actions for route errors", () => {
    const retry = vi.fn();
    renderWithMessages(<RouteStatus onRetry={retry} variant="error" />);

    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Go to home" })).toBeTruthy();
  });
});
