import { forwardAuthFlowRequest } from "@/lib/auth-api";

export function POST(request: Request) {
  return forwardAuthFlowRequest(request, "verify-email");
}
