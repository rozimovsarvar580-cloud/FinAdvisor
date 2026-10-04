import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as getListingDetails } from "../app/api/marketplace/listings/[listingId]/route";
import { PATCH } from "../app/api/marketplace/listings/[listingId]/visibility/route";
import { GET, POST } from "../app/api/marketplace/listings/route";
import { GET as getMyPlans } from "../app/api/plans/mine/route";
import { POST as generateAndSavePlan } from "../app/api/plans/generate-and-save/route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("marketplace listing proxy routes", () => {
  it("loads public listings without forwarding user credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ items: [] }, { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.uz");

    const response = await GET(
      new Request("https://web.finadvisor.uz/api/marketplace/listings")
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.uz/marketplace/listings",
      expect.objectContaining({ cache: "no-store", headers: undefined })
    );
  });

  it("requires a bearer token for listing publication", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("https://web.finadvisor.uz/api/marketplace/listings", {
        method: "POST",
        body: "{}"
      })
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards owner credentials and preserves API validation status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ detail: "invalid listing" }, { status: 422 })
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.uz");
    const requestBody = JSON.stringify({ funding_target: "250000000" });

    const response = await POST(
      new Request("https://web.finadvisor.uz/api/marketplace/listings", {
        method: "POST",
        headers: {
          Authorization: "Bearer owner-access-token",
          "Content-Type": "application/json"
        },
        body: requestBody
      })
    );

    expect(response.status).toBe(422);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.uz/marketplace/listings",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer owner-access-token",
          "Content-Type": "application/json"
        },
        body: requestBody
      })
    );
  });

  it("forwards listing visibility changes to the owner-protected API route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ is_published: false }, { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.uz");

    const response = await PATCH(
      new Request("https://web.finadvisor.uz/api/marketplace/listings/id/visibility", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer owner-access-token",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ is_published: false })
      }),
      { params: { listingId: "listing id" } }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.uz/marketplace/listings/listing%20id/visibility",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("forwards the saved-plan generation request only with the caller token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ plan_id: "plan-1" }, { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.uz");

    const response = await generateAndSavePlan(
      new Request("https://web.finadvisor.uz/api/plans/generate-and-save", {
        method: "POST",
        headers: {
          Authorization: "Bearer owner-access-token",
          "Content-Type": "application/json"
        },
        body: "{}"
      })
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.uz/plans/generate-and-save",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer owner-access-token",
          "Content-Type": "application/json"
        }
      })
    );
  });

  it("requires authentication before forwarding saved plan access", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await getMyPlans(
      new Request("https://web.finadvisor.uz/api/plans/mine")
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads public plan details without forwarding credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ plan_id: "plan-1" }, { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.uz");

    const response = await getListingDetails(
      new Request("https://web.finadvisor.uz/api/marketplace/listings/listing-1"),
      { params: { listingId: "listing-1" } }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.uz/marketplace/listings/listing-1",
      { cache: "no-store" }
    );
  });
});
