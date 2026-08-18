"use client";

import { useState, useEffect } from "react";
import { formatJakartaDate } from "@/lib/date-utils";

export function DigitalClock() {
  const [time, setTime] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTime(new Date());
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!mounted || !time) return null;

  return (
    <div className="flex items-center gap-2 text-muted-foreground select-none">
      <span className="text-xs font-semibold">
        {formatJakartaDate(time, "full").replace(/\s+\d{2}[:\.]\d{2}.*/, "")}
      </span>
      <span className="text-sm opacity-40 mx-0.5">•</span>
      <span className="text-sm font-semibold tabular-nums">
        {formatJakartaDate(time, "time")}
      </span>
    </div>
  );
}
