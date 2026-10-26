import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { AccountantWorkspace } from "./accountant-workspace";

afterEach(() => vi.unstubAllGlobals());
describe("accountant workspace", () => {
  it("provides keyboard operable accounting forms with required validation and saves inventory movements", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => Promise.resolve(init?.method === "POST" ? Response.json({ id: "record" }) : Response.json({ items: [] })));
    vi.stubGlobal("fetch", fetchMock);
    render(<NextIntlClientProvider locale="en" messages={messages as unknown as AbstractIntlMessages}><AccountantWorkspace /></NextIntlClientProvider>);
    expect(screen.getByRole("button", { name: "Inventory in and out" }).getAttribute("aria-pressed")).toBe("true");
    const product = screen.getByLabelText("Product");
    expect(product.hasAttribute("required")).toBe(true);
    fireEvent.change(product, { target: { value: "Rice" } });
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-26" } });
    fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/accounting/stock-movements", expect.objectContaining({ method: "POST" })));
    expect((await screen.findByRole("status")).textContent).toBe("Entry saved.");
  });
});
