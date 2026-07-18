"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Clock } from "lucide-react";

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
      {/* <Clock className="w-3.5 h-3.5 opacity-70 text-primary" /> */}
      <span className="text-xs font-semibold">
        {format(time, "EEEE, dd MMMM yyyy", { locale: id })}
      </span>
      <span className="text-sm opacity-40 mx-0.5">•</span>
      <span className="text-sm font-semibold tabular-nums">
        {format(time, "HH:mm:ss")}
      </span>
    </div>
  );
}
