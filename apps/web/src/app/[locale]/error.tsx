"use client";

import { RouteStatus } from "@/components/ui/route-states";

export default function ErrorPage({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteStatus onRetry={reset} variant="error" />;
}
