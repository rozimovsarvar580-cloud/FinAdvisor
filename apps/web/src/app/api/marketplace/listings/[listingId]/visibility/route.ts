type RouteContext = { params: { listingId: string } };

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return Response.json(
      { detail: "marketplace.sign_in_required" },
      { status: 401 }
    );
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return Response.json(
      { detail: "marketplace.invalid_visibility" },
      { status: 400 }
    );
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  try {
    const response = await fetch(
      `${apiUrl}/marketplace/listings/${encodeURIComponent(params.listingId)}/visibility`,
      {
        method: "PATCH",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json"
        },
        body,
        cache: "no-store"
      }
    );
    return Response.json(await response.json(), { status: response.status });
  } catch {
    return Response.json(
      { detail: "marketplace.service_unavailable" },
      { status: 503 }
    );
  }
}
