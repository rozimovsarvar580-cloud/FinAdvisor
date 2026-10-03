import { forwardDocumentExport } from "@/lib/document-proxy";

export async function POST(
  request: Request,
  { params }: { params: { planId: string; format: string } }
) {
  return forwardDocumentExport(request, params.planId, params.format);
}
