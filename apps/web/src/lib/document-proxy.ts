const planIdPattern = /^[A-Za-z0-9_-]{1,80}$/;
const exportFormats = new Set(["pdf", "excel", "bank-pack", "synergy"]);

export async function forwardDocumentExport(
  request: Request,
  planId: string,
  format: string
): Promise<Response> {
  if (!planIdPattern.test(planId) || !exportFormats.has(format)) {
    return Response.json({ detail: "documents.invalid_request" }, { status: 400 });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return Response.json(
      { detail: "documents.authentication_required" },
      { status: 401 }
    );
  }

  const body = await request.text();

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  let upstream: Response;
  try {
    upstream = await fetch(
      `${apiUrl}/documents/${encodeURIComponent(planId)}/${format}`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json"
        },
        body,
        cache: "no-store"
      }
    );
  } catch (error) {
    if (error instanceof TypeError) {
      return Response.json({ detail: "documents.service_unavailable" }, { status: 503 });
    }
    throw error;
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const contentDisposition = upstream.headers.get("content-disposition");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  if (contentDisposition) {
    headers.set("Content-Disposition", contentDisposition);
  }
  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers
  });
}
