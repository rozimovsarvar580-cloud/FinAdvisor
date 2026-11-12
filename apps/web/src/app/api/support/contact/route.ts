export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) {
    return new Response(null, { status: 403 });
  }

  let body: string;
  try {
    body = await request.text();
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return Response.json({ detail: "support.request_unavailable" }, { status: 400 });
  }
  if (new TextEncoder().encode(body).byteLength > 8192) {
    return Response.json({ detail: "support.request_too_large" }, { status: 413 });
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  try {
    const response = await fetch(`${apiUrl}/support/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store"
    });
    const responseBody = await response.text();
    return new Response(responseBody || null, {
      status: response.status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": response.headers.get("content-type") ?? "application/json"
      }
    });
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return Response.json({ detail: "support.service_unavailable" }, { status: 503 });
  }
}
