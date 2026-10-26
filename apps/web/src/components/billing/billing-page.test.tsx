import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

const { session } = vi.hoisted(() => ({
  session: {
    data: {
      accessToken: "billing-access-token" as string | undefined,
      user: { role: "tadbirkor" }
    },
    status: "authenticated" as string
  }
}));

vi.mock("next-auth/react", () => ({
  useSession: () => session
}));

import { BillingPage } from "./billing-page";
import { BillingCheckoutReturn } from "./billing-checkout-return";

describe("billing checkout page", () => {
  beforeEach(() => {
    session.data.accessToken = "billing-access-token";
    session.data.user.role = "tadbirkor";
    session.status = "authenticated";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        if (String(input) === "/api/billing/summary") {
          return Promise.resolve(
            Response.json({
              current_plan: "free",
              status: "inactive",
              billing_period: null,
              price: null,
              currency: null,
              next_charge_at: null,
              access_until: null,
              cancel_at_period_end: false,
              pending_plan: null,
              pending_plan_effective_at: null,
              payment_method_available: false,
              invoices: []
            })
          );
        }
        return Promise.resolve(Response.json({}));
      })
    );
  });

  function renderBillingPage(
    initialPeriod = "weekly",
    onCheckoutRedirect?: (url: string) => void
  ) {
    return render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <BillingPage
          initialPlan="pro"
          initialPeriod={initialPeriod}
          onCheckoutRedirect={onCheckoutRedirect}
        />
      </NextIntlClientProvider>
    );
  }

  it("submits the selected weekly plan with the session token", async () => {
    const checkoutResponse = {
      subscription_id: "subscription-1",
      invoice_id: "invoice-1",
      amount_minor: 1000,
      currency: "USD",
      checkout_url: "https://provider.example.test/checkout/one"
    };
    const fetchMock = vi.mocked(fetch).mockImplementation((input) =>
      Promise.resolve(
        String(input) === "/api/billing/summary"
          ? Response.json({
              current_plan: "free",
              status: "inactive",
              billing_period: null,
              price: null,
              currency: null,
              next_charge_at: null,
              access_until: null,
              cancel_at_period_end: false,
              pending_plan: null,
              pending_plan_effective_at: null,
              payment_method_available: false,
              invoices: []
            })
          : Response.json(checkoutResponse, { status: 200 })
      )
    );
    const redirect = vi.fn();
    renderBillingPage("weekly", redirect);

    expect(screen.getByText("$10")).toBeTruthy();
    const checkoutButton = screen.getByRole("button", {
      name: "Continue to checkout"
    });
    await waitFor(() => expect(checkoutButton.hasAttribute("disabled")).toBe(false));
    fireEvent.click(checkoutButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/billing/checkout",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer billing-access-token",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            plan: "pro",
            billing_period: "weekly",
            locale: "en"
          })
        })
      );
      expect(redirect).toHaveBeenCalledWith(
        "https://provider.example.test/checkout/one"
      );
    });
  });

  it("shows subscription details and schedules a plan change for renewal", async () => {
    const activeSummary = {
      current_plan: "pro",
      status: "active",
      billing_period: "weekly",
      price: "10.00",
      currency: "USD",
      next_charge_at: "2026-11-01T00:00:00Z",
      access_until: null,
      cancel_at_period_end: false,
      pending_plan: null,
      pending_plan_effective_at: null,
      payment_method_available: true,
      invoices: [
        {
          invoice_number: "INV-1",
          amount: "10.00",
          currency: "USD",
          status: "paid",
          created_at: "2026-10-24T00:00:00Z",
          paid_at: "2026-10-24T00:00:00Z",
          due_at: null
        }
      ]
    };
    const pendingSummary = {
      ...activeSummary,
      pending_plan: "business",
      pending_plan_effective_at: "2026-11-01T00:00:00Z"
    };
    let summaryRequests = 0;
    const fetchMock = vi.mocked(fetch).mockImplementation((input) => {
      if (String(input) === "/api/billing/summary") {
        summaryRequests += 1;
        return Promise.resolve(
          Response.json(summaryRequests > 1 ? pendingSummary : activeSummary)
        );
      }
      if (String(input) === "/api/billing/plan-change") {
        return Promise.resolve(Response.json({ pending_plan: "business" }));
      }
      return Promise.resolve(Response.json({}));
    });
    renderBillingPage("weekly");

    expect(await screen.findByText("INV-1")).toBeTruthy();
    expect(screen.getByText("Next charge")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Paid plan"), {
      target: { value: "business" }
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Schedule plan change" })
    );

    expect(
      await screen.findByText(
        "Your plan change is scheduled for the next renewal."
      )
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/billing/plan-change",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ plan: "business" })
      })
    );
  });

  it("cancels at period end without downgrading current access", async () => {
    let cancellationRequested = false;
    const fetchMock = vi.mocked(fetch).mockImplementation((input) => {
      if (String(input) === "/api/billing/summary") {
        return Promise.resolve(
          Response.json({
            current_plan: "pro",
            status: "active",
            billing_period: "weekly",
            price: "10.00",
            currency: "USD",
            next_charge_at: "2026-11-01T00:00:00Z",
            cancel_at_period_end: cancellationRequested,
            access_until: cancellationRequested
              ? "2026-11-01T00:00:00Z"
              : null,
            pending_plan: null,
            pending_plan_effective_at: null,
            payment_method_available: true,
            invoices: []
          })
        );
      }
      if (String(input) === "/api/billing/cancel") {
        cancellationRequested = true;
        return Promise.resolve(
          Response.json({
            cancel_at_period_end: true,
            access_until: "2026-11-01T00:00:00Z"
          })
        );
      }
      return Promise.resolve(Response.json({}));
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderBillingPage("weekly");

    fireEvent.click(
      await screen.findByRole("button", { name: "Cancel at period end" })
    );

    expect(
      await screen.findByText(
        "Your subscription remains active until the paid period ends."
      )
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/billing/cancel",
      expect.objectContaining({ method: "POST" })
    );
    confirm.mockRestore();
  });

  it("opens the provider-hosted payment method update flow", async () => {
    const redirect = vi.fn();
    const fetchMock = vi.mocked(fetch).mockImplementation((input) => {
      if (String(input) === "/api/billing/summary") {
        return Promise.resolve(
          Response.json({
            current_plan: "pro",
            status: "active",
            billing_period: "weekly",
            price: "10.00",
            currency: "USD",
            next_charge_at: "2026-11-01T00:00:00Z",
            access_until: null,
            cancel_at_period_end: false,
            pending_plan: null,
            pending_plan_effective_at: null,
            payment_method_available: true,
            invoices: []
          })
        );
      }
      return Promise.resolve(
        Response.json({
          update_url: "https://provider.example.test/payment-method"
        })
      );
    });
    renderBillingPage("weekly", redirect);

    fireEvent.click(
      await screen.findByRole("button", { name: "Update payment method" })
    );

    await waitFor(() =>
      expect(redirect).toHaveBeenCalledWith(
        "https://provider.example.test/payment-method"
      )
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/billing/payment-method",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("does not submit placeholder prices", () => {
    renderBillingPage("monthly");

    expect(
      screen.getByText(
        "Monthly and yearly prices are provisional (TODO(DECISION D1)) and cannot be charged. Choose weekly billing."
      )
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Continue to checkout" })
        .hasAttribute("disabled")
    ).toBe(true);
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/billing/checkout",
      expect.anything()
    );
  });

  it("requires an authenticated access token", () => {
    session.data.accessToken = undefined;
    renderBillingPage();

    expect(screen.getByText("Sign in as a business owner to start checkout.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue to checkout" }).hasAttribute("disabled")).toBe(
      true
    );
  });
});

describe("billing checkout return page", () => {
  it.each([
    ["success", "Checkout returned"],
    ["cancel", "Checkout canceled"]
  ] as const)("renders the %s outcome without claiming activation", (outcome, title) => {
    render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <BillingCheckoutReturn outcome={outcome} />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getByText(/only after/)).toBeTruthy();
  });
});
