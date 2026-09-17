import { Card, CardContent } from "@/components/ui/card";
import { Users, Briefcase, Activity, CheckCircle2 } from "lucide-react";

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

  const metrics = [
    {
      title: "Total Leads",
      value: stats.totalLeads,
      icon: Users,
      iconColor: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    },
    {
      title: "Total Projects",
      value: stats.totalProjects,
      icon: Briefcase,
      iconColor: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10",
    },
    {
      title: "Projects In Progress",
      value: stats.inProduction,
      icon: Activity,
      iconColor: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
    },
    {
      title: "Closed Projects",
      value: stats.completed,
      icon: CheckCircle2,
      iconColor: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => {
        const IconComponent = metric.icon;
        return (
          <Card
            key={metric.title}
            className="border border-border/80 bg-card shadow-xs transition-colors hover:border-border"
          >
            <CardContent className="py-2 px-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-muted-foreground">
                  {metric.title}
                </span>
                <div className={`p-2 rounded-md shrink-0 ${metric.iconColor}`}>
                  <IconComponent className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-3">
                <div className="text-2xl font-bold text-foreground tracking-tight">
                  {metric.value}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
