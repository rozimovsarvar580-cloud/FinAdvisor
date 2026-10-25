import { afterEach, describe, expect, it, vi } from "vitest";

const { getServerSession } = vi.hoisted(() => ({
  getServerSession: vi.fn()
}));

vi.mock("next-auth", () => ({ getServerSession }));

import { GET as getProfile, PATCH as updateProfile } from "./me/route";
import { GET as getAccounts } from "./me/accounts/route";
import { POST as changePassword } from "./me/password/route";
import { POST as requestDeletion } from "./me/deletion-request/route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  getServerSession.mockReset();
});

function request(method: string, body?: unknown) {
  return new Request("http://localhost/api/auth/me", {
    method,
    headers: {
      ...(method !== "GET" ? { origin: "http://localhost" } : {}),
      "Content-Type": "application/json"
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

describe("profile settings API proxies", () => {
  it("forwards authorized profile read and update requests", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    getServerSession.mockResolvedValue({ accessToken: "session-access-token" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"email":"owner@example.com"}'))
      .mockResolvedValueOnce(new Response('{"locale":"ru"}'));
    vi.stubGlobal("fetch", fetchMock);

    expect((await getProfile(request("GET"))).status).toBe(200);
    expect(
      (
        await updateProfile(
          request("PATCH", { name: "Owner", locale: "ru" })
        )
      ).status
    ).toBe(200);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.finadvisor.test/auth/me",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.finadvisor.test/auth/me",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "Owner", locale: "ru" })
      })
    );
  });

  it("forwards account, password, and deletion requests through the session proxy", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    getServerSession.mockResolvedValue({ accessToken: "session-access-token" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("[]"))
      .mockResolvedValueOnce(new Response('{"message":"updated"}'))
      .mockResolvedValueOnce(new Response('{"deletion_requested_at":"now"}'));
    vi.stubGlobal("fetch", fetchMock);

    expect((await getAccounts(request("GET"))).status).toBe(200);
    expect(
      (await changePassword(request("POST", { current_password: "old", new_password: "new" })))
        .status
    ).toBe(200);
    expect((await requestDeletion(request("POST"))).status).toBe(200);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.finadvisor.test/auth/me/accounts",
      "https://api.finadvisor.test/auth/me/password",
      "https://api.finadvisor.test/auth/me/deletion-request"
    ]);
  });

  it("rejects profile mutations without a same-origin request or session", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    getServerSession.mockResolvedValue(null);

    expect(
      (await updateProfile(new Request("http://localhost/api/auth/me", { method: "PATCH" })))
        .status
    ).toBe(403);
    expect((await getProfile(request("GET"))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
