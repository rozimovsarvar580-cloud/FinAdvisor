"use client";

import { useEffect } from "react";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep the boundary observable without exposing server error details to users.
    console.error("FinAdvisor page error");
  }, []);

  return (
    <main className="error-state" role="alert">
      <h1>Something went wrong</h1>
      <p>Please try refreshing the page.</p>
      <button type="button" onClick={() => reset()}>Try again</button>
    </main>
  );
}
