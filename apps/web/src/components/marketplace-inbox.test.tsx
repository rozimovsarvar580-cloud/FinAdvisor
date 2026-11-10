import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { role: "tadbirkor" }, accessToken: "token" } }) }));
import { MarketplaceInbox } from "./marketplace-inbox";

afterEach(() => vi.unstubAllGlobals());

describe("marketplace inbox", () => {
  it("offers a route back to listing management when the inbox is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) =>
        String(input).includes("?mine=true")
          ? Promise.resolve(Response.json({ items: [] }))
          : Promise.resolve(Response.json({ items: [] }))
      )
    );
    render(<NextIntlClientProvider locale="en" messages={en as unknown as AbstractIntlMessages}><MarketplaceInbox /></NextIntlClientProvider>);

    expect(await screen.findByText("No investor interest yet.")).toBeTruthy();
    expect(screen.getByText("Published listings can receive investor interest. Review your listings to make sure they are ready to share.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review my listings" }).getAttribute("href")).toBe("/en/investors");
  });

  it("shows incoming interest and offers owner decisions", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => String(input).includes("?mine=true")
      ? Promise.resolve(Response.json({ items: [{ id: "l1", business_name: "Cafe" }] }))
      : Promise.resolve(Response.json({ items: [{ id: "c1", investor_id: "investor-1", status: "pending", message: "Interested", created_at: "now" }] }))));
    render(<NextIntlClientProvider locale="en" messages={en as unknown as AbstractIntlMessages}><MarketplaceInbox /></NextIntlClientProvider>);
    expect(await screen.findByText("Interested")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Decline" })).toBeTruthy();
  });
});
