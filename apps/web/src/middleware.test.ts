import { NextRequest } from "next/server";
<<<<<<< HEAD
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getTokenMock } = vi.hoisted(() => ({
  getTokenMock: vi.fn()
}));

vi.mock("next-auth/jwt", () => ({ getToken: getTokenMock }));
vi.mock("next-intl/middleware", () => ({
  default: () => () => new Response(null, { status: 200 })
=======
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getToken, i18nHandler } = vi.hoisted(() => ({
  getToken: vi.fn(),
  i18nHandler: vi.fn(() => new Response("localized"))
}));

vi.mock("next-auth/jwt", () => ({ getToken }));
vi.mock("next-intl/middleware", () => ({
  default: () => i18nHandler
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
}));

import middleware from "./middleware";

<<<<<<< HEAD
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
=======
beforeEach(() => {
  vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
  getToken.mockReset();
  i18nHandler.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(path: string, cookies?: Record<string, string>) {
  return new NextRequest(`http://localhost${path}`, {
    headers: {
      "x-forwarded-for": `${Math.random()}`,
      ...(cookies
        ? {
            cookie: Object.entries(cookies)
              .map(([key, value]) => `${key}=${value}`)
              .join("; ")
          }
        : {})
    }
  });
}

describe("onboarding route protection", () => {
  it("redirects unauthenticated users to the localized sign-in page", async () => {
    getToken.mockResolvedValue(null);

    const response = await middleware(
      request("/uz/app/finadvisor", { finadvisor_token: "forged" })
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toContain("/uz/login");
  });

  it("forces users with an unselected role to role onboarding", async () => {
    getToken.mockResolvedValue({ needsRole: true });

    const response = await middleware(request("/ru/dashboard"));

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toContain("/ru/onboarding/role");
  });

  it("allows pending users through only on the role onboarding route", async () => {
    getToken.mockResolvedValue({ needsRole: true });

    const response = await middleware(request("/en/onboarding/role"));

    expect(response?.status).toBe(200);
    expect(i18nHandler).toHaveBeenCalledOnce();
  });

  it("redirects completed users away from role onboarding", async () => {
    getToken.mockResolvedValue({ needsRole: false });

    const response = await middleware(request("/uz/onboarding/role"));

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toContain("/uz/app");
  });
});

describe("admin route protection", () => {
  it("redirects unauthenticated users to sign-in", async () => {
    getToken.mockResolvedValue(null);

    const response = await middleware(request("/en/admin"));

    expect(response?.headers.get("location")).toContain("/en/login");
  });

  it("redirects authenticated non-admins away from admin routes", async () => {
    getToken.mockResolvedValue({ needsRole: false, role: "tadbirkor" });

    const response = await middleware(request("/ru/admin"));

    expect(response?.headers.get("location")).toContain("/ru/app");
  });

  it("allows administrators through", async () => {
    getToken.mockResolvedValue({ needsRole: false, role: "admin" });

    const response = await middleware(request("/uz/admin"));

    expect(response?.status).toBe(200);
    expect(i18nHandler).toHaveBeenCalledOnce();
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
  });
});
