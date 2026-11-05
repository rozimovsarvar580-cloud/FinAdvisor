import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

<<<<<<< HEAD
export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, type = "text", ...props }, ref) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground hover:border-primary/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-50 motion-reduce:transition-none",
        className
      )}
      ref={ref}
      type={type}
      {...props}
    />
  );
});
=======
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = "text", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground hover:border-primary/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-50 motion-reduce:transition-none",
          className
        )}
        type={type}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
