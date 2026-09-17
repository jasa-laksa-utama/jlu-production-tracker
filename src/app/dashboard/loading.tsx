import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="flex w-full overflow-hidden bg-background h-screen">
      {/* Sidebar Placeholder */}
      <div className="hidden md:block w-65 border-r border-border bg-sidebar h-full shrink-0" />

      <div className="flex flex-col flex-1 w-full bg-background md:rounded-tl-xl md:border-l md:border-t border-border overflow-hidden md:m-2 md:ml-0 shadow-xs relative">
        {/* Header Skeleton */}
        <div className="h-14 border-b border-border/80 flex items-center justify-between px-6 bg-background sticky top-0 z-30">
          <Skeleton className="h-5 w-40" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </div>

        <main className="flex-1 w-full px-4 sm:px-6 py-6 pb-6 overflow-y-auto overflow-x-hidden space-y-6 max-w-full 2xl:max-w-[1920px] mx-auto">
          {/* 4 Metric Cards Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card
                key={i}
                className="border border-border/80 bg-card shadow-xs"
              >
                <CardContent className="p-5 flex flex-col justify-between h-full space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-7 w-16" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Table Header Controls Skeleton */}
          <div className="space-y-4 pt-1">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3.5 w-72" />
              </div>
              <Skeleton className="h-9 w-full sm:w-80 rounded-md" />
            </div>

            <div className="flex items-center justify-between gap-3 pt-1 pb-3 border-b border-border/60">
              <Skeleton className="h-8 w-56 rounded-lg" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-28 rounded-md" />
              </div>
            </div>

            <div className="border border-border/80 rounded-lg overflow-hidden bg-card">
              <div className="bg-muted/40 h-10 border-b border-border/70" />
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="p-4 border-b border-border/40 flex items-center justify-between gap-4"
                >
                  <Skeleton className="h-4 w-6" />
                  <div className="space-y-1.5 flex-1 max-w-xs">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-7 w-20 rounded-md" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-7 w-7 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
