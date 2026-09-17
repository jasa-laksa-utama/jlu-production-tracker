import { Skeleton } from "@/components/ui/skeleton";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";

export default function Loading() {
  return (
    <div className="flex w-full overflow-hidden bg-background h-screen">
      <AppSidebar />
      <div className="flex flex-col flex-1 w-full bg-background md:rounded-tl-xl md:border-l md:border-t border-border overflow-hidden md:m-2 md:ml-0 shadow-xs relative">
        <DashboardHeader />
        <main className="flex-1 w-full px-4 sm:px-6 py-6 pb-6 overflow-y-auto space-y-6 max-w-full 2xl:max-w-[1920px] mx-auto">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between border-b pb-5">
            <div className="space-y-2">
              <Skeleton className="h-7 w-64 rounded-xl" />
              <Skeleton className="h-4 w-96 rounded-lg" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-32 rounded-xl" />
              <Skeleton className="h-9 w-32 rounded-xl" />
            </div>
          </div>

          {/* 4 Cards Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-4 rounded-2xl border border-border/80 bg-card space-y-2"
              >
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3 w-36" />
              </div>
            ))}
          </div>

          {/* Table Skeleton */}
          <div className="p-4 rounded-2xl border border-border/80 bg-card space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-9 w-48 rounded-xl" />
              <Skeleton className="h-9 w-64 rounded-xl" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
