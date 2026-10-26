import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { session, replace } = vi.hoisted(() => ({
  session: {
    status: "loading" as string,
    data: { needsRole: false }
  },
  replace: vi.fn()
}));

vi.mock("next-auth/react", () => ({
  useSession: () => session
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace })
}));

import AppIndex from "./page";

describe("localized app index", () => {
  beforeEach(() => {
    session.status = "loading";
    session.data = { needsRole: false };
    replace.mockClear();
  });

  it("waits for the session before redirecting", () => {
    render(<AppIndex params={{ locale: "uz" }} />);

    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a new OAuth account to onboarding", async () => {
    session.status = "authenticated";
    session.data = { needsRole: true };

    render(<AppIndex params={{ locale: "ru" }} />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/ru/onboarding/role");
    });
  });

  it("sends other sessions to the localized app landing", async () => {
    session.status = "unauthenticated";

    render(<AppIndex params={{ locale: "en" }} />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/en/app/finadvisor");
    });
  });
});
