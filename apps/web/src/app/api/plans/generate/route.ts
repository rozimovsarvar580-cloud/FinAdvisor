export async function POST(request: Request) {
  let body: string;
  try {
    body = await request.text();
  } catch {
    return Response.json(
      { detail: "plans.request_unavailable" },
      { status: 400 }
    );
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/plans/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store"
    });
  } catch {
    return Response.json(
      { detail: "plans.service_unavailable" },
      { status: 503 }
    );
  }

  return Response.json(await response.json(), { status: response.status });
}
