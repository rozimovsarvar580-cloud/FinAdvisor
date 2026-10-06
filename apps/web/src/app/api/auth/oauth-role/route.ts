import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  role: z.enum(["tadbirkor", "buxgalter", "investor"])
});

export async function POST(request: Request) {
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

  const response = NextResponse.json({ ok: true });
  response.cookies.set("finadvisor_oauth_role", parsed.data.role, {
    httpOnly: true,
    maxAge: 300,
    path: "/api/auth",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  return response;
}
