export async function GET() {
  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  try {
    const response = await fetch(`${apiUrl}/sectors`, { cache: "no-store" });
    return Response.json(await response.json(), { status: response.status });
  } catch {
    return Response.json({ detail: "sectors.service_unavailable" }, { status: 503 });
  }
}
