"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatJakartaDate } from "@/lib/date-utils";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  Loader2,
  History,
  FileText,
  Filter,
  Eye,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProjectHistoryDialog } from "@/components/project-history-dialog";
import { ProjectDetailDialog } from "@/components/project-detail-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateRangePicker } from "@/components/leads/date-range-picker";
import { DateRange } from "react-day-picker";

export function ProjectMasterTracker({
  projects,
  meta,
}: {
  projects: any[];
  meta: { totalCount: number; totalPages: number; currentPage: number };
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [historyProject, setHistoryProject] = useState<any | null>(null);
  const [detailProject, setDetailProject] = useState<any | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const currentPage = meta.currentPage;
  const totalPages = meta.totalPages;

  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") || "",
  );

  const currentTab = searchParams.get("tab") || "active";
  const currentDivision = searchParams.get("division") || "ALL";
  const currentStart = searchParams.get("start") || "";
  const currentEnd = searchParams.get("end") || "";

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: currentStart ? new Date(currentStart) : undefined,
    to: currentEnd ? new Date(currentEnd) : undefined,
  });

  const updateQuery = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    if (!updates.page) params.set("page", "1");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  const isSearching = isPending || searchInput !== (searchParams.get("search") || "");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (searchParams.get("search") || "")) {
        updateQuery({ search: searchInput || null });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED":
      case "DONE":
      case "APPROVED_BY_PPIC":
      case "APPROVED_PM":
        return "bg-green-500";
      case "IN_PROGRESS":
        return "bg-blue-500";
      case "REVIEW":
      case "PENDING_APPROVAL":
        return "bg-orange-500";
      case "REVISION":
      case "REJECTED":
        return "bg-purple-500";
      case "APPROVED_BY_CUSTOMER":
        return "bg-cyan-500";
      case "PENDING":
        return "bg-slate-300";
      default:
        return "bg-slate-400";
    }
  };

  const divisions = [
    { key: "eng", label: "ENG" },
    { key: "ppic", label: "PPIC" },
    { key: "pur", label: "PUR" },
    { key: "prod", label: "PROD" },
    { key: "qc", label: "QC" },
    { key: "log", label: "LOG" },
  ];

  const divisionOptions = [
    { value: "ALL", label: "All" },
    { value: "ENGINEERING", label: "Engineering" },
    { value: "PPIC", label: "PPIC" },
    { value: "PURCHASING", label: "Purchasing" },
    { value: "PRODUCTION", label: "Produksi" },
    { value: "QUALITY_CONTROL", label: "Quality Control" },
    { value: "LOGISTIC", label: "Logistik" },
  ];

  const handleExport = () => {
    const headers = [
      "No",
      "Project Number",
      "Project Name",
      "Customer Company",
      "Customer Contact",
      "Running Days",
      "Deadline",
      "Current Division",
      "Current Status",
    ];
    const rows = projects.map((p, idx) => [
      idx + 1,
      p.projectNumber || "",
      p.projectName || "",
      p.customer?.company || "Personal Customer",
      p.customer?.name || "",
      p.runningDays || 0,
      p.expectedDate ? format(new Date(p.expectedDate), "dd MMM yyyy") : "-",
      p.status || "IN_PROGRESS",
    ]);

    let excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
               <x:ExcelWorksheet>
                 <x:Name>Projects Report</x:Name>
                 <x:WorksheetOptions>
                   <x:DisplayGridlines/>
                 </x:WorksheetOptions>
               </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; }
          th { background-color: #f3f4f6; font-weight: bold; border: 1px solid #d1d5db; padding: 6px; }
          td { border: 1px solid #d1d5db; padding: 6px; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              ${headers.map((h) => `<th>${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
              <tr>
                ${row.map((val) => `<td>${val}</td>`).join("")}
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], {
      type: "application/vnd.ms-excel",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Projects_Report_${format(new Date(), "yyyy-MM-dd_HHmmss")}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportDialogOpen(false);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header: Title & Search */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Global Project Pipeline</h3>
            <p className="text-sm text-muted-foreground">
              Tracking progress across all 6 production divisions.
            </p>
          </div>
          <div className="relative w-full md:w-72">
            {isSearching ? (
              <Loader2 className="absolute left-2.5 top-2.5 h-4 w-4 text-primary animate-spin" />
            ) : (
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            )}
            <Input
              placeholder="Search project..."
              className="pl-9 h-10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 py-2 border-b border-border/10 pb-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl w-fit border border-border">
            <button
              onClick={() => updateQuery({ tab: "active" })}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                currentTab === "active"
                  ? "bg-background text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Active Projects
            </button>
            <button
              onClick={() => updateQuery({ tab: "archived" })}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                currentTab === "archived"
                  ? "bg-background text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Archived Projects
            </button>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Popover Filter */}
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-all border border-border shadow-xs bg-background font-semibold text-xs"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    Filter
                    {(currentDivision !== "ALL" ||
                      currentStart ||
                      currentEnd) && (
                      <Badge
                        variant="secondary"
                        className="ml-1 px-1 h-5 min-w-5 justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold"
                      >
                        !
                      </Badge>
                    )}
                  </Button>
                }
              />
              <PopoverContent className="w-80 p-4 space-y-4" align="end">
                {/* Division Filters */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Divisi
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {divisionOptions.map((div) => (
                      <Button
                        key={div.value}
                        variant={
                          currentDivision === div.value ? "default" : "outline"
                        }
                        size="sm"
                        className="h-8 text-[11px] px-2.5 cursor-pointer font-medium"
                        onClick={() => updateQuery({ division: div.value })}
                      >
                        {div.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Date Range Picker */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Rentang Tanggal
                  </label>
                  <DateRangePicker
                    date={dateRange}
                    setDate={(range) => {
                      setDateRange(range);
                      updateQuery({
                        start: range?.from ? range.from.toISOString() : null,
                        end: range?.to ? range.to.toISOString() : null,
                      });
                    }}
                  />
                </div>

                {/* Reset Filters */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs hover:bg-primary/90 bg-primary text-primary-foreground hover:text-primary-foreground h-8 cursor-pointer font-semibold"
                  onClick={() => {
                    setSearchInput("");
                    setDateRange(undefined);
                    updateQuery({
                      division: "ALL",
                      search: "",
                      start: null,
                      end: null,
                    });
                  }}
                >
                  Reset Filter
                </Button>
              </PopoverContent>
            </Popover>

            {/* Export XLS Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportDialogOpen(true)}
              className="h-9 rounded-lg px-3 text-xs font-semibold text-white hover:text-white cursor-pointer shadow-xs border-border bg-primary hover:bg-primary/80"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5 text-white" />
              Unduh Data
            </Button>
          </div>
        </div>

        {/* Top Pagination */}
        <div className="flex items-center justify-between py-1">
          <p className="text-xs text-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {projects.length}
            </span>{" "}
            projects
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={currentPage <= 1}
              onClick={() => updateQuery({ page: String(currentPage - 1) })}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={currentPage >= totalPages}
              onClick={() => updateQuery({ page: String(currentPage + 1) })}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm relative">
          {isPending && (
            <div className="absolute inset-0 z-10 bg-background/40 backdrop-blur-[1px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          )}
          <Table>
            <TableHeader className="bg-muted/20 border-b">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-12.5 text-center font-semibold">
                  No
                </TableHead>
                <TableHead className="min-w-50 font-semibold">
                  Project & Customer
                </TableHead>
                <TableHead className="text-center font-semibold">
                  Timestamps
                </TableHead>
                <TableHead className="font-semibold">Running</TableHead>
                <TableHead className="font-semibold">Deadline</TableHead>
                <TableHead className="text-center font-semibold px-2">
                  Divisions
                </TableHead>
                <TableHead className="text-right font-semibold">
                  Current
                </TableHead>
                <TableHead className="w-15 text-right font-semibold">
                  Detail
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center h-48 text-muted-foreground"
                  >
                    No projects found.
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((project, idx) => {
                  const deadline = project.expectedDate
                    ? new Date(project.expectedDate)
                    : null;
                  const today = new Date();
                  const diff = deadline
                    ? differenceInDays(deadline, today)
                    : null;

                  return (
                    <TableRow
                      key={project.id}
                      className="border-border/40 hover:bg-muted/20 transition-colors group"
                    >
                      <TableCell className="text-center text-muted-foreground text-xs">
                        {(currentPage - 1) * 10 + idx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {project.projectNumber && (
                            <span className="text-xs text-primary font-semibold">
                              {project.projectNumber}
                            </span>
                          )}
                          <span className="font-bold text-sm group-hover:text-primary transition-colors">
                            {project.projectName}
                          </span>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <span className="font-semibold text-foreground/70">
                              {project.customer?.company ||
                                project.customer?.name}
                            </span>
                            {project.customer?.company && (
                              <>
                                <span className="opacity-30">•</span>
                                <span>{project.customer?.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 gap-2 cursor-pointer hover:bg-muted border-border/50 text-muted-foreground hover:text-foreground"
                          onClick={() => setHistoryProject(project)}
                        >
                          <History className="w-3.5 h-3.5" />
                          <span className="text-xs font-semibold">
                            View Logs
                          </span>
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-primary">
                            {project.runningDays} Days
                          </span>
                          <span className="text-xs text-muted-foreground font-semibold">
                            Since {formatJakartaDate(project.createdAt, "date")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {diff !== null && (
                            <span
                              className={cn(
                                "text-sm font-bold",
                                diff < 0
                                  ? "text-red-600"
                                  : diff <= 7
                                    ? "text-orange-600"
                                    : "text-green-600",
                              )}
                            >
                              {diff < 0
                                ? `Delayed ${Math.abs(diff)}d`
                                : `${diff} Days Left`}
                            </span>
                          )}
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {deadline ? formatJakartaDate(deadline, "date") : "-"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-2">
                        <div className="flex items-center justify-center gap-3">
                          {divisions.map((div) => {
                            const status =
                              (project[
                                `${div.key}Status` as keyof typeof project
                              ] as string) || "PENDING";
                            return (
                              <Tooltip key={div.key}>
                                <TooltipTrigger
                                  render={
                                    <div className="flex flex-col items-center gap-1.5">
                                      <div
                                        className={cn(
                                          "w-3 h-3 rounded-full shadow-sm ring-2 ring-background ring-offset-1 transition-all hover:scale-125 cursor-help",
                                          getStatusColor(status),
                                        )}
                                      />
                                      <span className="text-[9px] font-bold text-muted-foreground/60 uppercase">
                                        {div.label}
                                      </span>
                                    </div>
                                  }
                                />
                                <TooltipContent>
                                  <p className="text-xs font-bold">
                                    {div.label}: {status.replace(/_/g, " ")}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <Badge
                          variant="secondary"
                          className="font-semibold text-xs"
                        >
                          {(project.status || "IN_PROGRESS").replace(
                            /_/g,
                            " ",
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 cursor-pointer text-white bg-primary hover:bg-primary hover:text-white transition-all active:scale-95"
                          onClick={() => setDetailProject(project)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Confirmation Dialog for Export XLS */}
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogContent className="sm:max-w-106.25">
            <DialogHeader>
              <DialogTitle>Konfirmasi Unduh</DialogTitle>
              <DialogDescription>
                Apakah Anda yakin ingin mengunduh data-data proyek saat ini ke
                dalam format Excel (.xls)?
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={() => setExportDialogOpen(false)}
              >
                Batal
              </Button>
              <Button className="cursor-pointer" onClick={handleExport}>
                Ekspor
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Project History Dialog */}
        <ProjectHistoryDialog
          project={historyProject}
          open={!!historyProject}
          onOpenChange={(open) => !open && setHistoryProject(null)}
        />

        {/* Project Detail Dialog (hiding Project Value) */}
        <ProjectDetailDialog
          data={detailProject}
          open={!!detailProject}
          onOpenChange={(open) => !open && setDetailProject(null)}
          type="PROJECT"
          showValue={false}
        />
      </div>
    </TooltipProvider>
  );
}
