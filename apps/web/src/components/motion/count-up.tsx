"use client";

import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

type CountUpProps = {
  value: number;
  duration?: number;
  locale?: string;
  suffix?: string;
};

export function CountUp({
  value,
  duration = 1.25,
  locale = "en-US",
  suffix = ""
}: CountUpProps) {
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

  const displayValue = reduceMotion ? value : count;

  return (
    <span>
      {new Intl.NumberFormat(locale).format(displayValue)}
      {suffix}
    </span>
  );
}
