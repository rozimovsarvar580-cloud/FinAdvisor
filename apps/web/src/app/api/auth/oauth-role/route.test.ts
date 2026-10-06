import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("POST /api/auth/oauth-role", () => {
  it("stores a short-lived same-origin role intent in an HttpOnly cookie", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/oauth-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost"
        },
        body: JSON.stringify({ role: "investor" })
      })
    );

    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("finadvisor_oauth_role=investor");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).toContain("Path=/api/auth");
  });

  it("rejects cross-origin and invalid role requests", async () => {
    const crossOrigin = await POST(
      new Request("http://localhost/api/auth/oauth-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://attacker.example"
        },
        body: JSON.stringify({ role: "investor" })
      })
    );
    const invalidRole = await POST(
      new Request("http://localhost/api/auth/oauth-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost"
        },
        body: JSON.stringify({ role: "admin" })
      })
    );

    expect(crossOrigin.status).toBe(403);
    expect(invalidRole.status).toBe(400);
  });
});
