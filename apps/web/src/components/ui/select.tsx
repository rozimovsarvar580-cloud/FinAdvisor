import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors hover:border-primary/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-50 motion-reduce:transition-none",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
