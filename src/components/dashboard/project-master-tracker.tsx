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
  Calendar,
  Loader2,
  History,
  FileSpreadsheet,
  Filter,
  Eye,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  X,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ProjectHistoryDialog } from "@/components/project-history-dialog";
import { ProjectDetailDialog } from "@/components/project-detail-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/leads/date-range-picker";
import { DateRange } from "react-day-picker";

/**
 * Helper to calculate global masterplan completion percentage
 */
function getProjectProgress(project: any): number {
  if (
    project.overallProgress !== undefined &&
    typeof project.overallProgress === "number"
  ) {
    return project.overallProgress;
  }
  if (project.status === "CLOSED" || project.status === "COMPLETED") {
    return 100;
  }
  const phases = project.masterplan?.phases || [];
  if (phases.length === 0) return 0;
  const totalWeight = phases.reduce(
    (sum: number, p: any) => sum + Number(p.weightPercent || 0),
    0,
  );
  if (totalWeight > 0) {
    const rawProgress = phases.reduce((sum: number, p: any) => {
      const act = Number(p.actualProgress || 0);
      const w = Number(p.weightPercent || 0);
      return sum + (act * w) / 100;
    }, 0);
    const calculated =
      totalWeight === 100 ? rawProgress : (rawProgress / totalWeight) * 100;
    return Math.min(100, Math.max(0, Math.round(calculated * 10) / 10));
  }
  const sumAct = phases.reduce(
    (sum: number, p: any) => sum + Number(p.actualProgress || 0),
    0,
  );
  return Math.min(
    100,
    Math.max(0, Math.round((sumAct / phases.length) * 10) / 10),
  );
}

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

  const currentSearch = searchParams.get("search") || "";
  const currentSortBy = searchParams.get("sortBy") || "deadline";
  const currentSortOrder =
    (searchParams.get("sortOrder") as "asc" | "desc") || "asc";
  const currentTab = searchParams.get("tab") || "active";
  const currentStart = searchParams.get("start") || "";
  const currentEnd = searchParams.get("end") || "";

  const [searchInput, setSearchInput] = useState(currentSearch);
  const [sortBy, setSortBy] = useState(currentSortBy);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(currentSortOrder);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: currentStart ? new Date(currentStart) : undefined,
    to: currentEnd ? new Date(currentEnd) : undefined,
  });

  // Sync state if searchParams change externally (e.g. navigation or reset)
  useEffect(() => {
    setSearchInput(searchParams.get("search") || "");
    setSortBy(searchParams.get("sortBy") || "deadline");
    setSortOrder((searchParams.get("sortOrder") as "asc" | "desc") || "asc");
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    setDateRange({
      from: start ? new Date(start) : undefined,
      to: end ? new Date(end) : undefined,
    });
  }, [searchParams]);

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

  const isSearching =
    isPending || searchInput !== (searchParams.get("search") || "");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (searchParams.get("search") || "")) {
        updateQuery({ search: searchInput || null });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleToggleDeadlineSort = () => {
    if (sortBy !== "deadline") {
      setSortBy("deadline");
      setSortOrder("asc");
      updateQuery({ sortBy: "deadline", sortOrder: "asc" });
    } else {
      const nextOrder = sortOrder === "asc" ? "desc" : "asc";
      setSortOrder(nextOrder);
      updateQuery({ sortBy: "deadline", sortOrder: nextOrder });
    }
  };

  const isFilterActive = !!(
    currentStart ||
    currentEnd ||
    (currentSortBy && currentSortBy !== "deadline") ||
    (currentSortOrder && currentSortOrder !== "asc")
  );

  const handleExport = () => {
    const headers = [
      "No",
      "Nomor Proyek",
      "Nama Proyek",
      "Perusahaan",
      "Kontak Customer",
      "Durasi Berjalan (Hari)",
      "Batas Waktu (Deadline)",
      "Kemajuan Masterplan (%)",
    ];

    const rows = projects.map((p, idx) => {
      const progress = getProjectProgress(p);
      return [
        idx + 1,
        p.projectNumber || "-",
        p.projectName || "-",
        p.customer?.company || "Personal Customer",
        p.customer?.name || "-",
        p.runningDays || 0,
        p.expectedDate ? format(new Date(p.expectedDate), "dd MMM yyyy") : "-",
        `${progress}%`,
      ];
    });

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
               <x:ExcelWorksheet>
                 <x:Name>Laporan Proyek JLU</x:Name>
                 <x:WorksheetOptions>
                   <x:DisplayGridlines/>
                 </x:WorksheetOptions>
               </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
          th { background-color: #f1f5f9; font-weight: bold; border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          td { border: 1px solid #cbd5e1; padding: 8px; font-size: 13px; }
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
    a.download = `Laporan_Proyek_${format(new Date(), "yyyy-MM-dd_HHmmss")}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Header: Title & Search Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="text-lg font-semibold text-foreground">
            Global Project Pipeline
          </h2>
          <p className="text-xs text-muted-foreground">
            Pemantauan kemajuan dinamis seluruh proses manufaktur berdasarkan
            masterplan.
          </p>
        </div>

        {/* Search Bar (Langsung mencari nama/nomor proyek, nama klien, dan perusahaan) */}
        <div className="relative w-full md:w-84">
          {isSearching ? (
            <Loader2 className="absolute left-3 top-2.5 h-4 w-4 text-primary animate-spin" />
          ) : (
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          )}
          <Input
            placeholder="Cari proyek, nama klien, perusahaan..."
            className="pl-9 pr-8 h-9 text-xs bg-card border-border/80 shadow-2xs focus-visible:ring-1 focus-visible:ring-primary/30"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                updateQuery({ search: null });
              }}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground p-0.5 rounded-sm transition-colors cursor-pointer"
              title="Hapus pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Action Controls Bar: Tabs & Filter & Export */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 pb-3 border-b border-border/60">
        {/* Tabs: Active vs Archived */}
        <div className="inline-flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/60 w-fit">
          <button
            type="button"
            onClick={() => updateQuery({ tab: "active" })}
            className={cn(
              "px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
              currentTab === "active"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Active Projects
          </button>
          <button
            type="button"
            onClick={() => updateQuery({ tab: "archived" })}
            className={cn(
              "px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
              currentTab === "archived"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Archived Projects
          </button>
        </div>

        {/* Right Actions: Filter Popover & Unduh Data */}
        <div className="flex items-center gap-2.5">
          {/* Popover Filter (Urutan Data & Rentang Tanggal) */}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 text-xs font-medium border-border/80 bg-background"
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filter
                  {isFilterActive && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground leading-none">
                      Aktif
                    </span>
                  )}
                </Button>
              }
            />
            <PopoverContent className="w-80 p-4 space-y-3.5" align="end">
              {/* 1. Pengurutan Data (Sorting) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Urutan Data
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    Default: Tenggat Terdekat
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Berdasarkan:
                    </span>
                    <Select
                      value={sortBy}
                      onValueChange={(val) => {
                        if (!val) return;
                        setSortBy(val);
                        updateQuery({
                          sortBy: val === "deadline" ? null : val,
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        alignItemWithTrigger={false}
                        className="w-44 text-xs"
                      >
                        <SelectItem value="deadline">Tenggat Waktu</SelectItem>
                        <SelectItem value="createdAt">
                          Tanggal Dibuat
                        </SelectItem>
                        <SelectItem value="projectName">Nama Proyek</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Arah Urutan:
                    </span>
                    <Select
                      value={sortOrder}
                      onValueChange={(val) => {
                        if (!val) return;
                        const nextOrder = val as "asc" | "desc";
                        setSortOrder(nextOrder);
                        updateQuery({
                          sortOrder:
                            nextOrder === "asc" && sortBy === "deadline"
                              ? null
                              : nextOrder,
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        alignItemWithTrigger={false}
                        className="w-48 text-xs"
                      >
                        <SelectItem value="asc">
                          {sortBy === "deadline"
                            ? "Ascending (Terdekat)"
                            : sortBy === "projectName"
                              ? "Ascending (A ke Z)"
                              : "Ascending (Terlama)"}
                        </SelectItem>
                        <SelectItem value="desc">
                          {sortBy === "deadline"
                            ? "Descending (Terjauh)"
                            : sortBy === "projectName"
                              ? "Descending (Z ke A)"
                              : "Descending (Terbaru)"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 2. Rentang Tanggal Dibuat */}
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <label className="text-xs font-semibold text-foreground">
                  Rentang Tanggal Proyek
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
                variant="outline"
                size="sm"
                className="w-full text-xs h-8 font-medium"
                onClick={() => {
                  setSearchInput("");
                  setSortBy("deadline");
                  setSortOrder("asc");
                  setDateRange(undefined);
                  updateQuery({
                    search: null,
                    sortBy: null,
                    sortOrder: null,
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
            variant="default"
            size="sm"
            onClick={() => setExportDialogOpen(true)}
            className="h-9 text-xs font-medium gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Unduh Data
          </Button>
        </div>
      </div>

      {/* Pagination & Count Header */}
      <div className="flex items-center justify-between text-xs text-muted-foreground py-0.5">
        <p>
          Menampilkan{" "}
          <span className="font-semibold text-foreground">
            {projects.length}
          </span>{" "}
          dari{" "}
          <span className="font-semibold text-foreground">
            {meta.totalCount}
          </span>{" "}
          proyek
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={currentPage <= 1 || isPending}
            onClick={() => updateQuery({ page: String(currentPage - 1) })}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-medium text-foreground">
            Halaman {currentPage} dari {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={currentPage >= totalPages || isPending}
            onClick={() => updateQuery({ page: String(currentPage + 1) })}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Table without obsolete Status column */}
      <div className="border border-border/80 rounded-lg bg-card overflow-hidden shadow-xs relative">
        {isPending && (
          <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-[1px] flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}

        <Table>
          <TableHeader className="bg-muted/40 border-b border-border/70">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 text-center text-xs font-semibold text-muted-foreground">
                No
              </TableHead>
              <TableHead className="min-w-60 text-xs font-semibold text-muted-foreground">
                Proyek & Pelanggan
              </TableHead>
              <TableHead className="w-28 text-center text-xs font-semibold text-muted-foreground">
                Riwayat
              </TableHead>
              <TableHead className="w-32 text-xs font-semibold text-muted-foreground">
                Waktu Berjalan
              </TableHead>
              <TableHead
                className="w-36 text-xs font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors group"
                onClick={handleToggleDeadlineSort}
                title="Klik untuk mengubah urutan tenggat waktu"
              >
                <div className="flex items-center gap-1.5">
                  <span>Tenggat Waktu</span>
                  {sortBy === "deadline" ? (
                    sortOrder === "asc" ? (
                      <ArrowUp className="w-3.5 h-3.5 text-primary shrink-0" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-primary shrink-0" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
                  )}
                </div>
              </TableHead>
              <TableHead className="min-w-48 text-xs font-semibold text-muted-foreground">
                Kemajuan Masterplan
              </TableHead>
              <TableHead className="w-14 text-center text-xs font-semibold text-muted-foreground">
                Detail
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center h-40 text-muted-foreground text-sm font-medium"
                >
                  Tidak ada data proyek yang ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project, idx) => {
                const deadline = project.expectedDate
                  ? new Date(project.expectedDate)
                  : null;
                const diff = deadline
                  ? differenceInDays(deadline, new Date())
                  : null;
                const progress = getProjectProgress(project);

                return (
                  <TableRow
                    key={project.id}
                    className="border-b border-border/50 hover:bg-muted/25 transition-colors"
                  >
                    {/* No */}
                    <TableCell className="text-center text-muted-foreground text-xs font-medium">
                      {(currentPage - 1) * 10 + idx + 1}
                    </TableCell>

                    {/* Proyek & Pelanggan */}
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        {project.projectNumber && (
                          <span className="text-xs font-semibold text-primary">
                            {project.projectNumber}
                          </span>
                        )}
                        <span className="font-semibold text-sm text-foreground">
                          {project.projectName}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>
                            {project.customer?.company ||
                              project.customer?.name ||
                              "Pelanggan"}
                          </span>
                          {project.customer?.company &&
                            project.customer?.name && (
                              <>
                                <span className="text-muted-foreground/40">
                                  •
                                </span>
                                <span>{project.customer.name}</span>
                              </>
                            )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Riwayat Logs */}
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs gap-1.5 font-medium border-border/70"
                        onClick={() => setHistoryProject(project)}
                      >
                        <History className="w-3.5 h-3.5 text-muted-foreground" />
                        Log Status
                      </Button>
                    </TableCell>

                    {/* Waktu Berjalan */}
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-foreground">
                          {project.runningDays || 0} Hari
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Mulai {formatJakartaDate(project.createdAt, "date")}
                        </span>
                      </div>
                    </TableCell>

                    {/* Tenggat Waktu */}
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        {diff !== null && (
                          <span
                            className={cn(
                              "text-xs font-semibold",
                              diff < 0
                                ? "text-rose-600 dark:text-rose-400"
                                : diff <= 7
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-emerald-600 dark:text-emerald-400",
                            )}
                          >
                            {diff < 0
                              ? `Terlambat ${Math.abs(diff)} hari`
                              : `${diff} hari lagi`}
                          </span>
                        )}
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Calendar className="w-3 h-3 text-muted-foreground/70" />
                          <span>
                            {deadline
                              ? formatJakartaDate(deadline, "date")
                              : "-"}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Kemajuan Masterplan (%) */}
                    <TableCell>
                      <div className="flex flex-col gap-1.5 min-w-40">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-foreground">
                            {progress}%
                          </span>
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {progress >= 100
                              ? "Selesai"
                              : progress > 0
                                ? "Sedang Berjalan"
                                : "Belum Dimulai"}
                          </span>
                        </div>
                        <div className="w-full bg-muted h-2 rounded-full overflow-hidden border border-border/40">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              progress >= 100
                                ? "bg-emerald-500"
                                : progress >= 50
                                  ? "bg-primary"
                                  : "bg-blue-500",
                            )}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>

                    {/* Detail */}
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={() => setDetailProject(project)}
                        title="Lihat Detail Proyek"
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Unduh Data</DialogTitle>
            <DialogDescription>
              Unduh data pipeline proyek saat ini ke dalam format lembar kerja
              Excel (.xls).
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2.5 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportDialogOpen(false)}
            >
              Batal
            </Button>
            <Button size="sm" onClick={handleExport}>
              Unduh Sekarang
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

      {/* Project Detail Dialog */}
      <ProjectDetailDialog
        data={detailProject}
        open={!!detailProject}
        onOpenChange={(open) => !open && setDetailProject(null)}
        type="PROJECT"
        showValue={false}
      />
    </div>
  );
}
