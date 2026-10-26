import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return new Response(null, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return new Response(null, { status: 403 });
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl}/admin/revenue/export`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store"
  });
  if (!response.ok) {
    return new Response(null, { status: response.status });
  }

  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "text/csv; charset=utf-8",
      "Content-Disposition":
        response.headers.get("content-disposition") ??
        'attachment; filename="revenue_dashboard.csv"',
      "Cache-Control": "private, no-store"
    }
  });
}
