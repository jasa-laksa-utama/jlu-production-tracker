import { getProjects } from "@/app/actions/projects";
import { PpicTable } from "@/components/trackers/ppic-table";
import { DashboardHeader } from "@/components/dashboard-header";
import { Metadata } from "next";
import { AppSidebar } from "@/components/app-sidebar";

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

  const projectsResult = await getProjects({
    page,
    pageSize: limit,
    search,
    status,
    sortOrder: sort as any,
    division: "PPIC",
  });

  if (!projectsResult.success) {
    console.error("PPIC Page getProjects failed:", projectsResult.error);
  }

  const projects = projectsResult.success ? (projectsResult.data as any[]) : [];
  const meta =
    projectsResult.success && projectsResult.meta
      ? projectsResult.meta
      : { totalPages: 1, totalCount: 0, currentPage: 1 };

  return (
    <div className="flex w-full overflow-hidden bg-background h-screen">
      <AppSidebar />
      <div className="flex flex-col flex-1 w-full bg-background md:rounded-tl-xl md:border-l md:border-t border-border overflow-hidden md:m-2 md:ml-0 shadow-sm relative">
        <DashboardHeader />

        <main className="flex-1 w-full px-4 sm:px-6 py-6 pb-8 overflow-y-auto overflow-x-hidden space-y-6 max-w-full 2xl:max-w-[1920px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight">PPIC</h2>
            <p className="text-muted-foreground">
              Production Planning and Inventory Control
            </p>
          </div>

          <div className="space-y-4 pt-2">
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
