import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AbstractIntlMessages } from "use-intl";

import en from "@/messages/en.json";
import { AnalyticsConsentBanner } from "./analytics-consent-banner";

function renderBanner() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={en as unknown as AbstractIntlMessages}
    >
      <AnalyticsConsentBanner />
    </NextIntlClientProvider>
  );
}

describe("AnalyticsConsentBanner", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("records an explicit choice before hiding the banner", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response('{"recorded":true}', { status: 202 }))
    );
    renderBanner();

    fireEvent.click(await screen.findByRole("button", { name: "Accept analytics" }));

    await waitFor(() => {
      expect(screen.queryByTestId("analytics-consent-banner")).toBeNull();
    });
    expect(window.localStorage.getItem("finadvisor-analytics-consent")).toBe(
      "accepted"
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/analytics/consent",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"consent":true')
      })
    );
  });

  it("keeps the banner visible when consent cannot be recorded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    renderBanner();

    fireEvent.click(await screen.findByRole("button", { name: "Reject analytics" }));

    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByTestId("analytics-consent-banner")).toBeDefined();
    expect(window.localStorage.getItem("finadvisor-analytics-consent")).toBeNull();
  });
});
