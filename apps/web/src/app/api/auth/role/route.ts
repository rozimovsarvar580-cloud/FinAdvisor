import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";

const requestSchema = z.object({
  role: z.enum(["tadbirkor", "buxgalter", "investor"])
});

export async function PATCH(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return new Response(null, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return new Response(null, { status: 400 });
    }
    throw error;
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(null, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return new Response(null, { status: 401 });
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl}/auth/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`
    },
    body: JSON.stringify(parsed.data),
    cache: "no-store"
  });
  const responseBody = await response.text();
  return new Response(responseBody, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") ?? "application/json"
    }
  });
}
