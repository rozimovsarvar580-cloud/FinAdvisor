const periods = new Set(["day", "week", "month", "year"]);

export async function proxyReportRequest(request: Request, period: string) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) return Response.json({ detail: "reports.authentication_required" }, { status: 401 });
  if (!periods.has(period)) return Response.json({ detail: "reports.period_not_found" }, { status: 404 });
  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  try {
    const response = await fetch(`${apiUrl}/reports/${period}`, {
      headers: { Authorization: authorization }, cache: "no-store"
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: response.headers.get("content-type") ? { "Content-Type": response.headers.get("content-type")! } : undefined
    });
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return Response.json({ detail: "reports.service_unavailable" }, { status: 503 });
  }
}
