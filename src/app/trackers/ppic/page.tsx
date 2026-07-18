import {
  getProjectsByDivision,
  getDivisionStats,
} from "@/app/actions/projects";
import { PpicTable } from "@/components/trackers/ppic-table";
import {
  LayoutDashboard,
  Clock,
  CheckCircle2,
  Package,
  AlertTriangle,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Metadata } from "next";
import { AppSidebar } from "@/components/app-sidebar";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "PPIC Tracker | PT. JLU Production",
  description: "Manage project approvals and production planning.",
};

export default async function PpicTrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams.page) || 1;
  const limit = Number(resolvedParams.limit) || 10;
  const search = (resolvedParams.search as string) || "";
  const status = (resolvedParams.status as string) || "ALL";
  const sort = (resolvedParams.sort as string) || "desc";

  const [projectsResult, statsResult] = await Promise.all([
    getProjectsByDivision("PPIC", {
      page,
      pageSize: limit,
      search,
      status,
      sortOrder: sort as any,
    }),
    getDivisionStats("PPIC"),
  ]);

  const projects = projectsResult.success ? (projectsResult.data as any[]) : [];
  const meta = projectsResult.success
    ? projectsResult.meta
    : { totalPages: 1, totalCount: 0, currentPage: 1 };

  const stats =
    statsResult.success && statsResult.data
      ? (statsResult.data as any)
      : {
          totalActive: 0,
          review: 0,
          approvedPpic: 0,
          waitingInventory: 0,
          readyForProduction: 0,
        };

  return (
    <div className="flex w-full overflow-hidden bg-background h-screen">
      <AppSidebar />
      <div className="flex flex-col flex-1 w-full bg-background md:rounded-tl-xl md:border-l md:border-t border-border overflow-hidden md:m-2 md:ml-0 shadow-sm relative">
        <DashboardHeader />

        <main className="flex-1 w-full p-6 pb-8 overflow-y-auto overflow-x-hidden space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight">PPIC</h2>
            <p className="text-muted-foreground">
              Production Planning and Inventory Control
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Card 1: Total Project */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-xs flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Total Project
                </span>
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                  <LayoutDashboard className="w-4.5 h-4.5" />
                </div>
              </div>
              <div>
                <span className="text-2xl font-black tracking-tight text-foreground block">
                  {stats?.totalActive || 0}
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold mt-1 block">
                  Proyek Aktif
                </span>
              </div>
            </div>

            {/* Card 2: Perlu/Sedang Review */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-xs flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Perlu/Sedang Review
                </span>
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                  <Clock className="w-4.5 h-4.5" />
                </div>
              </div>
              <div>
                <span className="text-2xl font-black tracking-tight text-foreground block">
                  {stats?.review || 0}
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold mt-1 block">
                  Menunggu Review
                </span>
              </div>
            </div>

            {/* Card 3: Project Disetujui PPIC */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-xs flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Disetujui PPIC
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="w-4.5 h-4.5" />
                </div>
              </div>
              <div>
                <span className="text-2xl font-black tracking-tight text-foreground block">
                  {stats?.approvedPpic || 0}
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold mt-1 block">
                  Telah Disetujui
                </span>
              </div>
            </div>

            {/* Card 4: Menunggu SPB Disetujui */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-xs flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Menunggu SPB
                </span>
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600">
                  <Package className="w-4.5 h-4.5" />
                </div>
              </div>
              <div>
                <span className="text-2xl font-black tracking-tight text-foreground block">
                  {stats?.waitingInventory || 0}
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold mt-1 block">
                  Proses Inventori
                </span>
              </div>
            </div>

            {/* Card 5: Siap Produksi */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-xs flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Siap Produksi
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="w-4.5 h-4.5" />
                </div>
              </div>
              <div>
                <span className="text-2xl font-black tracking-tight text-foreground block">
                  {stats?.readyForProduction || 0}
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold mt-1 block">
                  Material Siap
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Approval Pipeline</h3>
            </div>
            <PpicTable
              projects={JSON.parse(JSON.stringify(projects))}
              meta={meta}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
