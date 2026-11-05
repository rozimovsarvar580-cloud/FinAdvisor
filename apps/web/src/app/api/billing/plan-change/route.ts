import { proxyBillingRequest } from "../proxy";

export function POST(request: Request) {
  return proxyBillingRequest(request, "plan-change", "POST");
}
