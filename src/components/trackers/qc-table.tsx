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
  XCircle,
  Eye,
} from "lucide-react";
import { formatJakartaDate } from "@/lib/date-utils";
import { getDocumentDownloadUrl } from "@/app/actions/documents";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format, differenceInDays } from "date-fns";
import { ProjectDetailDialog } from "@/components/project-detail-dialog";
import { ProjectHistoryDialog } from "@/components/project-history-dialog";
import { DocumentManagerDialog } from "@/components/document-manager-dialog";
import {
  NCRManagerDialog,
  QCNCRManagerPanel,
} from "@/components/trackers/qc-revision-manager";
import { QCReceiptDialog } from "@/components/trackers/qc-receipt-dialog";
import { ShieldCheck, Calendar, PackageCheck } from "lucide-react";
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
      return "";
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
  poReceipts = [],
  meta,
  stats,
}: {
  projects: any[];
  poReceipts?: any[];
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

  // Tab & PO Receipt State
  const [qcTab, setQcTab] = useState<"production" | "po_receipts">(
    "production",
  );
  const [poFilterStatus, setPoFilterStatus] = useState<string>("ALL");
  const [poSearchQuery, setPoSearchQuery] = useState<string>("");
  const [poPage, setPoPage] = useState<number>(1);
  const [poLimit, setPoLimit] = useState<number>(10);
  const [inspectReceipt, setInspectReceipt] = useState<any | null>(null);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] =
    useState<boolean>(false);

  useEffect(() => {
    setPoPage(1);
  }, [poFilterStatus, poSearchQuery]);

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
  const [ncrProject, setNcrProject] = useState<any | null>(null);

  // Revision request states
  const [revisionProject, setRevisionProject] = useState<any | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [isPendingRevision, startRevisionTransition] = useTransition();

  const handleViewDocument = async (doc: any) => {
    if (doc.isExternal && doc.url) {
      window.open(doc.url, "_blank");
      return;
    }
    const toastId = toast.loading(`Membuka berkas ${doc.name || "dokumen"}...`);
    try {
      const res = await getDocumentDownloadUrl(doc.id, false);
      if (res.success && res.url) {
        toast.dismiss(toastId);
        window.open(res.url, "_blank");
      } else {
        toast.error(res.error || "Gagal membuka berkas dokumen", {
          id: toastId,
        });
      }
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan saat membuka berkas", {
        id: toastId,
      });
    }
  };

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
    if (project.masterplan?.phases && project.masterplan.phases.length > 0) {
      return Math.round(
        project.masterplan.phases.reduce((sum: number, phase: any) => {
          const weight = Number(phase.weightPercent || 0);
          const progress = Number(phase.actualProgress || 0);
          return sum + (progress * weight) / 100;
        }, 0),
      );
    }
    if (project.phases && project.phases.length > 0) {
      return Math.round(
        project.phases.reduce((sum: number, phase: any) => {
          const weight = Number(phase.weightPercent || 0);
          const progress = Number(phase.actualProgress || 0);
          return sum + (progress * weight) / 100;
        }, 0),
      );
    }

    if (
      project.prodStatus === "PENDING" ||
      !project.productionStages ||
      project.productionStages.length === 0
    ) {
      return 0;
    }

    let totalProgress = 0;
    let stageCount = 0;

    project.productionStages.forEach((stage: any) => {
      totalProgress += stage.progress;
      stageCount++;
    });

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

  const filteredPOReceipts = (poReceipts || []).filter((r: any) => {
    let matchesStatus = true;
    if (poFilterStatus !== "ALL") {
      const items = r.items || [];
      if (
        poFilterStatus === "PENDING" ||
        poFilterStatus === "PENDING_INSPECTION"
      ) {
        matchesStatus =
          r.qcStatus === "PENDING_INSPECTION" ||
          items.some(
            (i: any) =>
              i.qcStatus === "PENDING_INSPECTION" ||
              i.qcStatus === "NONE" ||
              ((Number(i.qtyPassed) || 0) === 0 && (Number(i.qtyFailed) || 0) === 0),
          );
      } else if (poFilterStatus === "APPROVED") {
        matchesStatus =
          r.qcStatus === "APPROVED" ||
          items.some(
            (i: any) => i.qcStatus === "PASSED" || (Number(i.qtyPassed) || 0) > 0,
          );
      } else if (poFilterStatus === "REJECTED") {
        matchesStatus =
          r.qcStatus === "REJECTED" ||
          items.some(
            (i: any) => i.qcStatus === "FAILED" || (Number(i.qtyFailed) || 0) > 0,
          );
      } else if (poFilterStatus === "PARTIAL") {
        matchesStatus =
          r.qcStatus === "PARTIAL" ||
          items.some(
            (i: any) =>
              i.qcStatus === "PARTIAL" ||
              ((Number(i.qtyPassed) || 0) > 0 && (Number(i.qtyFailed) || 0) > 0),
          );
      } else {
        matchesStatus = (r.qcStatus || "NONE") === poFilterStatus;
      }
    }
    if (!matchesStatus) return false;

    if (!poSearchQuery.trim()) return true;
    const query = poSearchQuery.toLowerCase().trim();
    const nomorPO = (r.nomorPO || "").toLowerCase();
    const supplier = (r.kepada || "").toLowerCase();
    const projek = (r.projek || "").toLowerCase();
    const matchItemName = (r.items || []).some((i: any) =>
      (i.namaBarang || "").toLowerCase().includes(query),
    );

    return (
      nomorPO.includes(query) ||
      supplier.includes(query) ||
      projek.includes(query) ||
      matchItemName
    );
  });

  const totalPoItems = filteredPOReceipts.length;
  const totalPoPages = Math.ceil(totalPoItems / poLimit) || 1;
  const paginatedPOReceipts = filteredPOReceipts.slice(
    (poPage - 1) * poLimit,
    poPage * poLimit,
  );

  const pendingPOReceiptsCount = (poReceipts || []).filter(
    (r: any) => r.qcStatus === "PENDING_INSPECTION" || r.qcStatus === "PENDING",
  ).length;

  return (
    <div className="space-y-6">
      <Tabs
        value={qcTab}
        onValueChange={(val) => setQcTab(val as any)}
        className="w-full space-y-4"
      >
        <TabsList className="bg-muted/40 p-1.5 rounded-2xl border border-border/50 h-auto inline-flex items-center justify-start gap-1.5 w-fit">
          <TabsTrigger
            value="production"
            className="rounded-xl text-xs font-bold px-4 py-2 h-9 flex items-center justify-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all cursor-pointer"
          >
            <ClipboardList className="w-4 h-4 text-primary shrink-0" />
            <span>QC Hasil Produksi</span>
          </TabsTrigger>

          <TabsTrigger
            value="po_receipts"
            className="rounded-xl text-xs font-bold px-4 py-2 h-9 flex items-center justify-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all cursor-pointer relative"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>QC Penerimaan Barang</span>
            {pendingPOReceiptsCount > 0 && (
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-1.5 py-0 h-4 rounded-full font-bold ml-1 animate-pulse">
                {pendingPOReceiptsCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="production" className="space-y-6 pt-1">
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
                onChange={(e) =>
                  updateQuery({ limit: e.target.value, page: "1" })
                }
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
                <span className="font-semibold text-muted-foreground">
                  {currentPage}
                </span>{" "}
                dari{" "}
                <span className="font-semibold text-muted-foreground">
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
            <Table className="w-full table-fixed">
              <TableHeader className="bg-muted/20 border-b border-border/80">
                <TableRow className="border-border hover:bg-transparent text-sm font-semibold text-foreground">
                  <TableHead className="w-12 text-center">No.</TableHead>
                  <TableHead className="w-[26%]">Project & Customer</TableHead>
                  <TableHead className="w-[13%]">Tanggal Deal</TableHead>
                  <TableHead className="w-[8%]">Running</TableHead>
                  <TableHead className="w-[13%]">Deadline</TableHead>
                  <TableHead className="w-[20%]">
                    Status & Progress Produksi
                  </TableHead>
                  <TableHead className="w-[11%] text-center">
                    Document Hub
                  </TableHead>
                  <TableHead className="w-20 text-right">Aksi</TableHead>
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
                      ? differenceInDays(
                          new Date(),
                          new Date(project.startDate),
                        )
                      : 0;

                    const daysLeft = project.expectedDate
                      ? differenceInDays(
                          new Date(project.expectedDate),
                          new Date(),
                        )
                      : null;

                    const avgProgress = getProjectProgress(project);
                    const isHandoverAllowed =
                      isHandoverToLogisticAllowed(project);

                    return (
                      <React.Fragment key={project.id}>
                        <TableRow
                          className={cn(
                            "border-border/60 transition-colors group cursor-pointer",
                            isExpanded && "bg-muted/10",
                          )}
                          onClick={() => toggleRow(project.id)}
                        >
                          {/* 1. No */}
                          <TableCell
                            className="text-center text-foreground text-xs font-semibold"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {(currentPage - 1) * pageSize + index + 1}
                          </TableCell>

                          {/* 2. Project & Customer */}
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              {project.projectNumber && (
                                <span className="text-xs text-orange-600 font-bold">
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

                          {/* 3. Tanggal Deal */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                              <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>
                                {project.startDate
                                  ? format(
                                      new Date(project.startDate),
                                      "dd MMM yyyy",
                                    )
                                  : "-"}
                              </span>
                            </div>
                          </TableCell>

                          {/* 4. Running */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                              {totalRunningDays} Hari
                            </span>
                          </TableCell>

                          {/* 5. Deadline */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-col gap-1 text-xs">
                              <span className="text-muted-foreground font-medium flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                {project.expectedDate
                                  ? format(
                                      new Date(project.expectedDate),
                                      "dd MMM yyyy",
                                    )
                                  : "-"}
                              </span>
                              {daysLeft !== null && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 w-fit",
                                    daysLeft >= 0
                                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300"
                                      : "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-300",
                                  )}
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  {daysLeft >= 0
                                    ? `${daysLeft} days left`
                                    : `${Math.abs(daysLeft)} days overdue`}
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* 6. Status & Progress Produksi */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-col gap-1.5 max-w-45">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-xs font-bold text-foreground">
                                  {avgProgress}%
                                </span>
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  Actual Progress
                                </span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-orange-500 h-full transition-all rounded-full"
                                  style={{ width: `${avgProgress}%` }}
                                />
                              </div>
                              {project.prodStatus === "PENDING" ? (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/50 font-bold text-[10px] flex items-center gap-1 w-fit"
                                >
                                  <AlertCircle className="w-3 h-3" /> Menunggu
                                  Persiapan
                                </Badge>
                              ) : project.prodStatus === "DONE" ||
                                avgProgress === 100 ? (
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 font-bold text-[10px] flex items-center gap-1 w-fit"
                                >
                                  <CheckCircle2 className="w-3 h-3" /> Lolos QC
                                  (Selesai)
                                </Badge>
                              ) : avgProgress > 0 ||
                                project.prodStatus === "IN_PROGRESS" ? (
                                <Badge
                                  variant="outline"
                                  className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/50 font-bold text-[10px] flex items-center gap-1 w-fit"
                                >
                                  <Hammer className="w-3 h-3" /> Dalam Proses
                                  Produksi
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-200/50 font-bold text-[10px] flex items-center gap-1 w-fit"
                                >
                                  <Clock className="w-3 h-3" /> Persiapan
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* 7. Document Hub */}
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
                                "MECH_PART_LIST",
                                "PRODUCTION",
                                "QC",
                                "OTHER",
                              ]}
                              globalDriveUrl={project.globalDriveUrl}
                              onUploadSuccess={() => router.refresh()}
                              trigger={
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="relative h-8 px-3 gap-1.5 rounded-xl border-border bg-background hover:bg-muted font-bold text-xs"
                                >
                                  <FolderOpen className="w-4 h-4 text-orange-600" />
                                  <span>{project.documentCount || 0}</span>
                                  {project.hasRevisedDocs && (
                                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                    </span>
                                  )}
                                </Button>
                              }
                            />
                          </TableCell>

                          {/* 8. Aksi */}
                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-8 w-8 rounded-lg"
                                onClick={() => toggleRow(project.id)}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
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
                                <DropdownMenuContent
                                  align="end"
                                  className="w-52"
                                >
                                  <DropdownMenuItem
                                    className="text-xs font-semibold text-red-600 focus:text-red-600 focus:bg-red-50"
                                    onClick={() => {
                                      if (!expandedRows[project.id]) {
                                        toggleRow(project.id);
                                      }
                                    }}
                                  >
                                    <ShieldCheck className="w-4 h-4 mr-2 text-red-600" />
                                    Buka Pengujian QC & Revisi
                                  </DropdownMenuItem>

                                  <DropdownMenuSeparator />

                                  <DropdownMenuItem
                                    className="text-xs font-medium"
                                    onClick={() =>
                                      setViewDetailProject(project)
                                    }
                                  >
                                    <FileText className="w-4 h-4 mr-2" /> View
                                    Detail Proyek
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-xs font-medium"
                                    onClick={() => setHistoryProject(project)}
                                  >
                                    <History className="w-4 h-4 mr-2" /> View
                                    Logs
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
                                    <ArrowRight className="w-4 h-4 mr-2" />{" "}
                                    Serah Terima Logistik
                                  </DropdownMenuItem>

                                  <DropdownMenuSeparator />

                                  <DropdownMenuItem
                                    className={cn(
                                      "text-xs font-semibold text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20 cursor-pointer",
                                      (project.engStatus ===
                                        "REVISION_TO_ENG" ||
                                        project.currentDivision ===
                                          "LOGISTIC") &&
                                        "opacity-50 pointer-events-none",
                                    )}
                                    disabled={
                                      project.engStatus === "REVISION_TO_ENG" ||
                                      project.currentDivision === "LOGISTIC"
                                    }
                                    onClick={() => setRevisionProject(project)}
                                  >
                                    <AlertTriangle className="w-4 h-4 mr-2" />{" "}
                                    Minta Revisi Drawing
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expandable Section - 3 Tabs (Pengujian QC & Revisi, Log Riwayat QC, Shortcut Document Drawing) */}
                        {isExpanded && (
                          <TableRow className="bg-muted/10 border-t-0 hover:bg-muted/10">
                            <TableCell colSpan={8} className="p-0">
                              <div className="p-5 border-t border-border/40 bg-muted/15 animate-in fade-in duration-300 space-y-4">
                                <Tabs
                                  defaultValue="qc_manager"
                                  className="w-full"
                                >
                                  <TabsList className="bg-background border p-1 rounded-xl h-11 w-full max-w-2xl grid grid-cols-3 shadow-xs">
                                    <TabsTrigger
                                      value="qc_manager"
                                      className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                                    >
                                      <ShieldCheck className="w-4 h-4 text-red-500" />
                                      <span>1. Pengujian QC & Revisi</span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                      value="qc_logs"
                                      className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                                    >
                                      <History className="w-4 h-4" />
                                      <span>2. Log Riwayat QC</span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                      value="documents"
                                      className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                                    >
                                      <FolderOpen className="w-4 h-4" />
                                      <span>3. Dokumen</span>
                                    </TabsTrigger>
                                  </TabsList>

                                  {/* TAB 1: PENGUJIAN QC & NCR MANAGER */}
                                  <TabsContent
                                    value="qc_manager"
                                    className="mt-4 space-y-3"
                                  >
                                    <QCNCRManagerPanel
                                      projectId={project.id}
                                      projectName={project.projectName}
                                      projectNumber={
                                        project.projectNumber || "PRJ"
                                      }
                                    />
                                  </TabsContent>

                                  {/* TAB 2: LOG RIWAYAT QC */}
                                  <TabsContent
                                    value="qc_logs"
                                    className="mt-4 space-y-3 w-full max-w-full"
                                  >
                                    <div className="bg-card rounded-xl border border-border p-4 shadow-2xs space-y-3 w-full">
                                      <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                                        <History className="w-4 h-4 text-primary" />
                                        Log Riwayat Pengujian & Aktivitas QC
                                        Proyek
                                      </h4>

                                      <div className="max-h-72 overflow-y-auto overflow-x-hidden divide-y divide-border/40 rounded-lg border bg-muted/10">
                                        {(() => {
                                          const filteredQcHistory = (
                                            project.history || []
                                          ).filter((log: any) => {
                                            const div = (
                                              log.division || ""
                                            ).toUpperCase();
                                            const act = (
                                              log.action || ""
                                            ).toUpperCase();

                                            if (
                                              [
                                                "INVENTORY",
                                                "PPIC",
                                                "ENGINEERING",
                                                "PRODUCTION",
                                              ].includes(div)
                                            ) {
                                              return false;
                                            }

                                            return (
                                              div === "QUALITY_CONTROL" ||
                                              div === "QC" ||
                                              act.startsWith("QC_") ||
                                              act.startsWith("NCR_") ||
                                              act.startsWith(
                                                "DRAWING_REVISION_",
                                              )
                                            );
                                          });

                                          const hasQcLogs =
                                            project.qcLogs &&
                                            project.qcLogs.length > 0;

                                          if (
                                            filteredQcHistory.length === 0 &&
                                            !hasQcLogs
                                          ) {
                                            return (
                                              <p className="text-xs text-muted-foreground p-6 text-center">
                                                Belum ada log riwayat pengujian
                                                QC untuk proyek ini.
                                              </p>
                                            );
                                          }

                                          if (filteredQcHistory.length > 0) {
                                            return filteredQcHistory.map(
                                              (log: any) => (
                                                <div
                                                  key={log.id}
                                                  className="p-3 text-xs flex justify-between items-start gap-4 hover:bg-muted/20"
                                                >
                                                  <div className="min-w-0 flex-1 space-y-1 wrap-break-word [overflow-wrap:anywhere]">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                      <Badge
                                                        variant="outline"
                                                        className="text-[10px] font-bold bg-background shrink-0 text-amber-600 border-amber-300"
                                                      >
                                                        {log.division ||
                                                          "QUALITY_CONTROL"}
                                                      </Badge>
                                                      <span className="font-bold text-foreground">
                                                        {log.action ||
                                                          "QC Activity"}
                                                      </span>
                                                    </div>
                                                    <p className="text-muted-foreground text-xs leading-relaxed break-words whitespace-normal mt-1 [overflow-wrap:anywhere]">
                                                      {(log.notes || "")
                                                        .replace(
                                                          /\.?\s*Engineering KPI diselesaikan\.?/gi,
                                                          "",
                                                        )
                                                        .trim() || "-"}
                                                    </p>
                                                  </div>
                                                  <div className="text-right shrink-0 whitespace-nowrap pl-3 pr-1">
                                                    <p className="text-[11px] text-muted-foreground font-mono">
                                                      {new Date(
                                                        log.createdAt,
                                                      ).toLocaleString("id-ID")}
                                                    </p>
                                                    <p className="text-[10px] font-medium text-foreground">
                                                      {log.updatedBy || "-"}
                                                    </p>
                                                  </div>
                                                </div>
                                              ),
                                            );
                                          }

                                          return project.qcLogs?.map(
                                            (log: any, lIdx: number) => (
                                              <div
                                                key={log.id || lIdx}
                                                className="p-3 text-xs flex justify-between items-start gap-4 hover:bg-muted/20"
                                              >
                                                <div className="min-w-0 flex-1 space-y-1 break-words [overflow-wrap:anywhere]">
                                                  <p className="font-semibold text-foreground">
                                                    Tahap:{" "}
                                                    <span className="text-primary font-bold">
                                                      {log.stage?.name ||
                                                        "General QC"}
                                                    </span>{" "}
                                                    - Status:{" "}
                                                    <Badge
                                                      variant="outline"
                                                      className={cn(
                                                        "text-[10px] font-bold px-1.5 py-0.1 ml-1",
                                                        log.status ===
                                                          "APPROVED"
                                                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                                          : log.status ===
                                                              "REJECTED"
                                                            ? "bg-red-50 text-red-800 border-red-300 animate-pulse"
                                                            : "bg-amber-50 text-amber-800 border-amber-300",
                                                      )}
                                                    >
                                                      {log.status === "APPROVED"
                                                        ? "Lolos QC"
                                                        : log.status ===
                                                            "REJECTED"
                                                          ? "Revisi QC"
                                                          : "Menunggu QC"}
                                                    </Badge>
                                                  </p>
                                                  {log.notes && (
                                                    <p className="text-muted-foreground italic text-[11px] bg-muted/10 px-2 py-0.5 rounded-sm border border-border/20 mt-1 inline-block break-words [overflow-wrap:anywhere]">
                                                      Catatan: "{log.notes}"
                                                    </p>
                                                  )}
                                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                                    Pemeriksa:{" "}
                                                    <strong className="text-foreground/80">
                                                      {log.user || "-"}
                                                    </strong>
                                                  </p>
                                                </div>
                                                <span className="text-[10px] font-mono text-muted-foreground shrink-0 whitespace-nowrap pl-3 pr-1">
                                                  {format(
                                                    new Date(log.createdAt),
                                                    "dd MMM yy HH:mm",
                                                  )}
                                                </span>
                                              </div>
                                            ),
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  </TabsContent>

                                  {/* TAB 3: SHORTCUT DOCUMENT DRAWING & DOCUMENT HUB */}
                                  <TabsContent
                                    value="documents"
                                    className="mt-4 space-y-4"
                                  >
                                    {/* Header Bar with Document Hub Access Button */}
                                    <div className="bg-card rounded-2xl border border-border/60 p-4 shadow-xs space-y-3">
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div>
                                          <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                                            <FolderOpen className="w-4 h-4 text-primary" />
                                            Shortcut Dokumen & Document Hub
                                          </h4>
                                          <p className="text-xs text-muted-foreground mt-0.5">
                                            Akses cepat ke arsip gambar kerja
                                            (Engineering) dan dokumen QC proyek
                                            ini.
                                          </p>
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                                          <DocumentManagerDialog
                                            ownerId={project.id}
                                            ownerType="PROJECT"
                                            leadId={project.leadId}
                                            categories={[
                                              "DRAWING",
                                              "MECH_PART_LIST",
                                              "PRODUCTION",
                                              "QC",
                                            ]}
                                            globalDriveUrl={
                                              project.globalDriveUrl
                                            }
                                            onUploadSuccess={() =>
                                              router.refresh()
                                            }
                                            trigger={
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-9 px-3.5 text-xs font-semibold rounded-xl border-primary/30 text-primary hover:bg-primary/10 cursor-pointer gap-2"
                                              >
                                                <FolderOpen className="w-4 h-4 text-primary" />
                                                <span>Buka Document Hub</span>
                                              </Button>
                                            }
                                          />

                                          {project.globalDriveUrl && (
                                            <a
                                              href={project.globalDriveUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 text-foreground transition-all"
                                            >
                                              <span>Google Drive ↗</span>
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Drawing & Mechanical Part List Cards */}
                                    {(() => {
                                      const allProjectDocs = [
                                        ...((project.documents as any[]) || []),
                                        ...((project.lead as any)?.documents ||
                                          []),
                                      ];

                                      const drawingDocsMap = new Map();
                                      allProjectDocs.forEach((d: any) => {
                                        const cat = (
                                          d.category || ""
                                        ).toUpperCase();
                                        if (
                                          (cat === "DRAWING" ||
                                            cat === "DRAWINGS") &&
                                          !drawingDocsMap.has(d.id)
                                        ) {
                                          drawingDocsMap.set(d.id, d);
                                        }
                                      });
                                      const drawingDocs = Array.from(
                                        drawingDocsMap.values(),
                                      );

                                      const mechDocsMap = new Map();
                                      allProjectDocs.forEach((d: any) => {
                                        const cat = (
                                          d.category || ""
                                        ).toUpperCase();
                                        if (
                                          (cat === "MECH_PART_LIST" ||
                                            cat === "MECHANICAL_PART_LIST" ||
                                            cat === "MECH_PART" ||
                                            cat === "PART_LIST" ||
                                            cat === "MECHANICAL") &&
                                          !mechDocsMap.has(d.id)
                                        ) {
                                          mechDocsMap.set(d.id, d);
                                        }
                                      });
                                      const mechDocs = Array.from(
                                        mechDocsMap.values(),
                                      );

                                      return (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start w-full">
                                          {/* Card 1: Drawing (Gambar Kerja) */}
                                          <div className="bg-card rounded-2xl border border-border/60 p-4 sm:p-5 shadow-xs flex flex-col space-y-3">
                                            {/* Header */}
                                            <div className="flex items-center justify-between border-b border-border/40 pb-3">
                                              <h4 className="font-bold text-sm sm:text-base text-primary">
                                                Dokumen Drawing
                                              </h4>
                                              <Badge
                                                variant="secondary"
                                                className="font-bold text-xs px-3 py-1 rounded-full border border-border/40 bg-muted/60 text-foreground shrink-0"
                                              >
                                                {drawingDocs.length} Berkas
                                              </Badge>
                                            </div>

                                            {/* Scrollable File List Container */}
                                            <div className="max-h-72 overflow-y-auto pr-1">
                                              {drawingDocs.length === 0 ? (
                                                <div className="py-8 text-center text-xs text-muted-foreground italic">
                                                  Belum ada berkas drawing
                                                  (gambar kerja) yang diupload
                                                  untuk proyek ini.
                                                </div>
                                              ) : (
                                                <div className="divide-y divide-border/30">
                                                  {drawingDocs.map(
                                                    (
                                                      doc: any,
                                                      docIdx: number,
                                                    ) => (
                                                      <div
                                                        key={doc.id || docIdx}
                                                        className="py-2 flex items-center justify-between gap-3 group"
                                                      >
                                                        <div
                                                          className="min-w-0 flex-1 space-y-0.5 cursor-pointer"
                                                          onClick={() =>
                                                            handleViewDocument(
                                                              doc,
                                                            )
                                                          }
                                                        >
                                                          <p className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                                                            {docIdx + 1}.{" "}
                                                            {doc.name ||
                                                              doc.fileName ||
                                                              "Drawing File"}
                                                          </p>
                                                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                                                            <Badge
                                                              variant="outline"
                                                              className="text-[9px] font-bold text-amber-600 bg-amber-500/10 border-amber-300 px-1 py-0 rounded h-4"
                                                            >
                                                              V
                                                              {doc.version || 1}
                                                            </Badge>
                                                            <span>•</span>
                                                            <span>
                                                              Oleh:{" "}
                                                              <strong className="font-medium text-foreground/80">
                                                                {doc.uploadedBy ||
                                                                  doc.createdBy ||
                                                                  "Super Admin"}
                                                              </strong>
                                                            </span>
                                                          </div>
                                                        </div>

                                                        <Button
                                                          type="button"
                                                          variant="outline"
                                                          size="icon"
                                                          onClick={() =>
                                                            handleViewDocument(
                                                              doc,
                                                            )
                                                          }
                                                          className="h-7 w-7 rounded-full border-primary/40 text-primary hover:bg-primary/10 cursor-pointer shrink-0 transition-all"
                                                          title="Lihat Gambar Kerja"
                                                        >
                                                          <Eye className="w-3.5 h-3.5 text-primary" />
                                                        </Button>
                                                      </div>
                                                    ),
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          {/* Card 2: Mechanical Part List */}
                                          <div className="bg-card rounded-2xl border border-border/60 p-4 sm:p-5 shadow-xs flex flex-col space-y-3">
                                            {/* Header */}
                                            <div className="flex items-center justify-between border-b border-border/40 pb-3">
                                              <h4 className="font-bold text-sm sm:text-base text-amber-600">
                                                Dokumen Mechanical Part List
                                              </h4>
                                              <Badge
                                                variant="secondary"
                                                className="font-bold text-xs px-3 py-1 rounded-full border border-border/40 bg-muted/60 text-foreground shrink-0"
                                              >
                                                {mechDocs.length} Berkas
                                              </Badge>
                                            </div>

                                            {/* Scrollable File List Container */}
                                            <div className="max-h-72 overflow-y-auto pr-1">
                                              {mechDocs.length === 0 ? (
                                                <div className="py-8 text-center text-xs text-muted-foreground italic">
                                                  Belum ada berkas Mechanical
                                                  Part List yang diupload untuk
                                                  proyek ini.
                                                </div>
                                              ) : (
                                                <div className="divide-y divide-border/30">
                                                  {mechDocs.map(
                                                    (
                                                      doc: any,
                                                      docIdx: number,
                                                    ) => (
                                                      <div
                                                        key={doc.id || docIdx}
                                                        className="py-2 flex items-center justify-between gap-3 group"
                                                      >
                                                        <div
                                                          className="min-w-0 flex-1 space-y-0.5 cursor-pointer"
                                                          onClick={() =>
                                                            handleViewDocument(
                                                              doc,
                                                            )
                                                          }
                                                        >
                                                          <p className="font-semibold text-xs text-foreground group-hover:text-amber-600 transition-colors truncate">
                                                            {docIdx + 1}.{" "}
                                                            {doc.name ||
                                                              doc.fileName ||
                                                              "Mechanical Part List File"}
                                                          </p>
                                                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                                                            <Badge
                                                              variant="outline"
                                                              className="text-[9px] font-bold text-amber-600 bg-amber-500/10 border-amber-300 px-1 py-0 rounded h-4"
                                                            >
                                                              V
                                                              {doc.version || 1}
                                                            </Badge>
                                                            <span>•</span>
                                                            <span>
                                                              Oleh:{" "}
                                                              <strong className="font-medium text-foreground/80">
                                                                {doc.uploadedBy ||
                                                                  doc.createdBy ||
                                                                  "Super Admin"}
                                                              </strong>
                                                            </span>
                                                          </div>
                                                        </div>

                                                        <Button
                                                          type="button"
                                                          variant="outline"
                                                          size="icon"
                                                          onClick={() =>
                                                            handleViewDocument(
                                                              doc,
                                                            )
                                                          }
                                                          className="h-7 w-7 rounded-full border-amber-500/40 text-amber-600 hover:bg-amber-500/10 cursor-pointer shrink-0 transition-all"
                                                          title="Lihat Mechanical Part List"
                                                        >
                                                          <Eye className="w-3.5 h-3.5 text-amber-600" />
                                                        </Button>
                                                      </div>
                                                    ),
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </TabsContent>
                                </Tabs>
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
            <DialogContent className="sm:max-w-125">
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
                              style={{
                                width: `${qcModalData.stage.progress}%`,
                              }}
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
                                {(cStage.assignedLeader ||
                                  cStage.assignedTeam) && (
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
            <DialogContent className="sm:max-w-120 w-full">
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
                    {confirmHandoverProject?.productionStages?.map(
                      (stage: any) => {
                        // Check if stage is already handed over
                        const handedOverStages = new Set(
                          (confirmHandoverProject.handovers || []).flatMap(
                            (h: any) =>
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
                                      prev.filter(
                                        (name) => name !== stage.name,
                                      ),
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
                      },
                    )}
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
                    className="text-xs min-h-20 resize-y"
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
                  {isPending && (
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  )}
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
            <DialogContent className="sm:max-w-120 w-full">
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
                    className="text-xs min-h-20 resize-y"
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
                  {isPending && (
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  )}
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
            <DialogContent className="sm:max-w-106.25">
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
                  . Proyek akan ditandai sedang revisi, namun tetap dapat
                  diakses di dashboard ini.
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
                    className="min-h-25 text-xs resize-y"
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
            <DialogContent className="sm:max-w-106.25">
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
                  <Label
                    htmlFor="compQCNotes"
                    className="text-xs font-semibold"
                  >
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

          {ncrProject && (
            <NCRManagerDialog
              isOpen={!!ncrProject}
              onOpenChange={(open) => !open && setNcrProject(null)}
              projectId={ncrProject.id}
              projectName={ncrProject.projectName || ncrProject.name}
              projectNumber={
                ncrProject.projectNumber || ncrProject.code || "PRJ"
              }
            />
          )}
        </TabsContent>

        {/* Tab 2: QC Penerimaan Barang PO (Gudang) */}
        <TabsContent value="po_receipts" className="space-y-3 pt-1">
          {/* Top Bar: Search Bar (Pojok Kiri) & Filter Badges (Pojok Kanan) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Bar (Pojok Kiri) */}
            <div className="relative w-full sm:w-72 shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari No. PO, Supplier, Proyek..."
                value={poSearchQuery}
                onChange={(e) => setPoSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs rounded-xl bg-card border-border/80 focus-visible:ring-indigo-500 shadow-2xs"
              />
              {poSearchQuery && (
                <button
                  type="button"
                  onClick={() => setPoSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Badges (Kanan) */}
            <div className="flex items-center gap-1.5 flex-wrap justify-start sm:justify-end">
              {[
                { id: "ALL", label: "Semua" },
                { id: "PENDING_INSPECTION", label: "Menunggu QC" },
                { id: "APPROVED", label: "Approved (Lolos)" },
                { id: "PARTIAL", label: "Partial (Sebagian)" },
                { id: "REJECTED", label: "Rejected (Ditolak)" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPoFilterStatus(f.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                    poFilterStatus === f.id
                      ? "bg-primary text-primary-foreground border-primary font-bold shadow-2xs"
                      : "bg-card hover:bg-muted/70 text-muted-foreground border-border/60",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pagination Controls Di Atas Tabel */}
          <div className="flex flex-row items-center justify-between text-sm py-1 border-b border-border/40 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-xs whitespace-nowrap text-muted-foreground">
                Tampilkan:
              </span>
              <select
                value={poLimit}
                onChange={(e) => {
                  setPoLimit(Number(e.target.value));
                  setPoPage(1);
                }}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer text-foreground font-semibold"
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
                className="h-8 w-8 p-0 cursor-pointer rounded-lg border-border hover:bg-muted"
                onClick={() => setPoPage((prev) => Math.max(1, prev - 1))}
                disabled={poPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-muted-foreground mx-2 text-xs font-semibold">
                Halaman{" "}
                <span className="font-semibold text-muted-foreground">
                  {poPage}
                </span>{" "}
                dari{" "}
                <span className="font-semibold text-muted-foreground">
                  {totalPoPages}
                </span>
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 cursor-pointer rounded-lg border-border hover:bg-muted"
                onClick={() =>
                  setPoPage((prev) => Math.min(totalPoPages, prev + 1))
                }
                disabled={poPage >= totalPoPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* PO Receipts Table / List */}
          {filteredPOReceipts.length === 0 ? (
            <div className="border border-dashed border-border rounded-2xl p-8 text-center bg-card space-y-2">
              <PackageCheck className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-semibold text-foreground">
                Tidak ada pengajuan pengecekan QC barang PO
              </p>
              <p className="text-xs text-muted-foreground">
                Belum ada pengajuan pengujian QC PO dari sistem gudang dengan filter ini.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile View: Clean Touch Cards (sm:hidden) */}
              <div className="block sm:hidden space-y-3">
                {paginatedPOReceipts.map((po: any, idx: number) => {
                  const rowNumber = (poPage - 1) * poLimit + idx + 1;
                  const status = po.qcStatus || "NONE";
                  let statusBadge = null;
                  if (status === "APPROVED") {
                    statusBadge = (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-400 font-bold text-[10px] px-2 py-0.5">
                        <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> QC APPROVED
                      </Badge>
                    );
                  } else if (status === "PARTIAL") {
                    statusBadge = (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-400 font-bold text-[10px] px-2 py-0.5">
                        <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" /> QC PARTIAL
                      </Badge>
                    );
                  } else if (status === "REJECTED") {
                    statusBadge = (
                      <Badge variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-400 font-bold text-[10px] px-2 py-0.5">
                        <XCircle className="w-3 h-3 mr-1 text-rose-600" /> QC REJECTED
                      </Badge>
                    );
                  } else {
                    statusBadge = (
                      <Badge variant="outline" className="bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-400 font-bold text-[10px] px-2 py-0.5 animate-pulse">
                        <Clock className="w-3 h-3 mr-1 text-amber-600" /> PENDING INSPECTION
                      </Badge>
                    );
                  }

                  return (
                    <div key={po.id} className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-2xs space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-mono text-muted-foreground font-semibold">#{rowNumber}</div>
                          <div className="font-bold text-xs text-primary flex items-center gap-1.5 mt-0.5">
                            <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span>{po.nomorPO}</span>
                          </div>
                        </div>
                        {statusBadge}
                      </div>

                      <div className="text-xs space-y-1 bg-muted/30 p-2.5 rounded-xl border border-border/40">
                        <div className="flex justify-between"><span className="text-muted-foreground">Supplier:</span> <strong className="text-foreground">{po.kepada || "-"}</strong></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Proyek:</span> <strong className="text-foreground">{po.projek || "Gudang"}</strong></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Pemohon:</span> <span className="text-foreground font-medium">{po.user?.name || "Staf Gudang"} ({formatJakartaDate(po.qcRequestedAt || po.createdAt, "date")})</span></div>
                        <div className="flex justify-between border-t border-border/30 pt-1 mt-1"><span className="text-muted-foreground">Jumlah Barang:</span> <strong className="text-indigo-600 font-bold">{po.items?.length || 0} Item</strong></div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          setInspectReceipt(po);
                          setIsReceiptDialogOpen(true);
                        }}
                        className="w-full h-8.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer shadow-2xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                        Inspeksi QC PO
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Desktop View Table (hidden sm:block) */}
              <div className="hidden sm:block border border-border rounded-xl bg-card overflow-hidden shadow-2xs">
                <Table>
                  <TableHeader className="bg-muted/20 border-b">
                    <TableRow className="border-border hover:bg-transparent text-xs font-bold">
                      <TableHead className="w-12 text-center">No.</TableHead>
                      <TableHead>Nomor PO</TableHead>
                      <TableHead>Supplier & Proyek</TableHead>
                      <TableHead>Pemohon / Tanggal</TableHead>
                      <TableHead className="text-center">Jumlah Item</TableHead>
                      <TableHead className="text-center">
                        Status QC Kedatangan
                      </TableHead>
                      <TableHead className="text-right w-36">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPOReceipts.map((po: any, idx: number) => {
                      const rowNumber = (poPage - 1) * poLimit + idx + 1;
                      const status = po.qcStatus || "NONE";
                      let statusBadge = null;
                      if (status === "APPROVED") {
                        statusBadge = (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-400 font-bold text-[10px] px-2 py-0.5"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />{" "}
                            QC APPROVED
                          </Badge>
                        );
                      } else if (status === "PARTIAL") {
                        statusBadge = (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-400 font-bold text-[10px] px-2 py-0.5"
                          >
                            <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />{" "}
                            QC PARTIAL
                          </Badge>
                        );
                      } else if (status === "REJECTED") {
                        statusBadge = (
                          <Badge
                            variant="outline"
                            className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-400 font-bold text-[10px] px-2 py-0.5"
                          >
                            <XCircle className="w-3 h-3 mr-1 text-rose-600" /> QC
                            REJECTED
                          </Badge>
                        );
                      } else {
                        statusBadge = (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-400 font-bold text-[10px] px-2 py-0.5 animate-pulse"
                          >
                            <Clock className="w-3 h-3 mr-1 text-amber-600" />{" "}
                            PENDING INSPECTION
                          </Badge>
                        );
                      }

                      return (
                        <TableRow
                          key={po.id}
                          className="border-border/40 hover:bg-muted/20 transition-colors"
                        >
                          <TableCell className="text-center text-xs font-mono text-muted-foreground">
                            {rowNumber}
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-col gap-0.5 text-xs">
                              <span className="font-bold text-foreground flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                PO: {po.nomorPO}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-col gap-0.5 text-xs">
                              <span className="font-semibold text-foreground">
                                {po.kepada || "-"}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {po.projek || "Persediaan Gudang"}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-col gap-0.5 text-xs">
                              <span className="font-medium text-foreground">
                                {po.user?.name || "Staf Gudang"}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {formatJakartaDate(
                                  po.qcRequestedAt || po.createdAt,
                                  "date",
                                )}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-bold"
                              >
                                {po.items?.length || 0} Item
                              </Badge>
                              {po.items && po.items.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap justify-center text-[9px]">
                                  {po.items.filter((i: any) => i.qcStatus === 'PASSED' || (Number(i.qtyPassed) || 0) > 0).length > 0 && (
                                    <span className="px-1.5 py-0.2 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold rounded-md">
                                      {po.items.filter((i: any) => i.qcStatus === 'PASSED' || (Number(i.qtyPassed) || 0) > 0).length} Lolos
                                    </span>
                                  )}
                                  {po.items.filter((i: any) => i.qcStatus === 'FAILED' || (Number(i.qtyFailed) || 0) > 0).length > 0 && (
                                    <span className="px-1.5 py-0.2 bg-rose-500/15 text-rose-800 dark:text-rose-300 font-bold rounded-md">
                                      {po.items.filter((i: any) => i.qcStatus === 'FAILED' || (Number(i.qtyFailed) || 0) > 0).length} Reject
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            {statusBadge}
                            {po.qcApprovedBy && (
                              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                By: {po.qcApprovedBy}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => {
                                setInspectReceipt(po);
                                setIsReceiptDialogOpen(true);
                              }}
                              className="rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer h-8 px-2.5 shadow-2xs"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                              Inspeksi QC
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* QC Receipt Dialog */}
      <QCReceiptDialog
        open={isReceiptDialogOpen}
        onOpenChange={setIsReceiptDialogOpen}
        purchaseOrder={inspectReceipt}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
