import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

const { session, update, replace } = vi.hoisted(() => ({
  session: {
    status: "authenticated" as string,
    data: { needsRole: true, user: { role: "tadbirkor" } }
  },
  update: vi.fn(),
  replace: vi.fn()
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ ...session, update })
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace })
}));

import RoleOnboardingPage from "./page";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("role onboarding page", () => {
  beforeEach(() => {
    session.status = "authenticated";
    session.data = { needsRole: true, user: { role: "tadbirkor" } };
    update.mockReset();
    replace.mockReset();
  });

  function renderPage() {
    return render(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
      >
        <RoleOnboardingPage />
      </NextIntlClientProvider>
    );
  }

  it("saves the selected role, refreshes the session, and continues", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    update.mockResolvedValue({ needsRole: false });

    renderPage();
    fireEvent.change(screen.getByLabelText("Account role"), {
      target: { value: "investor" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/role",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ role: "investor" })
        })
      );
      expect(update).toHaveBeenCalledOnce();
      expect(replace).toHaveBeenCalledWith("/app/finadvisor");
    });
  });

  it("shows a localized error when the role cannot be saved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 409 }))
    );

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "We couldn't save your role. Please try again."
    );
    expect(update).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
