import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { MetricCards } from "@/components/metric-cards";
import {
  getProjectsMasterOverview,
  getDashboardMetrics,
} from "@/app/actions/projects";
import { ProjectMasterTracker } from "@/components/dashboard/project-master-tracker";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (
    !session ||
    !session.user ||
    (!session.user.id && !session.user.username)
  ) {
    redirect("/login?clear=true");
  }

  const resolvedParams = await searchParams;
  const page = Number(resolvedParams.page) || 1;
  const search = (resolvedParams.search as string) || "";
  const searchBy =
    (resolvedParams.searchBy as
      | "all"
      | "project"
      | "clientName"
      | "clientCompany") || "all";
  const sortBy =
    (resolvedParams.sortBy as "deadline" | "createdAt" | "projectName") ||
    "deadline";
  const sortOrder = (resolvedParams.sortOrder as "asc" | "desc") || "asc";
  const tab = (resolvedParams.tab as string) || "active";
  const division = (resolvedParams.division as string) || "ALL";
  const start = (resolvedParams.start as string) || "";
  const end = (resolvedParams.end as string) || "";

  const [projectsResult, metricsResult] = await Promise.all([
    getProjectsMasterOverview({
      page,
      pageSize: 10,
      search,
      searchBy,
      sortBy,
      sortOrder,
      tab,
      division,
      start,
      end,
    }),
    getDashboardMetrics({ start, end }),
  ]);

  const projects = projectsResult.success ? projectsResult.data : [];
  const meta = projectsResult.meta || {
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
  };
  const metrics =
    metricsResult.success && metricsResult.data
      ? metricsResult.data
      : {
          totalLeads: 0,
          totalProjects: 0,
          newThisMonth: 0,
          pendingApproval: 0,
          inProduction: 0,
          completed: 0,
        };

  return (
    <div className="flex w-full overflow-hidden bg-background h-screen">
      <AppSidebar />
      <div className="flex flex-col flex-1 w-full bg-background md:rounded-tl-xl md:border-l md:border-t border-border overflow-hidden md:m-2 md:ml-0 shadow-xs relative">
        <DashboardHeader />
        <main className="flex-1 w-full px-4 sm:px-6 py-6 pb-6 overflow-y-auto overflow-x-hidden space-y-6 max-w-full 2xl:max-w-[1920px] mx-auto">
          {/* 1. Sederhana: 4 Metrik Analitik Utama */}
          <MetricCards data={metrics} />

          {/* 2. Global Project Pipeline (dengan persentase penyelesaian masterplan) */}
          <div className="w-full pb-4">
            <ProjectMasterTracker projects={projects as any[]} meta={meta} />
          </div>
        </main>
      </div>
    </div>
  );
}
