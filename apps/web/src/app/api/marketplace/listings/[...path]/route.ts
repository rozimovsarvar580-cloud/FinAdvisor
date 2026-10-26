type Context = { params: { path: string[] } };

async function proxy(request: Request, { params }: Context) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) return Response.json({ detail: "marketplace.sign_in_required" }, { status: 401 });
  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  const path = params.path.map(encodeURIComponent).join("/");
  try {
    const response = await fetch(`${apiUrl}/marketplace/listings/${path}`, {
      method: request.method,
      headers: { Authorization: authorization, ...(request.headers.get("Content-Type") ? { "Content-Type": request.headers.get("Content-Type")! } : {}) },
      ...(request.method === "GET" || request.method === "HEAD" ? {} : { body: await request.text() }),
      cache: "no-store"
    });
    return Response.json(await response.json(), { status: response.status });
  } catch {
    return Response.json({ detail: "marketplace.service_unavailable" }, { status: 503 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
