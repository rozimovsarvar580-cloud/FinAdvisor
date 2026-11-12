import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

let originalCreateObjectURL: PropertyDescriptor | undefined;
let originalRevokeObjectURL: PropertyDescriptor | undefined;

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

import { SamplePlanDownloadForm } from "./sample-plan-download-form";

function renderForm() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={enMessages as unknown as AbstractIntlMessages}
    >
      <SamplePlanDownloadForm />
    </NextIntlClientProvider>
  );
}

afterEach(() => {
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

describe("sample plan download form", () => {
  it("requires consent before requesting the downloadable sample", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "owner@example.com" }
    });

    expect(screen.getByRole("button", { name: "Download free sample PDF" }).hasAttribute("disabled")).toBe(true);
  });

  it("records explicit consent and downloads the localized PDF", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("%PDF-sample", {
        status: 200,
        headers: { "Content-Type": "application/pdf" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    const createObjectURL = vi.fn().mockReturnValue("blob:sample");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    renderForm();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "owner@example.com" }
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree/ }));
    fireEvent.click(screen.getByRole("button", { name: "Download free sample PDF" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/lead-magnet/sample-plan",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "owner@example.com",
            consent: true,
            locale: "en"
          })
        })
      );
    });
    expect((await screen.findByRole("status")).textContent).toBe(
      "Your sample plan is ready and has been downloaded."
    );
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:sample");
  });

  it("shows a clear error when the download service fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    renderForm();
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "owner@example.com" }
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree/ }));
    fireEvent.click(screen.getByRole("button", { name: "Download free sample PDF" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "The sample plan could not be downloaded. Please try again."
    );
  });
});
