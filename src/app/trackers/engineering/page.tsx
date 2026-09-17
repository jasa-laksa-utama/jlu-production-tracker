import { getProjects } from "@/app/actions/projects";
import { getPendingSPBSubstitutions } from "@/app/actions/spb";
import { EngineeringTable } from "@/components/trackers/engineering-table";
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

  const projectsResult = await getProjects({
    page,
    pageSize: limit,
    search,
    status,
    startDate: start,
    endDate: end,
    sortOrder: sort as any,
    division: "ENGINEERING",
  });

  const projects = projectsResult.success ? (projectsResult.data as any[]) : [];
  const meta = projectsResult.success
    ? projectsResult.meta
    : { totalPages: 1, totalCount: 0, currentPage: 1 };

  return (
    <div className="flex w-full overflow-hidden bg-background h-screen">
      <AppSidebar />
      <div className="flex flex-col flex-1 w-full bg-background md:rounded-tl-xl md:border-l md:border-t border-border overflow-hidden md:m-2 md:ml-0 shadow-sm relative">
        <DashboardHeader />

        <main className="flex-1 w-full px-4 sm:px-6 py-6 pb-2 overflow-y-auto overflow-x-hidden space-y-6 max-w-full 2xl:max-w-[1920px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          {/* Simple Header */}
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Engineering</h2>
            <p className="text-muted-foreground">
              Technical design, BoQ, Drawing, and Mechanical Part List
              management.
            </p>
          </div>

          {/* Table Section */}
          <div className="space-y-4 pt-2">
            <EngineeringTable
              projects={JSON.parse(JSON.stringify(projects))}
              meta={meta}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
