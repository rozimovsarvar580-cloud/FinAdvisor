import { forwardPlanAction } from "@/lib/plan-proxy";

type RouteContext = {
  params: { planId: string; action: string[] };
};

export async function GET(request: Request, { params }: RouteContext) {
  return forwardPlanAction(request, params.planId, params.action);
}

export async function POST(request: Request, { params }: RouteContext) {
  return forwardPlanAction(request, params.planId, params.action);
}

export async function DELETE(request: Request, { params }: RouteContext) {
  return forwardPlanAction(request, params.planId, params.action);
}
