import { proxyReportRequest } from "../proxy";

export async function GET(request: Request, context: { params: Promise<{ period: string }> }) {
  const { period } = await context.params;
  return proxyReportRequest(request, period);
}
