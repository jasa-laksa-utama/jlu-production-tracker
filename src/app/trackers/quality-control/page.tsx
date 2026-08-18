import { getProjects, getDivisionStats } from "@/app/actions/projects";
import { getPOReceiptsForQC } from "@/app/actions/qc-receipt";
import { QCTable } from "@/components/trackers/qc-table";
import { DashboardHeader } from "@/components/dashboard-header";
import { Metadata } from "next";
import { AppSidebar } from "@/components/app-sidebar";

export const metadata: Metadata = {
  title: "Quality Control Tracker | PT. JLU Production",
  description: "Track and approve/reject production stages and PO goods receipt QC.",
};

export default async function QualityControlTrackerPage({
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

  const [projectsResult, statsResult, poReceiptsResult] = await Promise.all([
    getProjects({
      page,
      pageSize: limit,
      search,
      status,
      sortOrder: sort as any,
      division: "QUALITY_CONTROL",
    }),
    getDivisionStats("QUALITY_CONTROL"),
    getPOReceiptsForQC("ALL"),
  ]);

  const projects = projectsResult.success ? (projectsResult.data as any[]) : [];
  const poReceipts = poReceiptsResult.success ? (poReceiptsResult.data as any[]) : [];
  const meta = projectsResult.success
    ? projectsResult.meta
    : { totalPages: 1, totalCount: 0, currentPage: 1 };

  const stats =
    statsResult.success && statsResult.data
      ? (statsResult.data as any)
      : {
          totalActive: 0,
          inProgress: 0,
          review: 0,
          approved: 0,
        };

  return (
    <div className="flex w-full overflow-hidden bg-background h-screen">
      <AppSidebar />
      <div className="flex flex-col flex-1 w-full bg-background md:rounded-tl-xl md:border-l md:border-t border-border overflow-hidden md:m-2 md:ml-0 shadow-sm relative">
        <DashboardHeader />

        <main className="flex-1 w-full p-6 pb-2 overflow-y-auto overflow-x-hidden space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight">
              Divisi Quality Control
            </h2>
            <p className="text-muted-foreground">
              Update Progress Pengujian Hasil Produksi
            </p>
          </div>

          <QCTable
            projects={JSON.parse(JSON.stringify(projects))}
            poReceipts={JSON.parse(JSON.stringify(poReceipts))}
            meta={meta}
            stats={stats}
          />
        </main>
      </div>
    </div>
  );
}
