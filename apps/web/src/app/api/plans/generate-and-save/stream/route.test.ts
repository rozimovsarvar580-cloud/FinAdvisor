import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("streaming plan generation proxy", () => {
  it("requires an authenticated request before forwarding", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("https://web.finadvisor.test/api/plans/generate-and-save/stream", {
        method: "POST",
        body: "{}"
      })
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the caller token and preserves the streamed response", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const upstreamBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("event: progress\n\n"));
        controller.close();
      }
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(upstreamBody, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("https://web.finadvisor.test/api/plans/generate-and-save/stream", {
        method: "POST",
        headers: {
          Authorization: "Bearer owner-access-token",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ business_name: "Test restaurant" })
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(await response.text()).toBe("event: progress\n\n");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/plans/generate-and-save/stream",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer owner-access-token",
          "Content-Type": "application/json"
        },
        cache: "no-store"
      })
    );
  });
});
