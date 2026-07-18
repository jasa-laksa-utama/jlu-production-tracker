import {
  getProjectsByDivision,
  getDivisionStats,
} from "@/app/actions/projects";
import { EngineeringTable } from "@/components/trackers/engineering-table";
import {
  PenTool,
  Box,
  AlertCircle,
  Info,
  LayoutDashboard,
  CheckCircle2,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Metadata } from "next";
import { AppSidebar } from "@/components/app-sidebar";

export const metadata: Metadata = {
  title: "Engineering Tracker | PT. JLU Production",
  description:
    "Track project designs, BoQ, and drawings in the Engineering division.",
};

export default async function EngineeringTrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams.page) || 1;
  const limit = Number(resolvedParams.limit) || 10;
  const search = (resolvedParams.search as string) || "";
  const status = (resolvedParams.status as string) || "ALL";
  const start = (resolvedParams.start as string) || "";
  const end = (resolvedParams.end as string) || "";
  const sort = (resolvedParams.sort as string) || "desc";

  const [projectsResult, statsResult] = await Promise.all([
    getProjectsByDivision("ENGINEERING", {
      page,
      pageSize: limit,
      search,
      status,
      startDate: start,
      endDate: end,
      sortOrder: sort as any,
    }),
    getDivisionStats("ENGINEERING"),
  ]);

  const projects = projectsResult.success ? (projectsResult.data as any[]) : [];
  const meta = projectsResult.success
    ? projectsResult.meta
    : { totalPages: 1, totalCount: 0, currentPage: 1 };
  const stats = statsResult.success
    ? statsResult.data
    : { totalActive: 0, inProgress: 0, review: 0, approved: 0 };

  return (
    <div className="flex w-full overflow-hidden bg-background h-screen">
      <AppSidebar />
      <div className="flex flex-col flex-1 w-full bg-background md:rounded-tl-xl md:border-l md:border-t border-border overflow-hidden md:m-2 md:ml-0 shadow-sm relative">
        <DashboardHeader />

        <main className="flex-1 w-full p-6 pb-2 overflow-y-auto overflow-x-hidden space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          {/* Simple Header */}
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Engineering</h2>
            <p className="text-muted-foreground">
              Technical design, BoQ, Drawing, and Mechanical Part List
              management.
            </p>
          </div>

          {/* Clean Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-sidebar-accent/30 border border-border p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-semibold">
                  Total Active
                </p>
                <h3 className="text-xl font-bold">{stats?.totalActive || 0}</h3>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <LayoutDashboard className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-sidebar-accent/30 border border-border p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-semibold">
                  In Progress
                </p>
                <h3 className="text-xl font-bold ">{stats?.inProgress || 0}</h3>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <PenTool className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-sidebar-accent/30 border border-border p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-semibold">
                  In Review
                </p>
                <h3 className="text-xl font-bold ">{stats?.review || 0}</h3>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-sidebar-accent/30 border border-border p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-semibold">
                  Approved
                </p>
                <h3 className="text-xl font-bold ">{stats?.approved || 0}</h3>
              </div>
              <div className="p-2 bg-green-500/10 rounded-lg text-green-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Table Section */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Working Pipeline</h3>
            </div>
            <EngineeringTable projects={JSON.parse(JSON.stringify(projects))} meta={meta} />
          </div>
        </main>
      </div>
    </div>
  );
}
