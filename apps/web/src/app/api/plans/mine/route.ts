export async function GET(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return Response.json(
      { detail: "plans.authentication_required" },
      { status: 401 }
    );
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  try {
    const response = await fetch(`${apiUrl}/plans/mine`, {
      headers: { Authorization: authorization },
      cache: "no-store"
    });
    return Response.json(await response.json(), { status: response.status });
  } catch {
    return Response.json(
      { detail: "plans.service_unavailable" },
      { status: 503 }
    );
  }
}
