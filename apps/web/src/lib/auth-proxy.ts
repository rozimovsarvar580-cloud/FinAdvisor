import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

export async function forwardAuthenticatedAuthRequest(
  request: Request,
  endpoint: string,
  method: "GET" | "PATCH" | "POST"
): Promise<Response> {
  if (method !== "GET") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return new Response(null, { status: 403 });
    }
  }

  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return new Response(null, { status: 401 });
  }

  const headers = new Headers({
    Authorization: `Bearer ${session.accessToken}`
  });
  let body: string | undefined;
  if (method !== "GET") {
    headers.set("Content-Type", "application/json");
    body = await request.text();
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl}/auth/${endpoint}`, {
    method,
    headers,
    body,
    cache: "no-store"
  });
  const responseBody = await response.text();
  const contentType = response.headers.get("content-type");
  return new Response(responseBody || null, {
    status: response.status,
    headers: contentType ? { "Content-Type": contentType } : undefined
  });
}
