import { forwardAuthenticatedAuthRequest } from "@/lib/auth-proxy";

export function GET(request: Request) {
  return forwardAuthenticatedAuthRequest(request, "me/export", "GET");
}
