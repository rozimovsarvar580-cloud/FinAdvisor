import type { ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  loading?: boolean;
  variant?:
    | "primary"
    | "gradient"
    | "accent"
    | "outline"
    | "ghost"
    | "default"
    | "secondary"
    | "destructive";
  size?: "sm" | "md" | "lg" | "default" | "icon";
};

const variants = {
  primary:
    "bg-primary text-primary-foreground shadow-md hover:shadow-xl hover:shadow-primary/30",
  gradient:
    "bg-[image:var(--gradient-brand)] bg-[length:200%_100%] text-white shadow-lg hover:bg-right hover:shadow-primary/40",
  accent:
    "bg-accent text-accent-foreground shadow-sm hover:brightness-110 hover:shadow-lg",
  outline:
    "border border-border bg-card shadow-sm hover:border-primary hover:bg-primary/5 hover:shadow-md",
  ghost: "hover:bg-primary/10 hover:shadow-md",
  default: "bg-primary text-primary-foreground shadow-md hover:shadow-xl hover:shadow-primary/30",
  secondary: "bg-secondary text-secondary-foreground shadow-sm hover:shadow-md",
  destructive: "bg-red-600 text-white hover:bg-red-700"
};

const sizes = {
  sm: "h-9 px-3",
  md: "h-10 px-4 py-2",
  lg: "h-11 px-8",
  default: "h-10 px-4 py-2",
  icon: "h-10 w-10"
};

export function Button({
  className,
  asChild = false,
  loading = false,
  variant = "primary",
  size = "md",
  type = "button",
  disabled,
  children,
  "aria-busy": ariaBusy,
  "aria-disabled": ariaDisabled,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(
        "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:pointer-events-none aria-disabled:opacity-50 motion-reduce:transition-none",
        variants[variant],
        sizes[size],
        className
      )}
      type={asChild ? undefined : type}
      disabled={asChild ? disabled : disabled || loading}
      aria-busy={loading || ariaBusy || undefined}
      aria-disabled={loading || ariaDisabled || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && (
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
            />
          )}
          {children}
        </>
      )}
    </Component>
  );
}
