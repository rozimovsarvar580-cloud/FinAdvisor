"use client";

import { motion, useReducedMotion } from "framer-motion";

import { Card } from "@/components/ui/card";

export type LandingDashboardPreviewProps = {
  ariaLabel: string;
  title: string;
  subtitle: string;
  revenueLabel: string;
  costsLabel: string;
  cashFlowLabel: string;
  visualNote: string;
};

export function LandingDashboardPreview({
  ariaLabel,
  title,
  subtitle,
  revenueLabel,
  costsLabel,
  cashFlowLabel,
  visualNote
}: LandingDashboardPreviewProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-label={ariaLabel} className="relative" role="group">
      <div
        aria-hidden="true"
        className="absolute -inset-5 rounded-[2rem] bg-primary/10 blur-2xl"
      />
      <Card className="relative overflow-hidden rounded-3xl p-5 shadow-xl sm:p-7">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M4 19V5m0 14h16M8 15l3-4 3 2 5-7"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold sm:text-base">{title}</h2>
              <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-success"
          />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          {[revenueLabel, costsLabel, cashFlowLabel].map((label) => (
            <div
              className="min-w-0 rounded-xl border border-border bg-background p-3 sm:p-4"
              key={label}
            >
              <p className="truncate text-[0.65rem] text-muted-foreground sm:text-xs">
                {label}
              </p>
              <p aria-hidden="true" className="mt-2 text-lg font-semibold sm:text-xl">
                —
              </p>
              <div aria-hidden="true" className="mt-2 h-1.5 rounded-full bg-muted">
                <div className="h-full w-2/3 rounded-full bg-primary/40" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background p-3 sm:p-4">
          <svg
            aria-hidden="true"
            className="h-28 w-full text-primary sm:h-32"
            preserveAspectRatio="none"
            viewBox="0 0 440 112"
          >
            <path
              d="M0 91H440M0 57H440M0 23H440"
              className="stroke-border"
              strokeDasharray="3 6"
              strokeWidth="1"
            />
            <motion.path
              animate={reduceMotion ? undefined : { pathLength: 1 }}
              d="M4 84C39 77 45 62 79 67s44 20 74 7 40-37 73-29 45 26 74 14 44-31 68-24 44 7 68-18"
              fill="none"
              initial={reduceMotion ? false : { pathLength: 0 }}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
            />
            <motion.circle
              animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
              className="origin-center text-accent"
              cx="436"
              cy="17"
              fill="currentColor"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.5 }}
              r="4"
              transition={{ duration: 0.3, delay: 1.25 }}
            />
          </svg>
          <p className="px-1 pt-1 text-xs leading-5 text-muted-foreground">
            {visualNote}
          </p>
        </div>
      </Card>
    </div>
  );
}
