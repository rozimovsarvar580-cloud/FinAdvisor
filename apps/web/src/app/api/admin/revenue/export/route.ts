import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "admin") {
    return Response.json({ error: "admin.required" }, { status: 403 });
  }
  if (!session.accessToken) {
    return Response.json({ error: "auth.required" }, { status: 401 });
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl}/admin/revenue/export`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store"
  });
  const headers = new Headers({ "Cache-Control": "no-store" });
  const contentType = response.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  if (response.ok) {
    headers.set("Content-Disposition", "attachment; filename=admin_revenue.csv");
  }

  return new Response(response.body, {
    status: response.status,
    headers
  });
}
