import { notFound } from "next/navigation";

import en from "@/messages/en.json";
import ru from "@/messages/ru.json";
import uz from "@/messages/uz.json";

const locales = ["uz", "ru", "en"] as const;
const messages = { uz, ru, en } as const;
const services = ["database", "redis", "migrations"] as const;

type ServiceName = (typeof services)[number];
type ServiceState = "operational" | "issue" | "unknown";
type ReadinessState = "operational" | "degraded" | "unavailable";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getReadiness(): Promise<{
  state: ReadinessState;
  checks: Record<ServiceName, ServiceState>;
}> {
  const checks: Record<ServiceName, ServiceState> = {
    database: "unknown",
    redis: "unknown",
    migrations: "unknown"
  };
  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";

  let response: Response;
  try {
    response = await fetch(new URL("/ready", apiUrl), {
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });
  } catch (error) {
    if (
      error instanceof TypeError ||
      (error instanceof DOMException && error.name === "TimeoutError")
    ) {
      return { state: "unavailable", checks };
    }
    throw error;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) return { state: "unavailable", checks };
    throw error;
  }

  const payloadChecks = isRecord(payload) && isRecord(payload.checks)
    ? payload.checks
    : undefined;
  for (const service of services) {
    const serviceStatus = payloadChecks?.[service];
    checks[service] =
      serviceStatus === "ok"
        ? "operational"
        : serviceStatus === "error" || serviceStatus === "pending"
          ? "issue"
          : "unknown";
  }

  const operational =
    response.ok &&
    isRecord(payload) &&
    payload.status === "ok" &&
    services.every((service) => checks[service] === "operational");
  return { state: operational ? "operational" : "degraded", checks };
}

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function StatusPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();

  const [copy, readiness] = await Promise.all([
    Promise.resolve(messages[locale as keyof typeof messages].statusPage),
    getReadiness()
  ]);
  const stateCopy = copy[readiness.state];

  return (
    <main className="mx-auto max-w-4xl px-page py-section">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          {copy.description}
        </p>
      </header>
      <section
        aria-label={copy.title}
        className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-8"
      >
        <p
          aria-live="polite"
          className={
            readiness.state === "operational"
              ? "font-semibold text-primary"
              : readiness.state === "degraded"
                ? "font-semibold text-destructive"
                : "font-semibold text-muted-foreground"
          }
          role="status"
        >
          {stateCopy}
        </p>
        <ul className="mt-5 divide-y divide-border">
          {services.map((service) => {
            const state = readiness.checks[service];
            const label =
              state === "operational"
                ? copy.states.operational
                : state === "issue"
                  ? copy.states.issue
                  : copy.states.unknown;
            return (
              <li
                className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                key={service}
              >
                <span>{copy.services[service]}</span>
                <span className="text-muted-foreground">{label}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-5 text-sm leading-6 text-muted-foreground">{copy.scope}</p>
      </section>
    </main>
  );
}
