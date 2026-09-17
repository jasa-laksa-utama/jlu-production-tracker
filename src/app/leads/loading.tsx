import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="flex w-full overflow-hidden bg-background h-screen">
      {/* Sidebar Placeholder */}
      <div className="hidden md:block w-[260px] border-r border-border bg-sidebar h-full" />

      <div className="flex flex-col flex-1 w-full bg-background md:rounded-tl-xl md:border-l md:border-t border-border overflow-hidden md:m-2 md:ml-0 shadow-sm relative">
        {/* Header Skeleton */}
        <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-30">
          <Skeleton className="h-6 w-32" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>
        </div>

        <main className="flex-1 w-full px-4 sm:px-6 py-6 pb-2 space-y-6 max-w-full 2xl:max-w-[1920px] mx-auto overflow-y-auto">
          {/* Tabs Skeleton */}
          <div className="flex gap-1 bg-muted/30 p-1 rounded-lg w-fit border border-border">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>

          <div className="space-y-4">
            {/* Toolbar Skeleton */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 md:max-w-md">
                <Skeleton className="h-9 flex-1 rounded-md" />
                <Skeleton className="h-9 w-24 rounded-md" />
                <Skeleton className="h-5 w-24 ml-2" />
              </div>
              <Skeleton className="h-9 w-32 rounded-md" />
            </div>

            {/* Pagination Controls Skeleton */}
            <div className="flex items-center justify-between py-1">
              <Skeleton className="h-8 w-16" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>

            {/* Table Skeleton */}
            <div className="border border-border rounded-xl overflow-hidden bg-card">
              <div className="bg-muted/30 h-10 border-b border-border" />
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="p-4 border-b border-border/50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4 max-w-[200px]" />
                      <Skeleton className="h-3 w-1/2 max-w-[150px]" />
                    </div>
                  </div>
                  <div className="hidden md:flex flex-col gap-2 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-5 w-24 mx-4" />
                  <Skeleton className="h-7 w-20 rounded-full" />
                  <Skeleton className="h-8 w-8 ml-4 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
