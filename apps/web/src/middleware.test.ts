import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getTokenMock } = vi.hoisted(() => ({
  getTokenMock: vi.fn()
}));

vi.mock("next-auth/jwt", () => ({ getToken: getTokenMock }));
vi.mock("next-intl/middleware", () => ({
  default: () => () => new Response(null, { status: 200 })
}));

import middleware from "./middleware";

describe("role onboarding route guard", () => {
  beforeEach(() => {
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
    getTokenMock.mockReset();
  });

  it("redirects users who need a role from protected and public routes", async () => {
    getTokenMock.mockResolvedValue({ needsRole: true });

    const appResponse = await middleware(
      new NextRequest("http://localhost/en/app/finadvisor")
    );
    const publicResponse = await middleware(
      new NextRequest("http://localhost/ru/plans")
    );

    expect(appResponse.headers.get("location")).toBe(
      "http://localhost/en/onboarding/role"
    );
    expect(publicResponse.headers.get("location")).toBe(
      "http://localhost/ru/onboarding/role"
    );
  });

  it("allows pending users only on role onboarding and redirects completed users away", async () => {
    getTokenMock.mockResolvedValue({ needsRole: true });
    const pendingResponse = await middleware(
      new NextRequest("http://localhost/uz/onboarding/role")
    );
    getTokenMock.mockResolvedValue({ needsRole: false });
    const completedResponse = await middleware(
      new NextRequest("http://localhost/uz/onboarding/role")
    );

    expect(pendingResponse.status).toBe(200);
    expect(completedResponse.headers.get("location")).toBe(
      "http://localhost/uz/app"
    );
  });

  it("requires authentication to open the role selection route", async () => {
    getTokenMock.mockResolvedValue(null);

    const response = await middleware(
      new NextRequest("http://localhost/en/onboarding/role")
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost/en/login?callbackUrl=%2Fen%2Fonboarding%2Frole"
    );
  });
});
