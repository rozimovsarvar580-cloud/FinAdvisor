import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getServerSession, getTranslations } = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getTranslations: vi.fn(async () => (key: string) => key)
}));

vi.mock("next-auth/next", () => ({ getServerSession }));
vi.mock("next-intl/server", () => ({ getTranslations }));

import AdminPage from "./page";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  getServerSession.mockReset();
});

describe("admin page AI status", () => {
  it("server-fetches safe AI status with the authenticated admin token", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    getServerSession.mockResolvedValue({
      accessToken: "admin-access-token",
      user: { role: "admin" }
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          connected: true,
          provider: "openai",
          model: "test-model"
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const markup = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ locale: "en" }) })
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/admin/ai-status",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-access-token" },
        cache: "no-store"
      })
    );
    expect(markup).toContain("admin.aiConnected");
    expect(markup).toContain("openai");
    expect(markup).toContain("test-model");
    expect(markup).not.toContain("admin-access-token");
  });

  it("does not fetch status for a non-admin session", async () => {
    getServerSession.mockResolvedValue({
      accessToken: "owner-access-token",
      user: { role: "tadbirkor" }
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const markup = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ locale: "en" }) })
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(markup).toContain("admin.aiStatusUnavailable");
  });

  it("rejects unexpected fields instead of rendering potentially sensitive data", async () => {
    getServerSession.mockResolvedValue({
      accessToken: "admin-access-token",
      user: { role: "admin" }
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            connected: true,
            provider: "openai",
            model: "test-model",
            api_key: "must-not-render"
          }),
          { status: 200 }
        )
      )
    );

    const markup = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ locale: "en" }) })
    );

    expect(markup).toContain("admin.aiStatusUnavailable");
    expect(markup).not.toContain("must-not-render");
  });
});
