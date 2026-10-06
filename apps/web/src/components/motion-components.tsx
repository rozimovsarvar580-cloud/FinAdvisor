"use client";

import { Children, useEffect, useState, type ReactNode } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

type AnimatedContentProps = {
  children: ReactNode;
  className?: string;
};

export function Reveal({ children, className }: AnimatedContentProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerList({
  children,
  className,
  staggerDelay = 0.08
}: AnimatedContentProps & { staggerDelay?: number }) {
  const reduceMotion = useReducedMotion();
  const items = Children.toArray(children);

  return (
    <motion.div
      className={cn("grid", className)}
      initial={reduceMotion ? false : "hidden"}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } }
      }}
      viewport={{ once: true, amount: 0.15 }}
      whileInView={reduceMotion ? undefined : "visible"}
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

export function CountUp({
  value,
  duration = 1.25,
  locale = "en-US",
  suffix = ""
}: {
  value: number;
  duration?: number;
  locale?: string;
  suffix?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      setCount(value);
      return;
    }

    const controls = animate(0, value, {
      duration,
      onUpdate: (latest) => setCount(Math.round(latest))
    });
    return () => controls.stop();
  }, [duration, reduceMotion, value]);

  return (
    <span>
      {new Intl.NumberFormat(locale).format(count)}
      {suffix}
    </span>
  );
}

export function Marquee({
  children,
  className,
  duration = 24
}: AnimatedContentProps & { duration?: number }) {
  const reduceMotion = useReducedMotion();
  const items = Children.toArray(children);

  return (
    <div className={cn("overflow-hidden", className)}>
      <motion.div
        animate={reduceMotion ? undefined : { x: ["0%", "-50%"] }}
        className="flex w-max"
        transition={
          reduceMotion
            ? undefined
            : { duration, ease: "linear", repeat: Infinity }
        }
      >
        {items}
        {reduceMotion
          ? null
          : items.map((item, index) => (
              <div aria-hidden="true" key={`marquee-copy-${index}`}>
                {item}
              </div>
            ))}
      </motion.div>
    </div>
  );
}
