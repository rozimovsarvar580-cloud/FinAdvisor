import { afterEach, describe, expect, it, vi } from "vitest";
import { captureWebException } from "./monitoring";

describe("web error monitoring", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does not report errors when the DSN is absent", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    captureWebException(new Error("test"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends an error envelope when configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.test/1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    captureWebException(new Error("test"));
    expect(fetch).toHaveBeenCalledWith(
      "https://example.test/1/api/1/envelope/",
      expect.objectContaining({ method: "POST", keepalive: true })
    );
  });
});
