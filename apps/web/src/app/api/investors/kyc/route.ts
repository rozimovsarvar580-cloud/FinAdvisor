async function forward(request: Request, method: "GET" | "PUT") {
  const authorization = request.headers.get("Authorization");
  if (!authorization) return Response.json({ detail: "auth.bearer_required" }, { status: 401 });
  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  try {
    const response = await fetch(`${apiUrl}/investors/kyc`, {
      method, headers: { Authorization: authorization, ...(method === "PUT" ? { "Content-Type": "application/json" } : {}) },
      body: method === "PUT" ? await request.text() : undefined, cache: "no-store"
    });
    return Response.json(await response.json(), { status: response.status });
  } catch { return Response.json({ detail: "investor_verification.service_unavailable" }, { status: 503 }); }
}
export const GET = (request: Request) => forward(request, "GET");
export const PUT = (request: Request) => forward(request, "PUT");
