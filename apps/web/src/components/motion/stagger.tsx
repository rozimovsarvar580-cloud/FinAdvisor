"use client";

import { Children, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

type StaggerProps = {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
};

export function Stagger({
  children,
  className,
  staggerDelay = 0.08
}: StaggerProps) {
  const reduceMotion = useReducedMotion();
  const items = Children.toArray(children);
  const classes = cn("grid", className);

  if (reduceMotion) {
    return <div className={classes}>{items}</div>;
  }

  return (
    <motion.div
      className={classes}
      initial="hidden"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } }
      }}
      viewport={{ once: true, amount: 0.15 }}
      whileInView="visible"
    >
      {items.map((item, index) => (
        <motion.div
          key={index}
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0 }
          }}
        >
          {item}
        </motion.div>
      ))}
    </motion.div>
  );
}

export const StaggerList = Stagger;
