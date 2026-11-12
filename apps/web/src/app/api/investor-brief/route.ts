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
    return Response.json({ detail: "investor_brief.request_unavailable" }, { status: 400 });
  }
  if (new TextEncoder().encode(body).byteLength > 4096) {
    return Response.json({ detail: "investor_brief.request_too_large" }, { status: 413 });
  }

  const apiUrl = (process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  try {
    const response = await fetch(`${apiUrl}/investor-brief/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store"
    });
    const headers = new Headers({
      "Cache-Control": "no-store",
      "Content-Type": response.headers.get("content-type") ?? "application/json"
    });
    const disposition = response.headers.get("content-disposition");
    if (disposition) headers.set("Content-Disposition", disposition);
    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers
    });
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return Response.json(
      { detail: "investor_brief.service_unavailable" },
      { status: 503 }
    );
  }
}
