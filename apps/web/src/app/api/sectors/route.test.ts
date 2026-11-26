import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sector registry proxy", () => {
  it("forwards the public registry request without caching", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json([{ id: "restaurant_cafe" }])
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "restaurant_cafe" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/sectors",
      { cache: "no-store" }
    );
  });

  it("reports unavailable when the API cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    const response = await GET();

    expect(response.status).toBe(503);
  });
});
