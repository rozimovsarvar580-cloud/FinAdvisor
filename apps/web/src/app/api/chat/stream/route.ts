export async function POST(request: Request) {
  let body: string;
  try {
    body = await request.text();
  } catch {
    return Response.json({ detail: "chat.request_unavailable" }, { status: 400 });
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store"
    });
  } catch {
    return Response.json(
      { detail: "chat.service_unavailable" },
      { status: 503 }
    );
  }

  if (!response.ok) {
    return Response.json(await response.json(), { status: response.status });
  }
  if (!response.body) {
    return Response.json(
      { detail: "chat.stream_unavailable" },
      { status: 502 }
    );
  }
  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no"
    }
  });
}
