"use client";

import { useState, useEffect } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";

const data = [
  { name: "Jun 1", value: 100 },
  { name: "Jun 3", value: 140 },
  { name: "Jun 5", value: 90 },
  { name: "Jun 7", value: 180 },
  { name: "Jun 9", value: 200 },
  { name: "Jun 11", value: 110 },
  { name: "Jun 13", value: 250 },
  { name: "Jun 15", value: 190 },
  { name: "Jun 17", value: 300 },
  { name: "Jun 19", value: 150 },
  { name: "Jun 21", value: 280 },
  { name: "Jun 23", value: 380 },
  { name: "Jun 25", value: 220 },
  { name: "Jun 27", value: 350 },
  { name: "Jun 30", value: 280 },
];

export function VisitorsChart() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="flex items-start justify-between pb-2 flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-base">Project Timeline Tracker</h3>
          <p className="text-sm text-muted-foreground">Volume aktivitas dari Leads hingga Closing</p>
        </div>
        <div className="flex gap-1 bg-muted/30 p-1 rounded-md border border-border/50">
          <Button variant="ghost" size="sm" className="h-8 text-xs font-normal text-muted-foreground hover:text-foreground">Last 3 months</Button>
          <Button variant="secondary" size="sm" className="h-8 text-xs font-medium bg-accent/70 text-accent-foreground shadow-none">Last 30 days</Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs font-normal text-muted-foreground hover:text-foreground">Last 7 days</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        <div className="w-full min-w-0 mt-4 px-2 sm:px-0">
          {!mounted ? (
            <div className="w-full h-[280px] bg-muted/20 animate-pulse rounded-xl" />
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tickMargin={10}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)" }}
                    itemStyle={{ color: "var(--foreground)", fontSize: "14px", fontWeight: 500 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="var(--chart-1)" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
