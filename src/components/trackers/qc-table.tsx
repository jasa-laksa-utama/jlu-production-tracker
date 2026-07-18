"use client";

import React, { useTransition, useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Play,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FolderOpen,
  FileText,
  History,
  MoreHorizontal,
  Settings,
  Users,
  User,
  Hammer,
  Wrench,
  Paintbrush,
  Layers,
  ArrowRight,
  Loader2,
  ClipboardList,
  Clock,
  Filter,
  ArrowUpDown,
  Check,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { format, differenceInDays } from "date-fns";
import { ProjectDetailDialog } from "@/components/project-detail-dialog";
import { ProjectHistoryDialog } from "@/components/project-history-dialog";
import { DocumentManagerDialog } from "@/components/document-manager-dialog";
import {
  updateStageQCStatus,
  handoverProjectStagesToLogistics,
  updateComponentStageQC,
  handoverComponentsToLogistics,
} from "@/app/actions/production";
import { requestDrawingRevision } from "@/app/actions/projects";

export const STAGE_STEPS: Record<string, string[]> = {
  Fabrikasi: ["Cutting", "Assembly", "Welding"],
  Machining: ["Lathe (Bubut)", "Milling (Frais)"],
  Mechanical: ["Assembly", "Alignment"],
  Finishing: ["Sandblasting", "Painting"],
};

export function getComponentStageStepLabel(
  stageName: string,
  progress: number,
  status?: string,
) {
  const steps = STAGE_STEPS[stageName];
  if (!steps) return `${progress}%`;

  if (status === "DONE" || progress >= 100) return "Done";
  if (status === "READY" || progress <= 0) return "Belum Mulai";

  const M = steps.length;
  let bestIndex = 0;
  let minDiff = 101;
  for (let i = 0; i <= M + 1; i++) {
    const targetProgress = Math.round((i / (M + 1)) * 100);
    const diff = Math.abs(targetProgress - progress);
    if (diff < minDiff) {
      minDiff = diff;
      bestIndex = i;
    }
  }

  if (bestIndex === 0) return "Belum Mulai";
  if (bestIndex === M + 1) return "Done";
  return steps[bestIndex - 1];
}

const getStatusStyles = (status: string) => {
  switch (status) {
    case "DONE":
      return "bg-emerald-500/5 border-emerald-300/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10";
    case "IN_PROGRESS":
      return "bg-blue-500/5 border-blue-300/40 text-blue-800 dark:text-blue-300 hover:bg-blue-500/10";
    case "PAUSED":
      return "bg-amber-500/5 border-amber-300/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10";
    case "REVISION":
    case "REVISI":
      return "bg-red-500/5 border-red-300/40 text-red-800 dark:text-red-300 hover:bg-red-500/10 hover:border-red-400/50";
    default:
      return "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50";
  }
};

const getProgressBarColor = (status: string) => {
  switch (status) {
    case "DONE":
      return "bg-emerald-500";
    case "IN_PROGRESS":
      return "bg-blue-500";
    case "PAUSED":
      return "bg-amber-500";
    case "REVISION":
    case "REVISI":
      return "bg-red-500 animate-pulse";
    default:
      return "bg-muted-foreground/30";
  }
};

const getProjectStatusColor = (status: string) => {
  const s = status ? status.toUpperCase() : "";
  switch (s) {
    case "PENDING":
    case "WAITING_INVENTORY":
      return "bg-amber-500/10 text-amber-600 border-amber-200";
    case "IN_PROGRESS":
    case "ON_PROGRESS":
      return "bg-blue-500/10 text-blue-600 border-blue-200";
    case "READY":
    case "INVENTORY_READY":
    case "APPROVED":
    case "APPROVED_BY_PPIC":
    case "APPROVED_BY_CUSTOMER":
    case "DONE":
    case "COMPLETED":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
    case "REVISION":
    case "REVISION_TO_ENG":
    case "REJECTED":
      return "bg-red-500/10 text-red-600 border-red-200";
    default:
      return "bg-slate-500/10 text-slate-600 border-slate-200";
  }
};

const getProjectStatusLabel = (status: string) => {
  const s = status ? status.toUpperCase() : "";
  switch (s) {
    case "PENDING":
      return "Pending";
    case "WAITING_INVENTORY":
      return "Waiting Inventory";
    case "IN_PROGRESS":
    case "ON_PROGRESS":
      return "In Progress";
    case "READY":
      return "Ready";
    case "INVENTORY_READY":
      return "Inventory Ready";
    case "APPROVED":
      return "Approved";
    case "APPROVED_BY_PPIC":
      return "Approved by PPIC";
    case "APPROVED_BY_CUSTOMER":
      return "Approved by Customer";
    case "DONE":
    case "COMPLETED":
      return "Completed";
    case "REVISION":
      return "Revision";
    case "REVISION_TO_ENG":
      return "Revision to Eng";
    case "REJECTED":
      return "Rejected";
    default:
      return status ? status.replace(/_/g, " ") : "-";
  }
};

const formatDivision = (division?: string) => {
  if (!division) return "-";
  switch (division.toUpperCase()) {
    case "ENGINEERING":
      return "Engineering";
    case "PPIC":
      return "PPIC";
    case "INVENTORY":
      return "Inventory";
    case "PRODUCTION":
      return "Produksi";
    case "QUALITY_CONTROL":
      return "Quality Control";
    case "LOGISTIC":
      return "Logistik";
    default:
      return division.replace(/_/g, " ");
  }
};

export function QCTable({
  projects,
  meta,
  stats,
}: {
  projects: any[];
  meta?: { totalPages: number; totalCount: number; currentPage: number };
  stats: {
    totalActive: number;
    inProgress: number;
    review: number;
    approved: number;
  };
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Search parameters from URL
  const currentPage = Number(searchParams.get("page")) || 1;
  const currentLimit = Number(searchParams.get("limit")) || 10;
  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "ALL";
  const currentSort = searchParams.get("sort") || "desc";

  const [searchInput, setSearchInput] = useState(currentSearch);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // QC Update Modal state
  const [qcModalData, setQcModalData] = useState<{
    project: any;
    stage: any;
  } | null>(null);
  const [qcStatus, setQcStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">(
    "PENDING",
  );
  const [qcNotes, setQcNotes] = useState("");
  const [modalSubSteps, setModalSubSteps] = useState<any[]>([]);

  // Handover logistics state
  const [confirmHandoverProject, setConfirmHandoverProject] = useState<
    any | null
  >(null);
  const [handoverNotes, setHandoverNotes] = useState("");
  const [selectedHandoverStages, setSelectedHandoverStages] = useState<
    string[]
  >([]);
  const [confirmHandoverComponents, setConfirmHandoverComponents] = useState<{
    project: any;
    comps: any[];
  } | null>(null);
  const [selectedHandoverComponents, setSelectedHandoverComponents] = useState<
    string[]
  >([]);

  // Sidebar detail dialogs
  const [viewDetailProject, setViewDetailProject] = useState<any | null>(null);
  const [historyProject, setHistoryProject] = useState<any | null>(null);

  // Revision request states
  const [revisionProject, setRevisionProject] = useState<any | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [isPendingRevision, startRevisionTransition] = useTransition();

  // Component QC states
  const [editComponentQCData, setEditComponentQCData] = useState<{
    comp: any;
    stage: any;
  } | null>(null);
  const [compQCStatus, setCompQCStatus] = useState<
    "PENDING" | "APPROVED" | "REJECTED"
  >("PENDING");
  const [compQCNotes, setCompQCNotes] = useState("");
  const [isComponentQCPending, startComponentQCTransition] = useTransition();

  const totalPages = meta?.totalPages || 1;
  const pageSize = currentLimit;

  // Query update helper
  function updateQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    if (!updates.page) params.set("page", "1");
    router.replace(`${pathname}?${params.toString()}`);
  }

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== currentSearch) {
        updateQuery({ search: searchInput });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const toggleRow = (projectId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  // Request Drawing Revision Submission
  const handleRevisionSubmit = async () => {
    if (!revisionProject) return;
    startRevisionTransition(async () => {
      const res = await requestDrawingRevision(
        revisionProject.id,
        revisionNotes,
      );
      if (res.success) {
        toast.success(
          `Permintaan revisi drawing untuk proyek ${revisionProject.projectName} berhasil dikirim.`,
        );
        setRevisionProject(null);
        setRevisionNotes("");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal mengirim permintaan revisi drawing.");
      }
    });
  };

  const handleUpdateComponentQCSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editComponentQCData) return;

    const { stage } = editComponentQCData;

    startComponentQCTransition(async () => {
      const res = await updateComponentStageQC(stage.id, {
        qcStatus: compQCStatus,
        qcNotes: compQCNotes,
      });

      if (res.success) {
        toast.success(`Status QC komponen berhasil diperbarui`);
        setEditComponentQCData(null);
        router.refresh();
      } else {
        toast.error(res.error || "Gagal memperbarui status QC komponen");
      }
    });
  };

  const openComponentQCModal = (comp: any, stage: any) => {
    setCompQCStatus(stage.qcStatus);
    setCompQCNotes(stage.qcNotes || "");
    setEditComponentQCData({ comp, stage });
  };

  // Open QC Dialog
  const openQCModal = (project: any, stage: any) => {
    setQcModalData({ project, stage });
  };

  // Handover Logistics Submission
  const handleHandoverToLogisticSubmit = async () => {
    if (!confirmHandoverProject) return;
    const projectId = confirmHandoverProject.id;

    startTransition(async () => {
      const res = await handoverProjectStagesToLogistics(
        projectId,
        selectedHandoverStages,
        handoverNotes,
      );

      if (res.success) {
        toast.success(
          `Berhasil melakukan serah terima untuk proyek ${confirmHandoverProject.projectName}.`,
        );
        setConfirmHandoverProject(null);
        setSelectedHandoverStages([]);
        setHandoverNotes("");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menyerahkan ke divisi Logistik.");
      }
    });
  };

  const handleHandoverComponentsSubmit = async () => {
    if (!confirmHandoverComponents) return;
    const { project, comps } = confirmHandoverComponents;
    const componentIds = comps.map((c: any) => c.id);

    startTransition(async () => {
      const res = await handoverComponentsToLogistics(
        project.id,
        componentIds,
        handoverNotes,
      );

      if (res.success) {
        toast.success(
          `Berhasil melakukan serah terima komponen untuk proyek ${project.projectName}.`,
        );
        setConfirmHandoverComponents(null);
        setSelectedHandoverComponents([]);
        setHandoverNotes("");
        router.refresh();
      } else {
        toast.error(
          res.error || "Gagal menyerahkan komponen ke divisi Logistik.",
        );
      }
    });
  };

  const getProjectProgress = (project: any): number => {
    const stages = project.productionStages || [];
    const totalProgress = stages.reduce(
      (acc: number, s: any) => acc + s.progress,
      0,
    );
    const stageCount = stages.length;
    return stageCount > 0 ? Math.round(totalProgress / stageCount) : 0;
  };

  // Check if Logistic Handover is allowed (At least one stage approved by QC and not yet handed over)
  const isHandoverToLogisticAllowed = (project: any): boolean => {
    if (!project.productionStages) return false;
    const approvedStages = project.productionStages.filter(
      (s: any) => s.qcStatus === "APPROVED",
    );
    if (approvedStages.length === 0) return false;

    const handedOverStages = new Set(
      (project.handovers || []).flatMap((h: any) =>
        h.stages.split(", ").map((s: string) => s.trim()),
      ),
    );
    return approvedStages.some((s: any) => !handedOverStages.has(s.name));
  };

  // Get active stages based on IN_PROGRESS or PAUSED status, or partial progress
  const getActiveStages = (
    project: any,
  ): { name: string; status: string }[] => {
    if (project.prodStatus === "PENDING")
      return [{ name: "PENDING", status: "PENDING" }];
    if (project.prodStatus === "DONE")
      return [{ name: "DONE", status: "DONE" }];

    const active: { name: string; status: string }[] = [];
    project.productionStages?.forEach((stage: any) => {
      if (
        stage.status === "IN_PROGRESS" ||
        stage.status === "PAUSED" ||
        stage.status === "REVISION" ||
        (stage.progress > 0 && stage.progress < 100)
      ) {
        if (!active.some((a) => a.name === stage.name)) {
          active.push({ name: stage.name, status: stage.status });
        }
      }
    });

    return active;
  };

  // Get progress for Fabrikasi, Machining, Mechanical, Finishing
  const getStageAverageProgress = (
    project: any,
  ): { name: string; progress: number }[] => {
    const stageSums: Record<string, { total: number; count: number }> = {
      Fabrikasi: { total: 0, count: 0 },
      Machining: { total: 0, count: 0 },
      Mechanical: { total: 0, count: 0 },
      Finishing: { total: 0, count: 0 },
    };

    project.productionStages?.forEach((stage: any) => {
      const name = stage.name;
      if (stageSums[name] !== undefined) {
        stageSums[name].total += stage.progress;
        stageSums[name].count += 1;
      }
    });

    return Object.keys(stageSums).map((name) => {
      const { total, count } = stageSums[name];
      const avg = count > 0 ? Math.round(total / count) : 0;
      return { name, progress: avg };
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex flex-col justify-between h-24 relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-[0.03] text-foreground transition-transform duration-300 group-hover:scale-110">
            <ClipboardList className="w-24 h-24" />
          </div>
          <span className="text-muted-foreground text-xs font-medium">
            Total Proyek Dipantau
          </span>
          <span className="text-2xl font-bold tracking-tight">
            {stats.totalActive}
          </span>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex flex-col justify-between h-24 relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-[0.03] text-amber-500 transition-transform duration-300 group-hover:scale-110">
            <Clock className="w-24 h-24" />
          </div>
          <span className="text-muted-foreground text-xs font-medium">
            Dalam Pengujian (In Progress)
          </span>
          <span className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {stats.inProgress}
          </span>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex flex-col justify-between h-24 relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-[0.03] text-red-500 transition-transform duration-300 group-hover:scale-110">
            <AlertCircle className="w-24 h-24" />
          </div>
          <span className="text-muted-foreground text-xs font-medium">
            Perlu Perbaikan (Revision)
          </span>
          <span className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">
            {stats.review}
          </span>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex flex-col justify-between h-24 relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-[0.03] text-emerald-500 transition-transform duration-300 group-hover:scale-110">
            <CheckCircle2 className="w-24 h-24" />
          </div>
          <span className="text-muted-foreground text-xs font-medium">
            Lolos QC (Approved)
          </span>
          <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {stats.approved}
          </span>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 md:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search Projects..."
              className="pl-9 w-full shadow-none bg-background rounded-md border-border h-9 text-sm"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-all active:scale-95"
                >
                  <Filter className="w-4 h-4" />
                  Filter
                  {(currentStatus !== "ALL" || currentSort !== "desc") && (
                    <Badge
                      variant="secondary"
                      className="ml-1 px-1 h-5 min-w-5 justify-center rounded-full bg-primary text-primary-foreground"
                    >
                      !
                    </Badge>
                  )}
                </Button>
              }
            />
            <PopoverContent className="w-80 p-4 space-y-4" align="end">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Status QC
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    "ALL",
                    "PENDING",
                    "IN_PROGRESS",
                    "REVISION",
                    "APPROVED",
                  ].map((s) => (
                    <Button
                      key={s}
                      variant={currentStatus === s ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs px-2 cursor-pointer"
                      onClick={() => updateQuery({ status: s })}
                    >
                      {s === "ALL"
                        ? "Semua"
                        : s === "PENDING"
                          ? "Belum QC"
                          : s === "IN_PROGRESS"
                            ? "Sedang QC"
                            : s === "REVISION"
                              ? "Perbaikan"
                              : s === "APPROVED"
                                ? "Lolos QC"
                                : s}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Urutan
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between h-9 cursor-pointer font-medium"
                  onClick={() =>
                    updateQuery({
                      sort: currentSort === "asc" ? "desc" : "asc",
                    })
                  }
                >
                  <span className="flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4" />
                    {currentSort === "desc"
                      ? "Terbaru Dahulu"
                      : "Terlama Dahulu"}
                  </span>
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs hover:bg-primary/90 bg-primary text-primary-foreground hover:text-primary-foreground h-8 cursor-pointer"
                onClick={() => {
                  setSearchInput("");
                  updateQuery({
                    status: "ALL",
                    sort: "desc",
                    search: "",
                  });
                }}
              >
                Reset Filters
              </Button>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-2 text-muted-foreground ml-1">
            <span className="text-xs">
              Hasil:{" "}
              <span className="font-semibold text-muted-foreground">
                {meta?.totalCount || 0}
              </span>{" "}
              proyek
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-row items-center justify-between text-sm py-1 border-b border-border/40 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-xs whitespace-nowrap">
            Tampilkan:
          </span>
          <select
            value={currentLimit}
            onChange={(e) => updateQuery({ limit: e.target.value, page: "1" })}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 cursor-pointer"
            onClick={() => updateQuery({ page: String(currentPage - 1) })}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-muted-foreground mx-1 text-xs">
            Halaman{" "}
            <span className="font-medium text-muted-foreground">
              {currentPage}
            </span>{" "}
            dari{" "}
            <span className="font-medium text-muted-foreground">
              {totalPages || 1}
            </span>
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 cursor-pointer"
            onClick={() => updateQuery({ page: String(currentPage + 1) })}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Table - Styled identically to Production Table */}
      <div className="border border-border rounded-xl bg-card overflow-hidden shadow-xs relative">
        {isPending && (
          <div className="absolute inset-0 z-10 bg-background/40 backdrop-blur-[1px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}
        <Table>
          <TableHeader className="bg-muted/20 border-b border-border/80">
            <TableRow className="border-border hover:bg-transparent text-sm font-bold">
              <TableHead className="w-[50px] text-center font-medium">
                No.
              </TableHead>
              <TableHead className="min-w-[200px] font-medium">
                Project & Customer
              </TableHead>
              <TableHead className="font-medium">Timeline</TableHead>
              <TableHead className="font-medium">Status Produksi</TableHead>
              <TableHead className="font-medium">Project Status</TableHead>
              <TableHead className="font-medium">Progress Produksi</TableHead>
              <TableHead className="font-medium text-center">
                Document Hub
              </TableHead>
              <TableHead className="w-[80px] text-right font-medium">
                Aksi
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
                  <div className="flex flex-col items-center gap-2 opacity-50">
                    <ClipboardList className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      Tidak ada proyek QC yang ditemukan
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project, index) => {
                const isExpanded = !!expandedRows[project.id];
                const totalRunningDays = project.startDate
                  ? differenceInDays(new Date(), new Date(project.startDate))
                  : 0;

                const isHandoverAllowed = isHandoverToLogisticAllowed(project);

                return (
                  <React.Fragment key={project.id}>
                    <TableRow
                      className={cn(
                        "border-border/60 transition-colors group cursor-pointer",
                        isExpanded && "bg-muted/10",
                      )}
                      onClick={() => toggleRow(project.id)}
                    >
                      <TableCell
                        className="text-center text-muted-foreground text-xs font-mono font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(currentPage - 1) * pageSize + index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {project.projectNumber && (
                            <span className="text-xs text-primary font-semibold">
                              {project.projectNumber}
                            </span>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                              {project.projectName}
                            </span>
                            {project.engStatus === "REVISION_TO_ENG" && (
                              <Badge
                                variant="outline"
                                className="bg-rose-500/10 text-rose-600 border-rose-200/60 font-bold text-[9px] px-1.5 py-0 animate-pulse shrink-0"
                              >
                                Revisi Drawing
                              </Badge>
                            )}
                          </div>
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
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setViewDetailProject(project)}
                          className="flex flex-col text-left hover:text-primary transition-colors cursor-pointer group/timeline border-none bg-transparent"
                        >
                          <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-primary shrink-0 group-hover/timeline:animate-pulse" />
                            {totalRunningDays} Hari
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            Deadline:{" "}
                            {project.expectedDate
                              ? format(
                                  new Date(project.expectedDate),
                                  "dd MMM yy",
                                )
                              : "-"}
                          </span>
                        </button>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1.5 max-w-[150px]">
                          {project.prodStatus === "PENDING" ? (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/50 font-bold text-[10px] flex items-center gap-1 w-fit"
                            >
                              <AlertCircle className="w-3 h-3" /> Menunggu
                              Persiapan
                            </Badge>
                          ) : project.qcStatus === "APPROVED" ||
                            (project.productionStages &&
                              project.productionStages.length > 0 &&
                              project.productionStages.every(
                                (s: any) => s.qcStatus === "APPROVED",
                              )) ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 font-bold text-[10px] flex items-center gap-1 w-fit"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Lolos QC
                              (Selesai)
                            </Badge>
                          ) : (
                            (() => {
                              const activeStages = getActiveStages(project);
                              const avgProgress = getProjectProgress(project);
                              if (avgProgress === 100) {
                                return (
                                  <Badge
                                    variant="outline"
                                    className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/50 font-bold text-[10px] flex items-center gap-1 w-fit"
                                  >
                                    <Clock className="w-3 h-3" /> Menunggu
                                    Pengujian
                                  </Badge>
                                );
                              }
                              if (activeStages.length === 0) {
                                return (
                                  <Badge
                                    variant="outline"
                                    className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-200/50 font-bold text-[10px] flex items-center gap-1 w-fit"
                                  >
                                    <Clock className="w-3 h-3" /> Persiapan
                                  </Badge>
                                );
                              }
                              return activeStages.map((actStage) => {
                                const stageName = actStage.name;
                                const isRevision =
                                  actStage.status === "REVISION";
                                let icon = <Layers className="w-3 h-3" />;
                                let colorClass =
                                  "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200/50";
                                if (isRevision) {
                                  icon = (
                                    <AlertTriangle className="w-3 h-3 text-red-500 animate-bounce" />
                                  );
                                  colorClass =
                                    "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/50 font-extrabold animate-pulse";
                                } else if (stageName === "Fabrikasi") {
                                  icon = <Hammer className="w-3 h-3" />;
                                  colorClass =
                                    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/50";
                                } else if (stageName === "Machining") {
                                  icon = <Settings className="w-3 h-3" />;
                                  colorClass =
                                    "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200/50";
                                } else if (stageName === "Mechanical") {
                                  icon = <Wrench className="w-3 h-3" />;
                                  colorClass =
                                    "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200/50";
                                } else if (stageName === "Finishing") {
                                  icon = <Paintbrush className="w-3 h-3" />;
                                  colorClass =
                                    "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200/50";
                                }
                                return (
                                  <Badge
                                    key={stageName}
                                    variant="outline"
                                    className={cn(
                                      "font-bold text-[10px] flex items-center gap-1 w-fit",
                                      colorClass,
                                    )}
                                  >
                                    {icon} {stageName}{" "}
                                    {isRevision && "(REVISI)"}
                                  </Badge>
                                );
                              });
                            })()
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-1">
                          <div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-medium text-[11px] px-2 py-0.5",
                                getProjectStatusColor(
                                  project.currentStatus ||
                                    project.status ||
                                    "PENDING",
                                ),
                              )}
                            >
                              {getProjectStatusLabel(
                                project.currentStatus ||
                                  project.status ||
                                  "PENDING",
                              )}
                            </Badge>
                          </div>
                          {project.currentDivision && (
                            <span className="text-[10px] text-muted-foreground font-medium">
                              Divisi: {formatDivision(project.currentDivision)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {project.prodStatus === "PENDING" ? (
                          <span className="text-xs text-muted-foreground font-medium">
                            -
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1 text-[11px] max-w-[180px]">
                            {getStageAverageProgress(project).map((sa) => (
                              <div
                                key={sa.name}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="text-muted-foreground w-16 text-left shrink-0">
                                  {sa.name}
                                </span>
                                <div className="w-16 bg-muted rounded-full h-1 overflow-hidden shrink-0">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all",
                                      sa.progress === 100
                                        ? "bg-emerald-500"
                                        : sa.progress > 0
                                          ? "bg-blue-500"
                                          : "bg-muted-foreground/30",
                                    )}
                                    style={{ width: `${sa.progress}%` }}
                                  />
                                </div>
                                <span className="font-bold text-foreground w-8 text-right font-mono shrink-0">
                                  {sa.progress}%
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell
                        className="text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DocumentManagerDialog
                          ownerId={project.id}
                          ownerType="PROJECT"
                          leadId={project.leadId}
                          categories={[
                            "BRIEF",
                            "DRAWING",
                            "BOQ",
                            "MECH_PART_LIST",
                            "SPB",
                            "PRODUCTION",
                            "QC",
                            "OTHER",
                          ]}
                          globalDriveUrl={project.globalDriveUrl}
                          onUploadSuccess={() => router.refresh()}
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="relative h-8 px-2 gap-1.5 border border-border/30 bg-background/50 hover:bg-muted font-medium"
                            >
                              <FolderOpen className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs">
                                {project.documentCount || 0}
                              </span>
                              {project.hasRevisedDocs && (
                                <span className="absolute top-0 right-0 -mt-1 flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                              )}
                            </Button>
                          }
                        />
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 rounded-lg animate-in"
                            onClick={() => toggleRow(project.id)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="h-8 w-8 rounded-lg"
                                >
                                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                className="text-xs font-medium"
                                onClick={() => setViewDetailProject(project)}
                              >
                                <FileText className="w-4 h-4 mr-2" /> View
                                Project Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-xs font-medium"
                                onClick={() => setHistoryProject(project)}
                              >
                                <History className="w-4 h-4 mr-2" /> View Logs
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                className={cn(
                                  "text-xs font-semibold text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50 dark:focus:bg-emerald-950/20",
                                  !isHandoverAllowed &&
                                    "opacity-50 pointer-events-none",
                                )}
                                disabled={!isHandoverAllowed}
                                onClick={() => {
                                  setConfirmHandoverProject(project);
                                  setHandoverNotes(
                                    "Kualitas tahapan selesai divalidasi dan lolos pengujian.",
                                  );
                                  setSelectedHandoverStages([]);
                                }}
                              >
                                <ArrowRight className="w-4 h-4 mr-2" /> Serah
                                Terima Logistik
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                className={cn(
                                  "text-xs font-semibold text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20 cursor-pointer",
                                  (project.engStatus === "REVISION_TO_ENG" ||
                                    project.currentDivision === "LOGISTIC") &&
                                    "opacity-50 pointer-events-none",
                                )}
                                disabled={
                                  project.engStatus === "REVISION_TO_ENG" ||
                                  project.currentDivision === "LOGISTIC"
                                }
                                onClick={() => setRevisionProject(project)}
                              >
                                <AlertTriangle className="w-4 h-4 mr-2" /> Minta
                                Revisi Drawing
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expandable Section - Mirrors Production Stages Expansion */}
                    {isExpanded && (
                      <TableRow className="bg-muted/10 border-t-0 hover:bg-muted/10">
                        <TableCell colSpan={8} className="p-0">
                          <div className="p-6 border-t border-border/40 bg-muted/20 animate-in fade-in duration-300 slide-in-from-top-2 space-y-6">
                            {/* Expanded Row Header with Drawing Link & Logistics Handover Button */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card p-4 rounded-xl border border-border/85 gap-3 shadow-xs">
                              <div className="flex flex-wrap gap-4 text-xs font-medium">
                                <DocumentManagerDialog
                                  ownerId={project.id}
                                  ownerType="PROJECT"
                                  leadId={project.leadId}
                                  categories={["DRAWING"]}
                                  globalDriveUrl={project.globalDriveUrl}
                                  onUploadSuccess={() => router.refresh()}
                                  trigger={
                                    <button className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-lg border border-border/60 text-xs font-medium cursor-pointer hover:bg-muted transition-all text-left">
                                      <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                                      <span>
                                        Dokumen Drawing:{" "}
                                        <span className="text-primary hover:underline font-bold font-mono">
                                          Buka ↗
                                        </span>
                                      </span>
                                    </button>
                                  }
                                />
                                <DocumentManagerDialog
                                  ownerId={project.id}
                                  ownerType="PROJECT"
                                  leadId={project.leadId}
                                  categories={["PRODUCTION", "QC"]}
                                  globalDriveUrl={project.globalDriveUrl}
                                  onUploadSuccess={() => router.refresh()}
                                  trigger={
                                    <button className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-lg border border-border/60 text-xs font-medium cursor-pointer hover:bg-muted transition-all text-left">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                                      <span>
                                        Dokumen Produksi & QC:{" "}
                                        <span className="text-primary hover:underline font-bold font-mono">
                                          Buka ↗
                                        </span>
                                      </span>
                                    </button>
                                  }
                                />
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="font-bold text-xs bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-xs disabled:opacity-40"
                                  onClick={() => {
                                    setConfirmHandoverProject(project);
                                    setHandoverNotes(
                                      "Kualitas tahapan selesai divalidasi dan lolos pengujian.",
                                    );
                                    setSelectedHandoverStages([]);
                                  }}
                                  disabled={!isHandoverAllowed}
                                >
                                  <ArrowRight className="w-3.5 h-3.5 mr-1" />{" "}
                                  Serah Terima Logistik
                                </Button>
                              </div>
                            </div>

                            {/* Stages Grid (Exactly styled as production dashboard) */}
                            <div className="space-y-4">
                              <h4 className="font-semibold text-sm text-muted-foreground">
                                Pemantauan & Pengujian Kualitas QC
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {project.productionStages?.map((stage: any) => {
                                  let icon = (
                                    <Layers className="w-4 h-4 shrink-0 text-current" />
                                  );
                                  if (stage.name === "Fabrikasi")
                                    icon = (
                                      <Hammer className="w-4 h-4 shrink-0 text-current" />
                                    );
                                  else if (stage.name === "Machining")
                                    icon = (
                                      <Settings className="w-4 h-4 shrink-0 text-current" />
                                    );
                                  else if (stage.name === "Mechanical")
                                    icon = (
                                      <Wrench className="w-4 h-4 shrink-0 text-current" />
                                    );
                                  else if (stage.name === "Finishing")
                                    icon = (
                                      <Paintbrush className="w-4 h-4 shrink-0 text-current" />
                                    );

                                  // Card background color is determined by production status
                                  const statusStyle = getStatusStyles(
                                    stage.status,
                                  );

                                  return (
                                    <div
                                      key={stage.id}
                                      className={cn(
                                        "border rounded-xl p-4 hover:border-primary/45 transition-all flex flex-col justify-between gap-3 shadow-2xs cursor-pointer select-none relative group",
                                        statusStyle,
                                      )}
                                      onClick={() =>
                                        openQCModal(project, stage)
                                      }
                                    >
                                      <div className="space-y-1">
                                        <div className="flex justify-between items-start">
                                          <span className="font-bold text-sm text-foreground flex items-center gap-2">
                                            {icon}
                                            {stage.name}
                                          </span>
                                          <span className="font-mono text-xs font-bold text-foreground">
                                            {stage.progress}%
                                          </span>
                                        </div>

                                        <div className="w-full bg-muted/65 rounded-full h-1.5 mt-2 overflow-hidden">
                                          <div
                                            className={cn(
                                              "h-full rounded-full transition-all",
                                              getProgressBarColor(stage.status),
                                            )}
                                            style={{
                                              width: `${stage.progress}%`,
                                            }}
                                          />
                                        </div>
                                      </div>

                                      <div className="flex flex-col gap-1 text-[11px] pt-2 border-t border-border/20 mt-1">
                                        <div className="flex justify-between items-center">
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm border font-mono uppercase bg-background shadow-3xs">
                                            {stage.status === "REVISION"
                                              ? "REVISI"
                                              : stage.status}
                                          </span>
                                          <span className="text-[10px] text-muted-foreground font-semibold truncate max-w-[125px]">
                                            {(() => {
                                              if (
                                                stage.status === "DONE" ||
                                                stage.progress === 100
                                              )
                                                return "Selesai (Done)";
                                              const steps =
                                                stage.subSteps || [];
                                              const lastCheckedIdx = steps
                                                .map((s: any) => s.checked)
                                                .lastIndexOf(true);
                                              if (lastCheckedIdx === -1)
                                                return "Belum Mulai";
                                              return steps[lastCheckedIdx].name;
                                            })()}
                                          </span>
                                        </div>

                                        {/* Assigned Operator */}
                                        {(stage.assignedLeader ||
                                          stage.assignedTeam) && (
                                          <p className="text-[10px] text-muted-foreground mt-1 truncate">
                                            👤 {stage.assignedLeader || "-"}{" "}
                                            {stage.assignedTeam
                                              ? `(${stage.assignedTeam})`
                                              : ""}
                                          </p>
                                        )}

                                        {/* Operator notes */}
                                        {stage.notes && (
                                          <p className="text-xs font-medium italic text-muted-foreground text-wrap mt-0.5 bg-muted/20 px-1 py-0.5 rounded-sm">
                                            "{stage.notes}"
                                          </p>
                                        )}

                                        {/* QC Status Badge */}
                                        <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-border/10">
                                          <span className="text-[9px] font-medium text-muted-foreground">
                                            QC Status:
                                          </span>
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              "text-[9px] font-semibold px-1.5 py-0.1",
                                              stage.qcStatus === "APPROVED"
                                                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400"
                                                : stage.qcStatus === "REJECTED"
                                                  ? "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400 animate-pulse"
                                                  : "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
                                            )}
                                          >
                                            {stage.qcStatus === "APPROVED"
                                              ? "Lolos"
                                              : stage.qcStatus === "REJECTED"
                                                ? "Revisi"
                                                : "Menunggu"}
                                          </Badge>
                                        </div>

                                        {/* QC Notes */}
                                        {stage.qcNotes && (
                                          <p className="text-[10px] font-medium italic text-red-650 dark:text-red-400 text-wrap mt-0.5 bg-red-500/5 border border-red-500/10 px-1.5 py-0.5 rounded-sm">
                                            Catatan: "{stage.qcNotes}"
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Component Level QC Tracking */}
                            <div className="space-y-4 pt-2">
                              <div className="flex justify-between items-center px-0.5">
                                <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-1.5">
                                  <Layers className="w-4 h-4 text-muted-foreground" />{" "}
                                  Status Kualitas per Komponen
                                </h4>
                                {(() => {
                                  const projectCompIds = project.components.map(
                                    (c: any) => c.id,
                                  );
                                  const selectedProjectComps =
                                    selectedHandoverComponents.filter((id) =>
                                      projectCompIds.includes(id),
                                    );
                                  if (selectedProjectComps.length > 0) {
                                    return (
                                      <Button
                                        type="button"
                                        variant="default"
                                        size="xs"
                                        className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs h-7 px-3 flex items-center gap-1 cursor-pointer text-white shadow-xs"
                                        onClick={() => {
                                          const comps =
                                            project.components.filter(
                                              (c: any) =>
                                                selectedProjectComps.includes(
                                                  c.id,
                                                ),
                                            );
                                          setConfirmHandoverComponents({
                                            project,
                                            comps,
                                          });
                                          setHandoverNotes(
                                            `Serah terima parsial komponen: ${comps.map((c: any) => c.name).join(", ")}`,
                                          );
                                        }}
                                      >
                                        <ArrowRight className="w-3 h-3" />
                                        Serahkan {
                                          selectedProjectComps.length
                                        }{" "}
                                        Komponen
                                      </Button>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>

                              <div className="bg-card rounded-xl border border-border/80 overflow-hidden shadow-2xs">
                                {!project.components ||
                                project.components.length === 0 ? (
                                  <div className="text-center p-6 text-muted-foreground">
                                    <Layers className="w-8 h-8 text-muted-foreground/45 mx-auto mb-2 opacity-50" />
                                    <p className="text-xs font-medium">
                                      Tidak ada komponen untuk proyek ini.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <Table>
                                      <TableHeader className="bg-muted/10 border-b border-border/60">
                                        <TableRow className="border-border hover:bg-transparent text-[11px] font-bold">
                                          <TableHead className="w-[30px] text-center"></TableHead>
                                          <TableHead className="w-[50px] text-center font-semibold">
                                            No.
                                          </TableHead>
                                          <TableHead className="font-semibold">
                                            Nama Komponen
                                          </TableHead>
                                          <TableHead className="text-center font-semibold">
                                            Fabrikasi
                                          </TableHead>
                                          <TableHead className="text-center font-semibold">
                                            Machining
                                          </TableHead>
                                          <TableHead className="text-center font-semibold">
                                            Mechanical
                                          </TableHead>
                                          <TableHead className="text-center font-semibold">
                                            Finishing
                                          </TableHead>
                                          <TableHead className="w-[120px] text-right font-semibold">
                                            Logistik
                                          </TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody className="text-xs">
                                        {project.components.map(
                                          (comp: any, compIdx: number) => {
                                            const stageMap = comp.stages.reduce(
                                              (acc: any, s: any) => {
                                                acc[s.name] = s;
                                                return acc;
                                              },
                                              {},
                                            );

                                            return (
                                              <TableRow
                                                key={comp.id}
                                                className="border-border/40 hover:bg-muted/5"
                                              >
                                                <TableCell className="w-[30px] text-center">
                                                  {(() => {
                                                    const isReady =
                                                      comp.stages.length > 0 &&
                                                      comp.stages.every(
                                                        (s: any) =>
                                                          s.qcStatus ===
                                                          "APPROVED",
                                                      );
                                                    const isHandedOver =
                                                      !!comp.handoverId;
                                                    if (
                                                      isHandedOver ||
                                                      !isReady
                                                    ) {
                                                      return (
                                                        <Checkbox
                                                          checked={isHandedOver}
                                                          disabled
                                                          className="scale-90"
                                                        />
                                                      );
                                                    }
                                                    return (
                                                      <Checkbox
                                                        checked={selectedHandoverComponents.includes(
                                                          comp.id,
                                                        )}
                                                        className="scale-90 cursor-pointer"
                                                        onCheckedChange={(
                                                          checked,
                                                        ) => {
                                                          if (checked) {
                                                            setSelectedHandoverComponents(
                                                              (prev) => [
                                                                ...prev,
                                                                comp.id,
                                                              ],
                                                            );
                                                          } else {
                                                            setSelectedHandoverComponents(
                                                              (prev) =>
                                                                prev.filter(
                                                                  (id) =>
                                                                    id !==
                                                                    comp.id,
                                                                ),
                                                            );
                                                          }
                                                        }}
                                                      />
                                                    );
                                                  })()}
                                                </TableCell>
                                                <TableCell className="text-center font-medium text-muted-foreground w-[50px]">
                                                  {compIdx + 1}
                                                </TableCell>
                                                <TableCell className="font-semibold text-foreground">
                                                  {comp.name}
                                                </TableCell>
                                                {[
                                                  "Fabrikasi",
                                                  "Machining",
                                                  "Mechanical",
                                                  "Finishing",
                                                ].map((stageName) => {
                                                  const s = stageMap[stageName];
                                                  return (
                                                    <TableCell
                                                      key={stageName}
                                                      className="text-center"
                                                    >
                                                      {!s ? (
                                                        <span className="text-muted-foreground/45 font-medium">
                                                          N/A
                                                        </span>
                                                      ) : (
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            if (
                                                              project.qcStatus !==
                                                              "APPROVED"
                                                            ) {
                                                              openComponentQCModal(
                                                                comp,
                                                                s,
                                                              );
                                                            }
                                                          }}
                                                          disabled={
                                                            project.qcStatus ===
                                                            "APPROVED"
                                                          }
                                                          className={cn(
                                                            "inline-flex flex-col gap-0.5 px-2.5 py-1.5 rounded-md border font-semibold text-[10px] cursor-pointer text-left w-full justify-between transition-all active:scale-97 hover:border-primary/30",
                                                            s.qcStatus ===
                                                              "APPROVED"
                                                              ? "bg-emerald-500/10 text-emerald-800 border-emerald-300/30"
                                                              : s.qcStatus ===
                                                                  "REJECTED"
                                                                ? "bg-rose-500/10 text-rose-800 border-rose-300/30 animate-pulse"
                                                                : "bg-amber-500/10 text-amber-800 border-amber-300/30",
                                                          )}
                                                        >
                                                          <div className="flex justify-between items-center w-full">
                                                            <span className="font-bold">
                                                              {s.qcStatus ===
                                                              "APPROVED"
                                                                ? "Lolos"
                                                                : s.qcStatus ===
                                                                    "REJECTED"
                                                                  ? "Revisi"
                                                                  : "Menunggu"}
                                                            </span>
                                                            <span className="font-mono text-[9px] opacity-75">
                                                              {getComponentStageStepLabel(
                                                                stageName,
                                                                s.progress,
                                                                s.status,
                                                              )}
                                                            </span>
                                                          </div>
                                                          {s.qcNotes && (
                                                            <span className="text-[9px] text-muted-foreground truncate max-w-full font-medium italic mt-0.5 block font-sans">
                                                              Note: "{s.qcNotes}
                                                              "
                                                            </span>
                                                          )}
                                                        </button>
                                                      )}
                                                    </TableCell>
                                                  );
                                                })}
                                                <TableCell className="text-right">
                                                  {comp.handoverId ? (
                                                    <Badge
                                                      variant="outline"
                                                      className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/50 font-semibold text-[10px]"
                                                    >
                                                      Diserahkan
                                                    </Badge>
                                                  ) : (
                                                    (() => {
                                                      const hasActiveStages =
                                                        comp.stages.length > 0;
                                                      const allApproved =
                                                        hasActiveStages &&
                                                        comp.stages.every(
                                                          (s: any) =>
                                                            s.qcStatus ===
                                                            "APPROVED",
                                                        );
                                                      if (allApproved) {
                                                        return (
                                                          <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="xs"
                                                            className="h-6 text-[10px] px-2 border-emerald-500 text-emerald-600 bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer font-semibold"
                                                            onClick={() => {
                                                              setConfirmHandoverComponents(
                                                                {
                                                                  project,
                                                                  comps: [comp],
                                                                },
                                                              );
                                                              setHandoverNotes(
                                                                `Serah terima parsial komponen: ${comp.name}`,
                                                              );
                                                            }}
                                                          >
                                                            Serahkan
                                                          </Button>
                                                        );
                                                      } else {
                                                        return (
                                                          <span className="text-[10px] text-muted-foreground italic font-medium">
                                                            Belum Diproses
                                                          </span>
                                                        );
                                                      }
                                                    })()
                                                  )}
                                                </TableCell>
                                              </TableRow>
                                            );
                                          },
                                        )}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* QC History Logs */}
                            <div className="space-y-3 pt-2">
                              <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-1.5">
                                <History className="w-4 h-4 text-muted-foreground" />{" "}
                                Histori Pengujian QC
                              </h4>
                              <div className="bg-card rounded-xl border border-border overflow-hidden shadow-2xs max-h-48 overflow-y-auto">
                                {!project.qcLogs ||
                                project.qcLogs.length === 0 ? (
                                  <p className="text-xs text-muted-foreground p-4 text-center">
                                    Belum ada histori pengujian QC untuk proyek
                                    ini.
                                  </p>
                                ) : (
                                  <div className="divide-y divide-border/60">
                                    {project.qcLogs.map(
                                      (log: any, lIdx: number) => (
                                        <div
                                          key={log.id || lIdx}
                                          className="p-3 text-xs flex justify-between items-start gap-4 hover:bg-muted/20"
                                        >
                                          <div className="space-y-1">
                                            <p className="font-semibold text-foreground">
                                              Tahap:{" "}
                                              <span className="text-primary font-bold">
                                                {log.stage?.name}
                                              </span>{" "}
                                              - Hasil QC:{" "}
                                              <Badge
                                                variant="outline"
                                                className={cn(
                                                  "text-[10px] font-bold px-1.5 py-0.1 ml-1",
                                                  log.status === "APPROVED"
                                                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                                    : log.status === "REJECTED"
                                                      ? "bg-red-50 text-red-800 border-red-300 animate-pulse"
                                                      : "bg-amber-50 text-amber-800 border-amber-300",
                                                )}
                                              >
                                                {log.status === "APPROVED"
                                                  ? "Lolos QC"
                                                  : log.status === "REJECTED"
                                                    ? "Perlu Perbaikan"
                                                    : "Menunggu QC"}
                                              </Badge>
                                            </p>
                                            {log.notes && (
                                              <p className="text-muted-foreground italic text-[11px] bg-muted/10 px-2 py-0.5 rounded-sm border border-border/20 mt-1 inline-block">
                                                Catatan: "{log.notes}"
                                              </p>
                                            )}
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                              Pemeriksa:{" "}
                                              <strong className="text-foreground/80">
                                                {log.user}
                                              </strong>
                                            </p>
                                          </div>
                                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                            {format(
                                              new Date(log.createdAt),
                                              "dd MMM yy HH:mm",
                                            )}
                                          </span>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Stage Status & Progress Modal (Read-Only) */}
      <Dialog
        open={!!qcModalData}
        onOpenChange={(open) => !open && setQcModalData(null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-base">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Detail QC Tahap: {qcModalData?.stage?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Proyek:{" "}
              <span className="font-semibold text-foreground">
                {qcModalData?.project?.projectName}
              </span>
            </DialogDescription>
          </DialogHeader>

          {qcModalData && (
            <div className="space-y-4 py-2 text-xs">
              {/* Summary Stage Panel */}
              <div className="bg-muted/30 border rounded-xl p-3.5 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-muted-foreground font-medium block">
                      Progress Rata-rata
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden border">
                        <div
                          className={cn(
                            "h-full transition-all",
                            getProgressBarColor(qcModalData.stage.status),
                          )}
                          style={{ width: `${qcModalData.stage.progress}%` }}
                        />
                      </div>
                      <span className="font-bold font-mono text-sm shrink-0">
                        {qcModalData.stage.progress}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground font-medium block">
                      Status Tahap
                    </span>
                    <Badge
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5",
                        getStatusStyles(qcModalData.stage.status),
                      )}
                    >
                      {qcModalData.stage.status === "REVISION"
                        ? "REVISI"
                        : qcModalData.stage.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1 border-t border-border/50">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium block">
                      Leader Pelaksana
                    </span>
                    <span className="font-semibold text-foreground truncate block">
                      {qcModalData.stage.assignedLeader || "-"}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium block">
                      Team Lapangan
                    </span>
                    <span className="font-semibold text-foreground truncate block">
                      {qcModalData.stage.assignedTeam || "-"}
                    </span>
                  </div>
                </div>

                {qcModalData.stage.notes && (
                  <div className="pt-2 border-t border-border/50 space-y-0.5">
                    <span className="text-muted-foreground font-medium block">
                      Catatan Lapangan
                    </span>
                    <p className="text-foreground italic bg-background/50 p-2 rounded-md border font-mono">
                      "{qcModalData.stage.notes}"
                    </p>
                  </div>
                )}
              </div>

              {/* Components List Section */}
              <div className="space-y-2">
                <div className="flex justify-between items-center px-0.5">
                  <Label className="text-xs font-bold text-foreground">
                    Pelacakan Kualitas Komponen
                  </Label>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {(() => {
                      const comps = qcModalData.project.components || [];
                      const passing = comps.filter((comp: any) =>
                        comp.stages.some(
                          (s: any) => s.name === qcModalData.stage.name,
                        ),
                      );
                      return `${passing.length} Komponen`;
                    })()}
                  </span>
                </div>

                <div className="border rounded-xl bg-card overflow-hidden max-h-60 overflow-y-auto divide-y divide-border/60">
                  {(() => {
                    const comps = qcModalData.project.components || [];
                    const passing = comps.filter((comp: any) =>
                      comp.stages.some(
                        (s: any) => s.name === qcModalData.stage.name,
                      ),
                    );

                    if (passing.length === 0) {
                      return (
                        <div className="text-center p-6 text-muted-foreground text-xs">
                          Tidak ada komponen untuk tahapan ini.
                        </div>
                      );
                    }

                    return passing.map((comp: any) => {
                      const cStage = comp.stages.find(
                        (s: any) => s.name === qcModalData.stage.name,
                      );
                      if (!cStage) return null;

                      const qcBadgeColor =
                        cStage.qcStatus === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-800 border-emerald-200/50"
                          : cStage.qcStatus === "REJECTED"
                            ? "bg-rose-500/10 text-rose-800 border-rose-200/50"
                            : "bg-amber-500/10 text-amber-800 border-amber-200/50";

                      return (
                        <div
                          key={comp.id}
                          className="p-2.5 flex items-center justify-between gap-4 hover:bg-muted/5"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <span className="font-semibold text-foreground truncate block">
                              {comp.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5">
                              Step:{" "}
                              <span className="text-foreground font-semibold">
                                {getComponentStageStepLabel(
                                  qcModalData.stage.name,
                                  cStage.progress,
                                  cStage.status,
                                )}
                              </span>
                              <span className="opacity-40">|</span>
                              <span>{cStage.progress}%</span>
                            </span>
                            {(cStage.assignedLeader || cStage.assignedTeam) && (
                              <div className="text-[9px] text-muted-foreground/80 mt-0.5 flex flex-wrap gap-1.5 font-medium">
                                {cStage.assignedLeader && (
                                  <span>
                                    Ldr:{" "}
                                    <strong className="text-foreground/80">
                                      {cStage.assignedLeader}
                                    </strong>
                                  </span>
                                )}
                                {cStage.assignedLeader &&
                                  cStage.assignedTeam && (
                                    <span className="opacity-45">|</span>
                                  )}
                                {cStage.assignedTeam && (
                                  <span>
                                    Tim:{" "}
                                    <strong className="text-foreground/80">
                                      {cStage.assignedTeam}
                                    </strong>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              className={cn(
                                "text-[9px] font-bold px-1.5 py-0",
                                getStatusStyles(cStage.status),
                              )}
                            >
                              {cStage.status === "REVISION"
                                ? "REVISI"
                                : cStage.status}
                            </Badge>

                            <Badge
                              className={cn(
                                "text-[9px] font-bold border px-1.5 py-0",
                                qcBadgeColor,
                              )}
                            >
                              {cStage.qcStatus === "APPROVED"
                                ? "Lolos QC"
                                : cStage.qcStatus === "REJECTED"
                                  ? "Revisi QC"
                                  : "Menunggu QC"}
                            </Badge>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer text-xs h-8"
              onClick={() => setQcModalData(null)}
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Handover to Logistic Modal */}
      <Dialog
        open={!!confirmHandoverProject}
        onOpenChange={(open) => !open && setConfirmHandoverProject(null)}
      >
        <DialogContent className="sm:max-w-[480px] w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-sm font-bold text-emerald-600">
              <ArrowRight className="w-4 h-4 text-emerald-600" />
              Serah Terima ke Divisi Logistik
            </DialogTitle>
            <DialogDescription className="text-xs text-foreground font-medium">
              Serah terima parsial tahapan pengerjaan proyek{" "}
              <strong className="text-foreground">
                {confirmHandoverProject?.projectName}
              </strong>{" "}
              ke Logistik & Shipping.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Checklist of stages to hand over */}
            <div className="space-y-2">
              <Label className="font-bold text-foreground block">
                Pilih Tahapan Produksi (Lolos QC) untuk Diserahkan:
              </Label>
              <div className="border rounded-lg p-3 bg-muted/10 space-y-2.5">
                {confirmHandoverProject?.productionStages?.map((stage: any) => {
                  // Check if stage is already handed over
                  const handedOverStages = new Set(
                    (confirmHandoverProject.handovers || []).flatMap((h: any) =>
                      h.stages.split(", ").map((s: string) => s.trim()),
                    ),
                  );
                  const isHandedOver = handedOverStages.has(stage.name);
                  const isQCApproved = stage.qcStatus === "APPROVED";
                  const isDisabled = isHandedOver || !isQCApproved;

                  return (
                    <div
                      key={stage.id}
                      className="flex items-center justify-between p-1"
                    >
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`handover-stage-${stage.id}`}
                          checked={
                            selectedHandoverStages.includes(stage.name) ||
                            isHandedOver
                          }
                          disabled={isDisabled}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedHandoverStages((prev) => [
                                ...prev,
                                stage.name,
                              ]);
                            } else {
                              setSelectedHandoverStages((prev) =>
                                prev.filter((name) => name !== stage.name),
                              );
                            }
                          }}
                        />
                        <Label
                          htmlFor={`handover-stage-${stage.id}`}
                          className={cn(
                            "text-xs font-semibold cursor-pointer",
                            isDisabled &&
                              "text-muted-foreground cursor-not-allowed",
                          )}
                        >
                          {stage.name} ({stage.progress}%)
                        </Label>
                      </div>

                      <span className="text-[10px] font-bold">
                        {isHandedOver ? (
                          <span className="text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-sm">
                            Sudah Terkirim
                          </span>
                        ) : isQCApproved ? (
                          <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-sm">
                            Siap Kirim (Lolos QC)
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-sm">
                            Belum Lolos QC
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <Label
                htmlFor="handoverNotes"
                className="font-bold text-foreground"
              >
                Catatan / Memo Serah Terima (Wajib)
              </Label>
              <Textarea
                id="handoverNotes"
                placeholder="Tulis instruksi pengiriman atau rincian item logistik..."
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                className="text-xs min-h-[80px] resize-y"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmHandoverProject(null)}
              className="cursor-pointer text-xs h-8"
              disabled={isPending}
            >
              Batal
            </Button>
            <Button
              onClick={handleHandoverToLogisticSubmit}
              className="cursor-pointer text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
              disabled={
                isPending ||
                selectedHandoverStages.length === 0 ||
                !handoverNotes.trim()
              }
            >
              {isPending && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
              Proses Serah Terima
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Handover Components Modal */}
      <Dialog
        open={!!confirmHandoverComponents}
        onOpenChange={(open) => !open && setConfirmHandoverComponents(null)}
      >
        <DialogContent className="sm:max-w-[480px] w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
              <ArrowRight className="w-4 h-4 text-emerald-600" />
              Serah Terima Komponen ke Divisi Logistik
            </DialogTitle>
            <DialogDescription className="text-sm text-foreground font-medium">
              Aksi ini akan menyerahkan komponen ini ke Divisi Logistik
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-2">
              <Label className="font-semibold text-foreground block">
                Komponen yang Akan Diserahkan:
              </Label>
              <div className="border rounded-lg p-3 bg-muted/10 max-h-32 overflow-y-auto space-y-1.5 text-sm font-semibold text-foreground">
                {confirmHandoverComponents?.comps.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>{c.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="compHandoverNotes"
                className="font-semibold text-foreground"
              >
                Catatan / Memo Serah Terima (Wajib)
              </Label>
              <Textarea
                id="compHandoverNotes"
                placeholder="Tulis instruksi pengiriman atau rincian item logistik..."
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                className="text-xs min-h-[80px] resize-y"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmHandoverComponents(null)}
              className="cursor-pointer text-xs h-8"
              disabled={isPending}
            >
              Batal
            </Button>
            <Button
              onClick={handleHandoverComponentsSubmit}
              className="cursor-pointer text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
              disabled={
                isPending ||
                confirmHandoverComponents?.comps.length === 0 ||
                !handoverNotes.trim()
              }
            >
              {isPending && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
              Proses Serah Terima
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Drawing Revision Dialog */}
      <Dialog
        open={!!revisionProject}
        onOpenChange={(open) => {
          if (!open) {
            setRevisionProject(null);
            setRevisionNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-sm font-bold text-rose-600">
              <AlertTriangle className="w-4 h-4" />
              Minta Revisi Drawing
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ajukan permintaan revisi gambar kerja ke tim Engineering untuk
              proyek{" "}
              <strong className="text-foreground">
                {revisionProject?.projectName}
              </strong>
              . Proyek akan ditandai sedang revisi, namun tetap dapat diakses di
              dashboard ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1">
              <Label
                htmlFor="revisionNotes"
                className="font-medium text-foreground"
              >
                Catatan Revisi / Detail Kesalahan
              </Label>
              <Textarea
                id="revisionNotes"
                placeholder="Jelaskan bagian gambar mana yang salah atau perlu direvisi..."
                className="min-h-[100px] text-xs resize-y"
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRevisionProject(null);
                setRevisionNotes("");
              }}
              disabled={isPendingRevision}
              className="text-xs h-8 cursor-pointer"
            >
              Batal
            </Button>
            <Button
              onClick={handleRevisionSubmit}
              disabled={isPendingRevision || !revisionNotes.trim()}
              className="text-xs h-8 bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs cursor-pointer"
            >
              {isPendingRevision && (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              )}
              Kirim ke Engineering
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Pemeriksaan QC Komponen */}
      <Dialog
        open={!!editComponentQCData}
        onOpenChange={(open) => !open && setEditComponentQCData(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Pemeriksaan QC Komponen
            </DialogTitle>
            <DialogDescription>
              Tentukan hasil uji kualitas untuk komponen{" "}
              <strong className="text-foreground">
                "{editComponentQCData?.comp?.name}"
              </strong>{" "}
              pada tahap{" "}
              <strong className="text-primary">
                {editComponentQCData?.stage?.name}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleUpdateComponentQCSubmit}
            className="space-y-4 pt-2"
          >
            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                Hasil Pengujian Kualitas
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    id: "APPROVED",
                    label: "Lolos Uji (Approve)",
                    variant: "default",
                  },
                  {
                    id: "REJECTED",
                    label: "Revisi (Reject)",
                    variant: "destructive",
                  },
                  { id: "PENDING", label: "Menunggu", variant: "outline" },
                ].map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    variant={
                      compQCStatus === option.id
                        ? (option.variant as any)
                        : "outline"
                    }
                    className="text-xs h-9 cursor-pointer"
                    onClick={() => setCompQCStatus(option.id as any)}
                    disabled={isComponentQCPending}
                  >
                    {option.id === "APPROVED"
                      ? "Lolos"
                      : option.id === "REJECTED"
                        ? "Revisi"
                        : "Menunggu"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="compQCNotes" className="text-xs font-semibold">
                Catatan / Temuan QC
              </Label>
              <Textarea
                id="compQCNotes"
                placeholder="Masukkan catatan spesifikasi, kesalahan, atau temuan lapangan jika perlu perbaikan..."
                value={compQCNotes}
                onChange={(e) => setCompQCNotes(e.target.value)}
                disabled={isComponentQCPending}
                className="text-xs h-20"
                required={compQCStatus === "REJECTED"} // Notes required if rejected
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditComponentQCData(null)}
                disabled={isComponentQCPending}
                className="text-xs h-8 cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  isComponentQCPending ||
                  (compQCStatus === "REJECTED" && !compQCNotes.trim())
                }
                className="text-xs h-8 bg-primary hover:bg-primary/95 text-primary-foreground font-bold shadow-xs cursor-pointer"
              >
                {isComponentQCPending && (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                )}
                Simpan Keputusan QC
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Global Dialog instances */}
      <ProjectDetailDialog
        data={viewDetailProject}
        open={!!viewDetailProject}
        onOpenChange={(open) => !open && setViewDetailProject(null)}
        type="PROJECT"
        showValue={false}
      />

      <ProjectHistoryDialog
        project={historyProject}
        open={!!historyProject}
        onOpenChange={(open) => !open && setHistoryProject(null)}
      />
    </div>
  );
}
