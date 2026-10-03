import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Toast({
  title,
  children,
  className
}: {
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg",
        className
      )}
      role="status"
    >
      <p className="text-sm font-semibold">{title}</p>
      {children ? (
        <div className="mt-1 text-sm text-muted-foreground">{children}</div>
      ) : null}
    </div>
  );
}
