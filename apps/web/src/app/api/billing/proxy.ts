type BillingApiMethod = "GET" | "POST";
type BillingApiAction = "summary" | "checkout" | "cancel" | "plan-change" | "payment-method";

export async function proxyBillingRequest(
  request: Request,
  action: BillingApiAction,
  method: BillingApiMethod
) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (
    (method === "POST" && (!origin || origin !== requestUrl.origin)) ||
    (origin && origin !== requestUrl.origin)
  ) {
    return new Response(null, { status: 403 });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return Response.json(
      { detail: "billing.authentication_required" },
      { status: 401 }
    );
  }

  let body: string | undefined;
  if (method === "POST") {
    try {
      body = await request.text();
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      return Response.json(
        { detail: "billing.request_unavailable" },
        { status: 400 }
      );
    }
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  try {
    const response = await fetch(`${apiUrl}/billing/${action}`, {
      method,
      headers:
        method === "POST"
          ? {
              Authorization: authorization,
              "Content-Type": "application/json"
            }
          : { Authorization: authorization },
      body,
      cache: "no-store"
    });
    const responseBody = await response.text();
    const contentType = response.headers.get("content-type");
    return new Response(responseBody || null, {
      status: response.status,
      headers: contentType ? { "Content-Type": contentType } : undefined
    });
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return Response.json(
      { detail: "billing.service_unavailable" },
      { status: 503 }
    );
  }
}
