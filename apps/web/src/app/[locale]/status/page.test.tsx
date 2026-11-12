import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  }
}));

import StatusPage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("service status page", () => {
  it("reports all monitored services ready when API readiness succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          status: "ok",
          checks: { database: "ok", redis: "ok", migrations: "ok" }
        })
      )
    );
    const page = await StatusPage({ params: Promise.resolve({ locale: "en" }) });
    render(page);

    expect(screen.getByRole("status").textContent).toBe(en.statusPage.operational);
    for (const service of Object.values(en.statusPage.services)) {
      expect(screen.getByText(service)).toBeTruthy();
    }
    expect(screen.getAllByText(en.statusPage.states.operational)).toHaveLength(3);
  });

  it("reports degraded services using the readiness response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            status: "not_ready",
            checks: { database: "ok", redis: "error", migrations: "pending" }
          },
          { status: 503 }
        )
      )
    );
    const page = await StatusPage({ params: Promise.resolve({ locale: "en" }) });
    render(page);

    expect(screen.getByRole("status").textContent).toBe(en.statusPage.degraded);
    expect(screen.getAllByText(en.statusPage.states.issue)).toHaveLength(2);
  });

  it("clearly reports an unreachable readiness service", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const page = await StatusPage({ params: Promise.resolve({ locale: "en" }) });
    render(page);

    expect(screen.getByRole("status").textContent).toBe(en.statusPage.unavailable);
    expect(screen.getAllByText(en.statusPage.states.unknown)).toHaveLength(3);
  });
});
