export async function POST(
  request: Request,
  context: { params: { type: string } }
) {
  const calculationType = context.params.type;
  let body: string;
  try {
    body = await request.text();
  } catch {
    return Response.json({ detail: "calc.request_unavailable" }, { status: 400 });
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/calc/${encodeURIComponent(calculationType)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store"
    });
  } catch {
    return Response.json(
      { detail: "calc.service_unavailable" },
      { status: 503 }
    );
  }

  return Response.json(await response.json(), { status: response.status });
}
