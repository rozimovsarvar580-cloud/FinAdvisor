import { forwardSharedPlan } from "@/lib/plan-proxy";

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  return forwardSharedPlan(params.token);
}
