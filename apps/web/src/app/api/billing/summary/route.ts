import { proxyBillingRequest } from "../proxy";

export function GET(request: Request) {
  return proxyBillingRequest(request, "summary", "GET");
}
