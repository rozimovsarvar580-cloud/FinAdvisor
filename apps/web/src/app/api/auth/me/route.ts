import { forwardAuthenticatedAuthRequest } from "@/lib/auth-proxy";

export function GET(request: Request) {
  return forwardAuthenticatedAuthRequest(request, "me", "GET");
}

export function PATCH(request: Request) {
  return forwardAuthenticatedAuthRequest(request, "me", "PATCH");
}
