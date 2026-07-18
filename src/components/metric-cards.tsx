import { Card, CardContent } from "./ui/card";
import { Compass, Boxes, Activity, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardsProps {
  data?: {
    totalLeads: number;
    totalProjects: number;
    newThisMonth: number;
    pendingApproval: number;
    inProduction: number;
    completed: number;
  };
}

export function MetricCards({ data }: MetricCardsProps) {
  const stats = data || {
    totalLeads: 0,
    totalProjects: 0,
    newThisMonth: 0,
    pendingApproval: 0,
    inProduction: 0,
    completed: 0,
  };

  const completionRate = stats.totalProjects > 0
    ? Math.round((stats.completed / stats.totalProjects) * 100)
    : 0;

  const inProgressRate = stats.totalProjects > 0
    ? Math.round((stats.inProduction / stats.totalProjects) * 100)
    : 0;

  const metrics = [
    {
      title: "Total Leads",
      value: stats.totalLeads,
      badgeText: "Negosiasi",
      badgeStyle: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      subtext: "Potential deals",
      subtextRight: "Active Sales",
      subtextRightClass: "text-amber-500",
      themeColor: "amber",
      icon: Compass,
      iconClass: "text-amber-500 bg-amber-500/10",
      glowClass: "shadow-amber-500/5",
    },
    {
      title: "Total Projects",
      value: stats.totalProjects,
      badgeText: `+${stats.newThisMonth} Baru`,
      badgeStyle: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      subtext: "Overall SO volume",
      subtextRight: "Contract Active",
      subtextRightClass: "text-indigo-500",
      themeColor: "indigo",
      icon: Boxes,
      iconClass: "text-indigo-500 bg-indigo-500/10",
      glowClass: "shadow-indigo-500/5",
    },
    {
      title: "In Progress",
      value: stats.inProduction,
      badgeText: `${inProgressRate}%`,
      badgeStyle: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      subtext: "Active manufacturing",
      subtextRight: "Pulsing",
      subtextRightClass: "text-blue-500",
      themeColor: "blue",
      icon: Activity,
      iconClass: "text-blue-500 bg-blue-500/10",
      glowClass: "shadow-blue-500/5",
    },
    {
      title: "Closed Projects",
      value: stats.completed,
      badgeText: `${completionRate}%`,
      badgeStyle: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      subtext: "Delivered & archived",
      subtextRight: "Finished",
      subtextRightClass: "text-emerald-500",
      themeColor: "emerald",
      icon: CheckCircle2,
      iconClass: "text-emerald-500 bg-emerald-500/10",
      glowClass: "shadow-emerald-500/5",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((metric, index) => {
        const IconComponent = metric.icon;
        return (
          <Card
            key={index}
            className={cn(
              "relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 border border-zinc-200 dark:border-zinc-800/80 bg-background/80 dark:bg-zinc-950/80 backdrop-blur-md flex flex-col justify-between hover:shadow-md",
              metric.glowClass
            )}
          >
            {/* Top accent border */}
            <div className={cn("absolute top-0 left-0 right-0 h-[3px]", 
              metric.themeColor === "amber" && "bg-amber-500",
              metric.themeColor === "indigo" && "bg-indigo-500",
              metric.themeColor === "blue" && "bg-blue-500",
              metric.themeColor === "emerald" && "bg-emerald-500",
            )} />

            {/* Glowing spot */}
            <div className={cn("absolute -right-16 -top-16 w-28 h-28 rounded-full blur-2xl opacity-[0.04] group-hover:opacity-[0.1] transition-opacity duration-300 pointer-events-none",
              metric.themeColor === "amber" && "bg-amber-500",
              metric.themeColor === "indigo" && "bg-indigo-500",
              metric.themeColor === "blue" && "bg-blue-500",
              metric.themeColor === "emerald" && "bg-emerald-500",
            )} />

            <CardContent className="p-4 pt-4 flex flex-col h-full justify-between z-10">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("p-2 rounded-lg shrink-0 transition-colors duration-300", metric.iconClass)}>
                    <IconComponent className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                      {metric.title}
                    </span>
                    <div className="text-2xl font-black text-foreground leading-none mt-1">
                      {metric.value}
                    </div>
                  </div>
                </div>

                {/* Right Action slot (Badge) */}
                <div className="shrink-0 flex items-center pl-2">
                  {metric.badgeText && (
                    <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full border leading-none select-none", metric.badgeStyle)}>
                      {metric.badgeText}
                    </span>
                  )}
                </div>
              </div>

              {/* Tiny footer border */}
              <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="truncate mr-2">{metric.subtext}</span>
                <span className={cn("font-bold shrink-0", metric.subtextRightClass)}>{metric.subtextRight}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
