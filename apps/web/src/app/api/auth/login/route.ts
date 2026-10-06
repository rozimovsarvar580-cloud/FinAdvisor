import { NextRequest, NextResponse } from "next/server";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok) return NextResponse.json(body, { status: response.status });

  const result = NextResponse.json({ message: body.message, email: body.email });
  result.cookies.set("finadvisor_token", body.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return result;
}
