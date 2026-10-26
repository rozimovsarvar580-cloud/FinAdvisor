import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyReportRequest } from "./proxy";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("reports proxy", () => {
  it("requires auth and accepts only supported periods", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await proxyReportRequest(new Request("https://web.test/api/reports/day"), "day")).status).toBe(401);
    expect((await proxyReportRequest(new Request("https://web.test/api/reports/bad", { headers: { Authorization: "Bearer x" } }), "bad")).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards an authenticated period report without caching", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.test");
    const report = { period: "day", revenue: "100" };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(report)); vi.stubGlobal("fetch", fetchMock);
    const response = await proxyReportRequest(new Request("https://web.test/api/reports/day", { headers: { Authorization: "Bearer token" } }), "day");
    expect(await response.json()).toEqual(report);
    expect(fetchMock).toHaveBeenCalledWith("https://api.test/reports/day", expect.objectContaining({ cache: "no-store", headers: { Authorization: "Bearer token" } }));
  });
});
