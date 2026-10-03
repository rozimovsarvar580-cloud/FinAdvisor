export async function POST(request: Request) {
  let body: string;
  try {
    body = await request.text();
  } catch {
    return Response.json(
      { detail: "pricing.request_unavailable" },
      { status: 400 }
    );
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/pricing/commission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store"
    });
  } catch {
    return Response.json(
      { detail: "pricing.calculator_unavailable" },
      { status: 503 }
    );
  }

  const content = await response.json();
  return Response.json(content, { status: response.status });
}
