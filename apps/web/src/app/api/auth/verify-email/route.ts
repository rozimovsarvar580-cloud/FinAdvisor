<<<<<<< HEAD
import { NextRequest, NextResponse } from "next/server";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export async function POST(request: NextRequest) {
  const response = await fetch(`${apiUrl}/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(await request.json()),
    cache: "no-store"
  });
  return NextResponse.json(await response.json(), { status: response.status });
=======
import { forwardAuthFlowRequest } from "@/lib/auth-api";

export function POST(request: Request) {
  return forwardAuthFlowRequest(request, "verify-email");
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
}
