import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

import { ProfileSettings } from "./profile-settings";

const { update, replace } = vi.hoisted(() => ({
  update: vi.fn(),
  replace: vi.fn()
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ update })
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace })
}));

afterEach(() => {
  vi.unstubAllGlobals();
  update.mockReset();
  replace.mockReset();
});

function renderProfileSettings() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={enMessages as unknown as AbstractIntlMessages}
    >
      <ProfileSettings />
    </NextIntlClientProvider>
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

const profile = {
  email: "owner@example.com",
  name: "Restaurant owner",
  role: "tadbirkor",
  locale: "en",
  deletion_requested_at: null
};

describe("profile settings", () => {
  it("loads profile and connected accounts, then saves the name and language", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(profile))
      .mockResolvedValueOnce(
        jsonResponse([{ provider: "google", connected_at: "2026-01-01" }])
      )
      .mockResolvedValueOnce(jsonResponse({ ...profile, name: "Updated owner", locale: "ru" }));
    vi.stubGlobal("fetch", fetchMock);
    renderProfileSettings();

    expect(await screen.findByText("Google")).toBeDefined();
    expect(screen.getByText("owner@example.com")).toBeDefined();
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Updated owner" }
    });
    fireEvent.change(screen.getByLabelText("Language"), {
      target: { value: "ru" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByText("Profile settings saved.")).toBeDefined();
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/auth/me",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "Updated owner", locale: "ru" })
      })
    );
    expect(update).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/dashboard/settings", {
      locale: "ru"
    });
  }, 15000);

  it("validates password confirmation and submits the password change", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(profile))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ message: "updated" }));
    vi.stubGlobal("fetch", fetchMock);
    renderProfileSettings();
    await screen.findByText("No social accounts are connected.");

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "CurrentPass123!" }
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewPass123!" }
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "Mismatch123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("Passwords do not match.")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "NewPass123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("Password changed.")).toBeDefined();
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/auth/me/password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          current_password: "CurrentPass123!",
          new_password: "NewPass123!"
        })
      })
    );
  });

  it("requires explicit consent before requesting account deletion", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(profile))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse({ ...profile, deletion_requested_at: "2026-01-02" })
      );
    vi.stubGlobal("fetch", fetchMock);
    renderProfileSettings();
    await screen.findByText("No social accounts are connected.");

    const requestButton = screen.getByRole("button", {
      name: "Request deletion"
    });
    expect(requestButton).toHaveProperty("disabled", true);
    fireEvent.click(
      screen.getByLabelText(
        "I understand and want to request account deletion."
      )
    );
    fireEvent.click(requestButton);

    expect(
      await screen.findByText("Your deletion request has been submitted.")
    ).toBeDefined();
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/auth/me/deletion-request",
      expect.objectContaining({ method: "POST" })
    );
    expect(
      screen.queryByRole("button", { name: "Request deletion" })
    ).toBeNull();
  });
});
