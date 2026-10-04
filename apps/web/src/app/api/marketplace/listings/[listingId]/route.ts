type RouteContext = { params: { listingId: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  try {
    const response = await fetch(
      `${apiUrl}/marketplace/listings/${encodeURIComponent(params.listingId)}`,
      { cache: "no-store" }
    );
    return Response.json(await response.json(), { status: response.status });
  } catch {
    return Response.json(
      { detail: "marketplace.service_unavailable" },
      { status: 503 }
    );
  }
}
