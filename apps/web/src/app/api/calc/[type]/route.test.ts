import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("calculator proxy", () => {
  it("forwards authorization so the API can apply tier limits", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ calculation_type: "payroll" })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/calc/payroll", {
        method: "POST",
        headers: {
          Authorization: "Bearer user-token",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ positions: [] })
      }),
      { params: { type: "payroll" } }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/calc/payroll",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer user-token",
          "Content-Type": "application/json"
        }
      })
    );
  });
});
