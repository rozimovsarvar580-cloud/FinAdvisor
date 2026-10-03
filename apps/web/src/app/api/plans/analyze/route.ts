export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { detail: "analysis.invalid_upload" },
      { status: 400 }
    );
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/plans/analyze`, {
      method: "POST",
      body: formData,
      cache: "no-store"
    });
  } catch {
    return Response.json(
      { detail: "analysis.service_unavailable" },
      { status: 503 }
    );
  }

  return Response.json(await response.json(), { status: response.status });
}
