const planIdPattern = /^[A-Za-z0-9_-]{1,80}$/;
const planActionSegmentPattern = /^[A-Za-z0-9_-]{1,80}$/;
const shareTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export async function forwardPlanAction(
  request: Request,
  planId: string,
  actionSegments: string[]
): Promise<Response> {
  if (
    !planIdPattern.test(planId) ||
    actionSegments.length === 0 ||
    actionSegments.some((segment) => !planActionSegmentPattern.test(segment))
  ) {
    return Response.json({ detail: "plans.invalid_request" }, { status: 400 });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return Response.json(
      { detail: "plans.authentication_required" },
      { status: 401 }
    );
  }

  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "DELETE") {
    try {
      body = await request.text();
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      return Response.json(
        { detail: "plans.request_unavailable" },
        { status: 400 }
      );
    }
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  let upstream: Response;
  try {
    upstream = await fetch(
      `${apiUrl}/plans/${encodeURIComponent(planId)}/${actionSegments
        .map(encodeURIComponent)
        .join("/")}`,
      {
        method: request.method,
        headers: {
          Authorization: authorization,
          ...(body === undefined ? {} : { "Content-Type": "application/json" })
        },
        body,
        cache: "no-store"
      }
    );
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return Response.json(
      { detail: "plans.service_unavailable" },
      { status: 503 }
    );
  }

  if (upstream.status === 204) {
    return new Response(null, { status: 204 });
  }
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  headers.set("Cache-Control", "no-store");
  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers
  });
}

export async function forwardSharedPlan(token: string): Promise<Response> {
  if (!shareTokenPattern.test(token)) {
    return Response.json({ detail: "plans.invalid_share_token" }, { status: 400 });
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  let upstream: Response;
  try {
    upstream = await fetch(
      `${apiUrl}/plans/shared/${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return Response.json(
      { detail: "plans.service_unavailable" },
      { status: 503 }
    );
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  headers.set("Cache-Control", "no-store");
  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers
  });
}
