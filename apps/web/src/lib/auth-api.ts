type AuthFlowEndpoint =
  | "forgot-password"
  | "reset-password"
  | "verify-email";

export async function forwardAuthFlowRequest(
  request: Request,
  endpoint: AuthFlowEndpoint
): Promise<Response> {
  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl}/auth/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
    cache: "no-store"
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") ?? "application/json"
    }
  });
}
