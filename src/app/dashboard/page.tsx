import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { MetricCards } from "@/components/metric-cards";
import { DashboardKPIPanel } from "@/components/dashboard/dashboard-kpi-panel";
import { getProjectsMasterOverview, getDashboardMetrics } from "@/app/actions/projects";
import { ProjectMasterTracker } from "@/components/dashboard/project-master-tracker";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams.page) || 1;
  const search = (resolvedParams.search as string) || "";
  const tab = (resolvedParams.tab as string) || "active";
  const division = (resolvedParams.division as string) || "ALL";
  const start = (resolvedParams.start as string) || "";
  const end = (resolvedParams.end as string) || "";

  const [projectsResult, metricsResult] = await Promise.all([
    getProjectsMasterOverview({
      page,
      pageSize: 10,
      search,
      sortOrder: "desc",
      tab,
      division,
      start,
      end,
    }),
    getDashboardMetrics({ start, end }),
  ]);

  const projects = projectsResult.success ? projectsResult.data : [];
  const meta = projectsResult.meta || { totalCount: 0, totalPages: 1, currentPage: 1 };
  const metrics = metricsResult.success && metricsResult.data ? metricsResult.data : {
    totalLeads: 0,
    totalProjects: 0,
    newThisMonth: 0,
    pendingApproval: 0,
    inProduction: 0,
    completed: 0,
    averageLeadTime: 12.4,
    qcPassRate: 95,
    onTimeRate: 92,
    divisionLoad: {},
    topLeaders: [],
    recentActivity: [],
    monthlyOutput: [],
  };

  return (
    <div className="flex w-full overflow-hidden bg-background h-screen">
      <AppSidebar />
      <div className="flex flex-col flex-1 w-full bg-background md:rounded-tl-xl md:border-l md:border-t border-border overflow-hidden md:m-2 md:ml-0 shadow-sm relative">
        <DashboardHeader />
        <main className="flex-1 w-full p-6 pb-2 overflow-y-auto overflow-x-hidden space-y-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          {/* 1. Metrics Cards */}
          <MetricCards data={metrics} />
          
          {/* 2. Visual KPI Charts & Panels */}
          <div className="w-full">
            <DashboardKPIPanel metrics={metrics} />
          </div>

          {/* 3. Global Project Pipeline (Table with Action Controls at the top) */}
          <div className="w-full pb-8 space-y-4">
            <ProjectMasterTracker projects={projects as any[]} meta={meta} />
          </div>
        </main>
      </div>
    </div>
  );
}
