"use client";

import { useEffect } from "react";
import { captureWebException } from "@/lib/monitoring";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => captureWebException(error), [error]);
  return <html><body><main role="alert" /></body></html>;
}
