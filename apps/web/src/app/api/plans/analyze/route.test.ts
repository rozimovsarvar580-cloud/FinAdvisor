import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("plan analysis proxy", () => {
  it("forwards the bearer token and upload body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ score: 80 }, { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("file", new File(["plan"], "plan.txt", { type: "text/plain" }));
    const request = new Request("https://web.finadvisor.test/api/plans/analyze", {
      method: "POST",
      headers: { Authorization: "Bearer plan-test-token" },
      body: formData
    });

    const response = await POST(request);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/plans/analyze");
    expect(new Headers(options.headers).get("authorization")).toBe(
      "Bearer plan-test-token"
    );
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("locale")).toBe("en");
    expect(options.body.get("file").name).toBe("plan.txt");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ score: 80 });
  });
});
