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
    document.cookie =
      "finadvisor-analytics-consent=; Max-Age=0; Path=/; SameSite=Lax";
    document.cookie =
      "finadvisor-analytics-consent-pending=; Max-Age=0; Path=/; SameSite=Lax";
    document.cookie =
      "finadvisor-visitor-id=; Max-Age=0; Path=/; SameSite=Lax";
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
    expect(document.cookie).toContain("finadvisor-analytics-consent=accepted");
    expect(document.cookie).not.toContain(
      "finadvisor-analytics-consent-pending=accepted"
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/analytics/consent",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"consent":true')
      })
    );
  });

  it("saves the choice in a cookie and hides the banner when the API is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    renderBanner();

    fireEvent.click(await screen.findByRole("button", { name: "Reject analytics" }));

    await waitFor(() => {
      expect(screen.queryByTestId("analytics-consent-banner")).toBeNull();
    });
    expect(document.cookie).toContain("finadvisor-analytics-consent=rejected");
    expect(document.cookie).toContain(
      "finadvisor-analytics-consent-pending=rejected"
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps a rejected choice after reload and retries syncing when the API returns", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(
        new Response('{"recorded":true}', { status: 202 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const firstRender = renderBanner();

    fireEvent.click(await screen.findByRole("button", { name: "Reject analytics" }));
    await waitFor(() => {
      expect(screen.queryByTestId("analytics-consent-banner")).toBeNull();
    });

    firstRender.unmount();
    renderBanner();

    expect(
      await screen.findByRole("button", { name: "Privacy preferences" })
    ).toBeDefined();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        body: expect.stringContaining('"consent":false')
      })
    );
    expect(document.cookie).not.toContain(
      "finadvisor-analytics-consent-pending=rejected"
    );
  });

  it("retries a pending choice when the browser comes back online", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(
        new Response('{"recorded":true}', { status: 202 })
      );
    vi.stubGlobal("fetch", fetchMock);
    renderBanner();

    fireEvent.click(await screen.findByRole("button", { name: "Reject analytics" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent(window, new Event("online"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(document.cookie).not.toContain(
        "finadvisor-analytics-consent-pending=rejected"
      );
    });
  });

  it("migrates a previously saved choice and visitor ID from local storage", async () => {
    window.localStorage.setItem("finadvisor-analytics-consent", "rejected");
    window.localStorage.setItem("finadvisor-visitor-id", "legacy_visitor_123");
    renderBanner();

    expect(
      await screen.findByRole("button", { name: "Privacy preferences" })
    ).toBeDefined();
    expect(document.cookie).toContain("finadvisor-analytics-consent=rejected");
    expect(document.cookie).toContain("finadvisor-visitor-id=legacy_visitor_123");
  });

  it("keeps the banner in normal document flow instead of covering page content", async () => {
    renderBanner();
    const banner = await screen.findByTestId("analytics-consent-banner");

    expect(banner.className).not.toContain("fixed");
    expect(banner.className).not.toContain("sticky");
  });
});
