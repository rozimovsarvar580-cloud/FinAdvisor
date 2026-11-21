"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type InputHTMLAttributes
} from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const PasswordField = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type">
>(function PasswordField({ className, disabled, ...props }, forwardedRef) {
  const t = useTranslations("auth");
  const inputRef = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);
  useImperativeHandle(forwardedRef, () => inputRef.current!, []);

  function toggleVisibility() {
    setVisible((current) => !current);
    inputRef.current?.focus({ preventScroll: true });
  }

  return (
    <div className="relative">
      <Input
        {...props}
        className={cn("pr-12", className)}
        disabled={disabled}
        ref={inputRef}
        type={visible ? "text" : "password"}
      />
      <button
        aria-label={t(visible ? "hidePassword" : "showPassword")}
        aria-pressed={visible}
        className="absolute inset-y-0 right-1 my-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
        disabled={disabled}
        onClick={toggleVisibility}
        onMouseDown={(event) => event.preventDefault()}
        type="button"
      >
        {visible ? (
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            focusable="false"
            viewBox="0 0 24 24"
          >
            <path
              d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.7 10.7 0 0 1 12 5c5 0 8.3 4.4 9 7-.3 1.2-1.1 2.4-2.2 3.5M6.2 6.2C4.4 7.5 3.4 9.5 3 12c.7 2.6 4 7 9 7 1.3 0 2.5-.3 3.6-.8"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            focusable="false"
            viewBox="0 0 24 24"
          >
            <path
              d="M3 12c.7-2.6 4-7 9-7s8.3 4.4 9 7c-.7 2.6-4 7-9 7s-8.3-4.4-9-7Z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
            <circle
              cx="12"
              cy="12"
              r="3"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
        )}
      </button>
    </div>
  );
});

PasswordField.displayName = "PasswordField";
