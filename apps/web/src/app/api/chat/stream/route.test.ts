import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chat streaming proxy", () => {
  it("forwards the bearer token and preserves the streaming response", async () => {
    const upstreamBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: {\"text\":\"answer\"}\n\n"));
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

    const request = new Request("https://web.finadvisor.test/api/chat/stream", {
      method: "POST",
      headers: {
        Authorization: "Bearer chat-access-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ locale: "en", message: "How should I plan?" })
    });
    const response = await POST(request);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/chat/stream");
    expect(new Headers(options.headers).get("authorization")).toBe(
      "Bearer chat-access-token"
    );
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(await response.text()).toContain("answer");
  });
});
