export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response(null, { status: 403 });
  }

  const response = await fetch(
    `${process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000"}/analytics/consent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
      cache: "no-store"
    }
  );
  const responseBody = await response.text();
  const contentType = response.headers.get("content-type");
  return new Response(responseBody || null, {
    status: response.status,
    headers: contentType ? { "Content-Type": contentType } : undefined
  });
}
