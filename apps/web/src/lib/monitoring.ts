export function captureWebException(error: Error) {
  const value = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!value) return;
  try {
    const dsn = new URL(value);
    const publicKey = dsn.username;
    const projectId = dsn.pathname.split("/").filter(Boolean).at(-1);
    if (!publicKey || !projectId) return;
    const endpoint = `${dsn.protocol}//${dsn.host}${dsn.pathname.replace(/\/$/, "")}/api/${projectId}/envelope/`;
    const eventId = crypto.randomUUID().replaceAll("-", "");
    const event = {
      event_id: eventId,
      timestamp: new Date().toISOString(),
      platform: "javascript",
      exception: { values: [{ type: error.name, value: error.message, stacktrace: { frames: [] } }] },
    };
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body: `${JSON.stringify({ event_id: eventId, dsn: value })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}`,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Monitoring must not disrupt error recovery.
  }
}
