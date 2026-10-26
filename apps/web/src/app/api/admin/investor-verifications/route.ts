export async function GET(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) return Response.json({ detail: "auth.bearer_required" }, { status: 401 });
  try {
    const response = await fetch(`${process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000"}/admin/investor-verifications`, { headers: { Authorization: authorization }, cache: "no-store" });
    return Response.json(await response.json(), { status: response.status });
  } catch { return Response.json({ detail: "investor_verification.service_unavailable" }, { status: 503 }); }
}
