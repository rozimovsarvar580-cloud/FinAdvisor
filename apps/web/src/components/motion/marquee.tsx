"use client";

import { Children, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

type MarqueeProps = {
  children: ReactNode;
  className?: string;
  duration?: number;
};

export function Marquee({
  children,
  className,
  duration = 24
}: MarqueeProps) {
  const reduceMotion = useReducedMotion();
  const items = Children.toArray(children);

  if (reduceMotion) {
    return <div className={className}>{items}</div>;
  }

  return (
    <div className={cn("overflow-hidden", className)}>
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        className="flex w-max"
        transition={{ duration, ease: "linear", repeat: Infinity }}
      >
        {items}
        {items.map((item, index) => (
          <div aria-hidden="true" key={`marquee-copy-${index}`}>
            {item}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
