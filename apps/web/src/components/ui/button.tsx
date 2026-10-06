import type { ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?:
    | "primary"
    | "gradient"
    | "accent"
    | "outline"
    | "ghost"
    | "default"
    | "secondary"
    | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
};

const variants = {
  primary:
    "bg-primary text-primary-foreground shadow-md hover:shadow-xl hover:shadow-primary/30",
  gradient:
    "bg-[image:var(--gradient-brand)] bg-[length:200%_100%] text-white shadow-lg hover:bg-right hover:shadow-primary/40",
  accent:
    "bg-accent text-accent-foreground hover:brightness-110 hover:shadow-lg",
  outline:
    "border border-border bg-card hover:border-primary hover:bg-primary/5",
  ghost: "hover:bg-primary/10",
  default:
    "bg-primary text-primary-foreground shadow-md hover:shadow-xl hover:shadow-primary/30",
  secondary:
    "bg-secondary text-secondary-foreground shadow-sm hover:shadow-md",
  destructive: "bg-red-600 text-white hover:bg-red-700"
};

const sizes = {
  default: "h-10 px-4 py-2",
  sm: "h-9 px-3",
  lg: "h-11 px-8",
  icon: "h-10 w-10"
};

export function Button({
  className,
  asChild = false,
  variant = "default",
  size = "default",
  type = "button",
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(
        "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      type={asChild ? undefined : type}
      {...props}
    />
  );
}
