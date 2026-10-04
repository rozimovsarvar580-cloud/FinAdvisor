export async function GET(request: Request) {
  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  const mine = new URL(request.url).searchParams.get("mine") === "true";
  const authorization = request.headers.get("Authorization");
  if (mine && !authorization) {
    return Response.json(
      { detail: "marketplace.sign_in_required" },
      { status: 401 }
    );
  }

  try {
    const response = await fetch(
      `${apiUrl}/marketplace/listings${mine ? "/mine" : ""}`,
      {
        headers: authorization ? { Authorization: authorization } : undefined,
        cache: "no-store"
      }
    );
    return Response.json(await response.json(), { status: response.status });
  } catch {
    return Response.json(
      { detail: "marketplace.service_unavailable" },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return Response.json(
      { detail: "marketplace.sign_in_required" },
      { status: 401 }
    );
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return Response.json(
      { detail: "marketplace.invalid_listing" },
      { status: 400 }
    );
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  try {
    const response = await fetch(`${apiUrl}/marketplace/listings`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json"
      },
      body,
      cache: "no-store"
    });
    return Response.json(await response.json(), { status: response.status });
  } catch {
    return Response.json(
      { detail: "marketplace.service_unavailable" },
      { status: 503 }
    );
  }
}
