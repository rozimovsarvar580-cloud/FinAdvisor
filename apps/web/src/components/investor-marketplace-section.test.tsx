import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

const session = {
  data: { user: { role: "tadbirkor" }, accessToken: "test-token" },
  status: "authenticated"
};

vi.mock("next-auth/react", () => ({
  useSession: () => session
}));

import { InvestorMarketplaceSection } from "./investor-marketplace-section";

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body
  };
}

describe("investor marketplace empty states", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("?mine=true")) {
          return Promise.resolve(jsonResponse({ items: [] }));
        }
        return Promise.resolve(jsonResponse({ items: [] }));
      })
    );
  });

  it("shows distinct empty states for public projects and the owner's listings", async () => {
    render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <InvestorMarketplaceSection />
      </NextIntlClientProvider>
    );

    expect(await screen.findByRole("heading", { name: "No listings yet" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No published projects yet" })).toBeTruthy();
    expect(
      screen.getByText("Projects you publish will appear here so you can manage their visibility.")
    ).toBeTruthy();
  });

  it("does not mistake a failed list request for an empty collection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false)));

    render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <InvestorMarketplaceSection />
      </NextIntlClientProvider>
    );

    expect(
      await screen.findByText("Published projects could not be loaded. Please try again.")
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "No published projects yet" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "No listings yet" })).toBeNull();
  });
});
