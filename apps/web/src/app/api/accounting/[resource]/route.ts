import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const resources = new Set(["inventory", "stock-movements", "sales", "expenses"]);
export async function GET(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  if (!resources.has(resource)) return Response.json({ detail: "accounting.resource_not_found" }, { status: 404 });
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return Response.json({ detail: "accounting.authentication_required" }, { status: 401 });
  return forward(resource, session.accessToken, "GET");
}
export async function POST(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const { resource } = await params;
  if (!resources.has(resource)) return Response.json({ detail: "accounting.resource_not_found" }, { status: 404 });
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return Response.json({ detail: "accounting.authentication_required" }, { status: 401 });
  let data: unknown;
  try { data = await request.json(); } catch { return new Response(null, { status: 400 }); }
  return forward(resource, session.accessToken, "POST", JSON.stringify({ client_id: crypto.randomUUID(), data }));
}
async function forward(resource: string, token: string, method: string, body?: string) {
  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl}/accounting/${method === "POST" ? `sync/${resource}` : resource}`, {
    method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body, cache: "no-store"
  });
  return new Response(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } });
}
