import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";

vi.mock("@/i18n/navigation", () => ({ Link: "a" }));

import { SupportContactForm } from "./support-contact-form";

function renderForm() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={en as unknown as AbstractIntlMessages}
    >
      <SupportContactForm />
    </NextIntlClientProvider>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("support contact form", () => {
  it("requires consent and sends the localized support request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ sent: true }, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Restaurant owner" } });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "owner@example.com" }
    });
    fireEvent.change(screen.getByLabelText("How can we help?"), {
      target: { value: "Please help me update my business plan." }
    });
    const submit = screen.getByRole("button", { name: "Send message" });
    expect(submit).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(submit);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      name: "Restaurant owner",
      email: "owner@example.com",
      category: "general",
      message: "Please help me update my business plan.",
      consent: true,
      locale: "en"
    });
    expect((await screen.findByRole("status")).textContent).toBe(
      "Your message has been delivered to support."
    );
  });

  it("shows a clear delivery failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    renderForm();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Owner" } });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "owner@example.com" }
    });
    fireEvent.change(screen.getByLabelText("How can we help?"), {
      target: { value: "Please help me update my business plan." }
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Your message could not be delivered. Please try again later."
    );
  });
});
