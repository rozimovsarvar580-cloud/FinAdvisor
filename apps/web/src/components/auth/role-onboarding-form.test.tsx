import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: {
    data: null as {
      accessToken?: string;
      needsRole: boolean;
      user: { role?: "tadbirkor" | "buxgalter" | "investor" };
    } | null,
    status: "authenticated" as const
  },
  update: vi.fn(),
  replace: vi.fn()
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ ...mocks.session, update: mocks.update })
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace })
}));

import enMessages from "@/messages/en.json";
import { RoleOnboardingForm } from "./role-onboarding-form";

function renderForm() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={enMessages as unknown as AbstractIntlMessages}
    >
      <RoleOnboardingForm />
    </NextIntlClientProvider>
  );
}

describe("role onboarding", () => {
  beforeEach(() => {
    mocks.session.data = {
      accessToken: "active-access-token",
      needsRole: true,
      user: { role: "tadbirkor" }
    };
    mocks.update.mockReset();
    mocks.replace.mockReset();
  });

  it("offers the three supported roles and persists the selected role", async () => {
    mocks.update.mockResolvedValue({
      needsRole: false,
      roleUpdateError: undefined
    });
    renderForm();

    expect(screen.getByRole("radio", { name: "Business owner" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Accountant" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Investor" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Investor" }));
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith({ role: "investor" });
      expect(mocks.replace).toHaveBeenCalledWith("/app");
    });
  });

  it("keeps the user on onboarding and shows an error when saving fails", async () => {
    mocks.update.mockResolvedValue({
      needsRole: true,
      roleUpdateError: "RoleUpdateError"
    });
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "We could not save your account type. Please try again."
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
