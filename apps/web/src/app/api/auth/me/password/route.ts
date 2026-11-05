import { forwardAuthenticatedAuthRequest } from "@/lib/auth-proxy";

export function POST(request: Request) {
  return forwardAuthenticatedAuthRequest(request, "me/password", "POST");
}
