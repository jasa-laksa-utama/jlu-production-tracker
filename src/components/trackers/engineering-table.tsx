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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatJakartaDate } from "@/lib/date-utils";
import {
  MoreHorizontal,
  PenTool,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowRight,
  Loader2,
  Calendar,
  Search,
  Filter,
  ChevronDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  Link as LinkIcon,
  FolderOpen,
  Trash2,
  History,
  AlertTriangle,
  MessageSquare,
  RefreshCw,
  PauseCircle,
  Settings,
  FileCog,
  Scale,
  Edit3,
} from "lucide-react";
import { updateProjectEstimatedTonnage } from "@/app/actions/project-tonnage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format, differenceInDays } from "date-fns";
import {
  updateProjectDivisionStatus,
  completeDrawingRevision,
} from "@/app/actions/projects";
import { toast } from "sonner";
import { formatRupiah, cn } from "@/lib/utils";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { DateRangePicker } from "@/components/leads/date-range-picker";
import { DateRange } from "react-day-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { DocumentManagerDialog } from "@/components/document-manager-dialog";
import { ProjectDetailDialog } from "@/components/project-detail-dialog";
import { ProjectHistoryDialog } from "@/components/project-history-dialog";
import { BoQManagerDialog } from "@/components/trackers/boq-manager-dialog";
import { calculateEngineeringProgress } from "@/lib/engineering-progress";
import { SPBSubstitutionCard } from "@/components/trackers/spb-substitution-card";
import {
  DRManagerDialog,
  getProjectDRs,
} from "@/components/trackers/dr-manager-dialog";

const ENGINEERING_STATUSES = [
  {
    id: "IN_PROGRESS",
    label: "In Progress",
    color: "bg-blue-500/10 text-blue-600 border-blue-200",
  },
  {
    id: "REVISION",
    label: "Revision",
    color: "bg-red-500/10 text-red-600 border-red-200",
  },
  {
    id: "REVIEW",
    label: "Review",
    color: "bg-orange-500/10 text-orange-600 border-orange-200",
  },
  {
    id: "APPROVED_BY_PPIC",
    label: "Approved",
    color: "bg-green-500/10 text-green-600 border-green-200",
  },
  {
    id: "REVISION_TO_ENG",
    label: "Revisi Drawing",
    color:
      "bg-rose-500/10 text-rose-600 border-rose-200 font-bold animate-pulse",
  },
];

const getProjectStatusColor = (status: string) => {
  const s = status ? status.toUpperCase() : "";
  switch (s) {
    case "PENDING":
    case "REVIEW":
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

export function EngineeringTable({
  projects,
  meta,
  pendingSubstitutions = [],
}: {
  projects: any[];
  meta?: { totalPages: number; totalCount: number; currentPage: number };
  pendingSubstitutions?: any[];
}) {
  const [isPending, startTransition] = useTransition();
  const [viewDetailProject, setViewDetailProject] = useState<any | null>(null);
  const [confirmStatusProject, setConfirmStatusProject] = useState<{
    project: any;
    status: string;
    division?: string;
  } | null>(null);
  const [docHubProject, setDocHubProject] = useState<any | null>(null);
  const [historyProject, setHistoryProject] = useState<any | null>(null);
  const [ppicNotesProject, setPpicNotesProject] = useState<any | null>(null);
  const [resolveRevisionProject, setResolveRevisionProject] = useState<
    any | null
  >(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [isResolving, startResolveTransition] = useTransition();
  const [boqManagerProject, setBoqManagerProject] = useState<any | null>(null);
  const [drManagerProject, setDrManagerProject] = useState<any | null>(null);
  const [editTonnageProject, setEditTonnageProject] = useState<any | null>(
    null,
  );
  const [newTonnageInput, setNewTonnageInput] = useState<string>("");
  const [isUpdatingTonnage, setIsUpdatingTonnage] = useState(false);

  const handleSaveTonnage = async () => {
    if (!editTonnageProject) return;
    setIsUpdatingTonnage(true);
    const toastId = toast.loading("Memperbarui Estimasi Tonase Proyek...");
    const val = Number(newTonnageInput) || 0;
    const res = await updateProjectEstimatedTonnage(editTonnageProject.id, val);
    setIsUpdatingTonnage(false);
    if (res.success) {
      toast.success(res.message, { id: toastId });
      editTonnageProject.estimatedTonnage = val;
      if (editTonnageProject.lead) {
        editTonnageProject.lead.estimatedTonnage = val;
      }
      setEditTonnageProject(null);
      router.refresh();
    } else {
      toast.error(res.error || "Gagal memperbarui tonase", { id: toastId });
    }
  };

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Extraction from searchParams
  const currentPage = Number(searchParams.get("page")) || 1;
  const currentLimit = Number(searchParams.get("limit")) || 10;
  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "ALL";
  const currentStart = searchParams.get("start") || "";
  const currentEnd = searchParams.get("end") || "";
  const currentSort = searchParams.get("sort") || "desc";

  // For controlled search input
  const [searchInput, setSearchInput] = useState(currentSearch);

  // Substitution tab search & pagination state
  const [subSearchQuery, setSubSearchQuery] = useState("");
  const [subCurrentPage, setSubCurrentPage] = useState(1);
  const subPageSize = 10;

  const filteredSubstitutions = pendingSubstitutions.filter((item: any) => {
    const q = subSearchQuery.toLowerCase().trim();
    if (!q) return true;
    const spbNum = (item.spb?.spbNumber || "").toLowerCase();
    const projName = (item.spb?.project?.projectName || "").toLowerCase();
    const custName = (item.spb?.project?.customer?.name || "").toLowerCase();
    const compName = (item.spb?.project?.customer?.company || "").toLowerCase();
    const origName = (item.originalName || item.name || "").toLowerCase();
    const subName = (item.substitutedName || "").toLowerCase();

    return (
      spbNum.includes(q) ||
      projName.includes(q) ||
      custName.includes(q) ||
      compName.includes(q) ||
      origName.includes(q) ||
      subName.includes(q)
    );
  });

  const totalSubItems = filteredSubstitutions.length;
  const totalSubPages = Math.ceil(totalSubItems / subPageSize) || 1;
  const paginatedSubstitutions = filteredSubstitutions.slice(
    (subCurrentPage - 1) * subPageSize,
    subCurrentPage * subPageSize,
  );

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: currentStart ? new Date(currentStart) : undefined,
    to: currentEnd ? new Date(currentEnd) : undefined,
  });

  const totalPages = meta?.totalPages || 1;
  const pageSize = currentLimit;

  function updateQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    // Reset page to 1 when changing filters, unless explicitly setting page
    if (!updates.page && updates.page !== null) {
      params.set("page", "1");
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== currentSearch) {
        updateQuery({ search: searchInput || null });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleStatusUpdate = async (
    projectId: string,
    status: string,
    division: string = "ENGINEERING",
  ) => {
    startTransition(async () => {
      const result = await updateProjectDivisionStatus(
        projectId,
        division,
        status,
        division !== "ENGINEERING"
          ? `Handover to ${division} - Status: ${status}`
          : `Status updated to ${status}`,
      );
      if (result.success) {
        toast.success(
          division !== "ENGINEERING"
            ? `Project handed over to ${division}`
            : `Project status updated to ${status}`,
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleResolveRevisionSubmit = async () => {
    if (!resolveRevisionProject) return;
    startResolveTransition(async () => {
      const res = await completeDrawingRevision(
        resolveRevisionProject.id,
        resolveNotes,
      );
      if (res.success) {
        toast.success(
          `Revisi drawing untuk proyek ${resolveRevisionProject.projectName} berhasil diselesaikan.`,
        );
        setResolveRevisionProject(null);
        setResolveNotes("");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menyelesaikan revisi drawing.");
      }
    });
  };

  const getTimelineStatus = (expectedDate: string | null) => {
    if (!expectedDate) return null;
    const deadline = new Date(expectedDate);
    const today = new Date();
    const diff = differenceInDays(deadline, today);

    if (diff < 0) {
      return (
        <Badge
          variant="outline"
          className="bg-red-500/10 text-red-600 border-red-200 flex items-center gap-1 font-bold text-[10px]"
        >
          <AlertCircle className="w-3 h-3" />
          Delayed ({Math.abs(diff)} days)
        </Badge>
      );
    } else if (diff <= 7) {
      return (
        <Badge
          variant="outline"
          className="bg-orange-500/10 text-orange-600 border-orange-200 flex items-center gap-1 font-bold text-[10px]"
        >
          <Clock className="w-3 h-3" />
          Due ({diff} days)
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="bg-green-500/10 text-green-600 border-green-200 flex items-center gap-1 font-bold text-[10px]"
      >
        <CheckCircle2 className="w-3 h-3" />
        {diff} days left
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search project or customer..."
              className="pl-9 h-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <Popover>
            <PopoverTrigger className="h-9 px-3 gap-2 inline-flex items-center justify-center rounded-md border text-sm font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none transition-all active:scale-95 border-dashed">
              <Filter className="w-4 h-4" />
              Filter
              {(currentStart || currentSort !== "desc") && (
                <Badge
                  variant="secondary"
                  className="ml-1 px-1 h-5 min-w-5 justify-center rounded-full bg-primary text-primary-foreground"
                >
                  !
                </Badge>
              )}
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 space-y-4" align="start">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Date Range
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

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Sorting
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between h-9 cursor-pointer"
                  onClick={() =>
                    updateQuery({
                      sort: currentSort === "asc" ? "desc" : "asc",
                    })
                  }
                >
                  <span className="flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4" />
                    {currentSort === "desc" ? "Newest First" : "Oldest First"}
                  </span>
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs hover:bg-primary/90 bg-primary text-primary-foreground hover:text-primary-foreground h-8 cursor-pointer"
                onClick={() => {
                  setSearchInput("");
                  setDateRange(undefined);
                  updateQuery({
                    status: null,
                    sort: "desc",
                    search: "",
                    start: null,
                    end: null,
                  });
                }}
              >
                Reset Filters
              </Button>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-2 text-muted-foreground ml-1">
            <span className="text-xs">
              Results:{" "}
              <span className="font-semibold">{meta?.totalCount || 0}</span>{" "}
              projects
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-row items-center justify-between text-sm py-1 border-b border-border/40 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-xs whitespace-nowrap">Show:</span>
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
            className="h-8 w-8 p-0"
            onClick={() => updateQuery({ page: String(currentPage - 1) })}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-muted-foreground mx-1 text-xs">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => updateQuery({ page: String(currentPage + 1) })}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <div className="border border-border rounded-xl bg-card overflow-hidden relative shadow-sm">
        {isPending && (
          <div className="absolute inset-0 z-10 bg-background/40 backdrop-blur-[1px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}
        <Table>
          <TableHeader className="bg-muted/20 border-b">
            <TableRow className="border-border hover:bg-transparent text-sm font-bold">
              <TableHead className="w-12 text-center">No.</TableHead>
              <TableHead className="min-w-50">Project & Customer</TableHead>
              <TableHead className="w-36">Start Date</TableHead>
              <TableHead className="w-36">Deadline</TableHead>
              <TableHead className="min-w-44">Engineering Progress</TableHead>
              <TableHead className="min-w-44">Production Status</TableHead>
              <TableHead className="text-center min-w-44">
                Engineering Document
              </TableHead>
              <TableHead className="text-right w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center h-48 text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2 opacity-30">
                    <PenTool className="w-8 h-8" />
                    <p className="text-sm font-medium">No projects found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project, index) => {
                const dealDate =
                  project.dealAt || project.startDate || project.createdAt;
                const daysSinceDeal = dealDate
                  ? differenceInDays(new Date(), new Date(dealDate))
                  : 0;

                const engCalc = calculateEngineeringProgress(project);

                const projDocs = [
                  ...(project?.documents || []),
                  ...(project?.lead?.documents || []),
                ];
                const docsMap = new Map();
                projDocs.forEach((d: any) => {
                  if (!d) return;
                  const key =
                    d.id ||
                    `${d.category}_${d.fileName || d.name}_${d.version}`;
                  if (!docsMap.has(key)) docsMap.set(key, d);
                });
                const uniqueProjDocs = Array.from(docsMap.values());

                const totalDocCount = uniqueProjDocs.filter(
                  (d: any) => d.category !== "PO" && d.category !== "OFFERING",
                ).length;

                const partListCount = uniqueProjDocs.filter((d: any) => {
                  const cat = (d.category || "").toUpperCase();
                  const label = (d.label || "").toUpperCase();
                  const name = (d.fileName || d.name || "").toUpperCase();
                  return (
                    cat.includes("PART_LIST") ||
                    cat.includes("MECH_PART_LIST") ||
                    label.includes("PART LIST") ||
                    label.includes("PART_LIST") ||
                    name.includes("PART LIST") ||
                    name.includes("PART_LIST") ||
                    name.includes("PARTLIST")
                  );
                }).length;

                const assemblyListCount = uniqueProjDocs.filter((d: any) => {
                  const cat = (d.category || "").toUpperCase();
                  const label = (d.label || "").toUpperCase();
                  const name = (d.fileName || d.name || "").toUpperCase();
                  return (
                    cat.includes("ASSEMBLY") ||
                    label.includes("ASSEMBLY") ||
                    name.includes("ASSEMBLY")
                  );
                }).length;

                const ppicNotes = (project.history || []).filter(
                  (h: any) =>
                    h.action === "Catatan dari PPIC" ||
                    (h.notes || "").includes("PPIC"),
                );

                return (
                  <TableRow
                    key={project.id}
                    className="border-border/40 hover:bg-muted/20 transition-colors group"
                  >
                    <TableCell className="text-center text-muted-foreground text-sm font-mono">
                      {(currentPage - 1) * pageSize + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        {project.projectNumber && (
                          <span className="text-xs text-primary font-semibold">
                            {project.projectNumber}
                          </span>
                        )}
                        <span className="font-bold text-sm tracking-tight group-hover:text-primary transition-colors">
                          {project.projectName}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
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
                    {/* Tanggal Deal & Running (Gabung 1 Kolom) */}
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                        <div className="flex items-center gap-1.5 text-foreground font-semibold">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            {dealDate
                              ? formatJakartaDate(dealDate, "date")
                              : "-"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-primary">
                            {daysSinceDeal} Hari
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Deadline */}
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5 opacity-60 shrink-0" />
                          <span>
                            {project.expectedDate
                              ? formatJakartaDate(project.expectedDate, "date")
                              : "No Date"}
                          </span>
                        </div>
                        {getTimelineStatus(project.expectedDate)}
                      </div>
                    </TableCell>

                    {/* Engineering Progress */}
                    <TableCell>
                      <div className="flex flex-col gap-1.5 min-w-44 max-w-52">
                        {/* Progress Eng */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-muted-foreground">
                              Progress Eng.
                            </span>
                            <span className="text-primary font-bold">
                              {engCalc.engProgress}%
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden border border-border/20">
                            <div
                              className={cn(
                                "h-full transition-all duration-300",
                                engCalc.engProgress === 100
                                  ? "bg-emerald-500"
                                  : engCalc.engProgress > 0
                                    ? "bg-primary"
                                    : "bg-muted-foreground/30",
                              )}
                              style={{ width: `${engCalc.engProgress}%` }}
                            />
                          </div>

                          {/* Widget Estimasi Tonase */}
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditTonnageProject(project);
                                setNewTonnageInput(
                                  String(
                                    project.estimatedTonnage ||
                                      project.lead?.estimatedTonnage ||
                                      engCalc.estimatedTonnage ||
                                      0,
                                  ),
                                );
                              }}
                              className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer text-[10px] font-semibold bg-muted/60 px-1.5 py-0.5 rounded border border-border/40"
                              title="Klik untuk mengubah Estimasi Total Tonase Proyek"
                            >
                              <Scale className="w-3 h-3 text-primary shrink-0" />
                              <span>
                                {Number(
                                  project.estimatedTonnage ||
                                    project.lead?.estimatedTonnage ||
                                    engCalc.estimatedTonnage ||
                                    0,
                                ) > 0
                                  ? `Estimasi: ${
                                      project.estimatedTonnage ||
                                      project.lead?.estimatedTonnage ||
                                      engCalc.estimatedTonnage
                                    } Ton`
                                  : "Set Estimasi Tonase"}
                              </span>
                              <Edit3 className="w-2.5 h-2.5 opacity-60 ml-0.5 shrink-0" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Production Status & Request Revisi Drawing */}
                    <TableCell>
                      <div className="flex flex-col gap-1.5 min-w-44 max-w-52">
                        {/* Progress Produksi */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-muted-foreground">
                              Progress Prod.
                            </span>
                            <span
                              className={cn(
                                "font-bold",
                                (() => {
                                  const pProg = (() => {
                                    if (
                                      project.masterplan?.phases &&
                                      project.masterplan.phases.length > 0
                                    ) {
                                      return Math.round(
                                        project.masterplan.phases.reduce(
                                          (sum: number, phase: any) => {
                                            const weight = Number(
                                              phase.weightPercent || 0,
                                            );
                                            const progress = Number(
                                              phase.actualProgress || 0,
                                            );
                                            return (
                                              sum + (progress * weight) / 100
                                            );
                                          },
                                          0,
                                        ),
                                      );
                                    }
                                    if (project.prodStatus === "DONE")
                                      return 100;
                                    if (
                                      project.productionStages &&
                                      project.productionStages.length > 0
                                    ) {
                                      let total = 0;
                                      project.productionStages.forEach(
                                        (s: any) => {
                                          total += Number(s.progress || 0);
                                        },
                                      );
                                      return Math.round(
                                        total / project.productionStages.length,
                                      );
                                    }
                                    return 0;
                                  })();
                                  return pProg === 100
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : pProg > 0
                                      ? "text-blue-600 dark:text-blue-400"
                                      : "text-muted-foreground";
                                })(),
                              )}
                            >
                              {(() => {
                                if (
                                  project.masterplan?.phases &&
                                  project.masterplan.phases.length > 0
                                ) {
                                  return Math.round(
                                    project.masterplan.phases.reduce(
                                      (sum: number, phase: any) => {
                                        const weight = Number(
                                          phase.weightPercent || 0,
                                        );
                                        const progress = Number(
                                          phase.actualProgress || 0,
                                        );
                                        return sum + (progress * weight) / 100;
                                      },
                                      0,
                                    ),
                                  );
                                }
                                if (project.prodStatus === "DONE") return 100;
                                if (
                                  project.productionStages &&
                                  project.productionStages.length > 0
                                ) {
                                  let total = 0;
                                  project.productionStages.forEach((s: any) => {
                                    total += Number(s.progress || 0);
                                  });
                                  return Math.round(
                                    total / project.productionStages.length,
                                  );
                                }
                                return 0;
                              })()}
                              %
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden border border-border/20">
                            <div
                              className={cn(
                                "h-full transition-all duration-300",
                                (() => {
                                  const pProg = (() => {
                                    if (
                                      project.masterplan?.phases &&
                                      project.masterplan.phases.length > 0
                                    ) {
                                      return Math.round(
                                        project.masterplan.phases.reduce(
                                          (sum: number, phase: any) => {
                                            const weight = Number(
                                              phase.weightPercent || 0,
                                            );
                                            const progress = Number(
                                              phase.actualProgress || 0,
                                            );
                                            return (
                                              sum + (progress * weight) / 100
                                            );
                                          },
                                          0,
                                        ),
                                      );
                                    }
                                    if (project.prodStatus === "DONE")
                                      return 100;
                                    if (
                                      project.productionStages &&
                                      project.productionStages.length > 0
                                    ) {
                                      let total = 0;
                                      project.productionStages.forEach(
                                        (s: any) => {
                                          total += Number(s.progress || 0);
                                        },
                                      );
                                      return Math.round(
                                        total / project.productionStages.length,
                                      );
                                    }
                                    return 0;
                                  })();
                                  return pProg === 100
                                    ? "bg-emerald-500"
                                    : pProg > 0
                                      ? "bg-blue-500"
                                      : "bg-muted-foreground/30";
                                })(),
                              )}
                              style={{
                                width: `${(() => {
                                  if (
                                    project.masterplan?.phases &&
                                    project.masterplan.phases.length > 0
                                  ) {
                                    return Math.round(
                                      project.masterplan.phases.reduce(
                                        (sum: number, phase: any) => {
                                          const weight = Number(
                                            phase.weightPercent || 0,
                                          );
                                          const progress = Number(
                                            phase.actualProgress || 0,
                                          );
                                          return (
                                            sum + (progress * weight) / 100
                                          );
                                        },
                                        0,
                                      ),
                                    );
                                  }
                                  if (project.prodStatus === "DONE") return 100;
                                  if (
                                    project.productionStages &&
                                    project.productionStages.length > 0
                                  ) {
                                    let total = 0;
                                    project.productionStages.forEach(
                                      (s: any) => {
                                        total += Number(s.progress || 0);
                                      },
                                    );
                                    return Math.round(
                                      total / project.productionStages.length,
                                    );
                                  }
                                  return 0;
                                })()}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Request Revisi Drawing Button (Ikut ke Production Status) */}
                        {(() => {
                          const activeDRCount =
                            getProjectDRs(project).activeCount;

                          if (activeDRCount === 0) return null;

                          return (
                            <button
                              onClick={() => setDrManagerProject(project)}
                              className="text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer w-max mt-0.5 transition-all text-amber-800 dark:text-amber-300 bg-amber-500/20 border border-amber-400 hover:bg-amber-500/30 animate-pulse shadow-2xs"
                              title="Klik untuk melihat dan menindaklanjuti Request Revisi Drawing dari QC/Produksi"
                            >
                              <PauseCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>
                                {activeDRCount} Request Revisi Drawing
                              </span>
                            </button>
                          );
                        })()}
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      {/* Grup Shortcut Icons 1 Baris Ramping */}
                      <div className="flex items-center justify-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50 w-fit mx-auto">
                        {/* 1. Drawing 2D/3D (Icon Pen / PenTool) */}
                        <DocumentManagerDialog
                          categories={["DRAWING"]}
                          defaultCategory="DRAWING"
                          ownerId={project.id}
                          ownerType="PROJECT"
                          leadId={project.leadId}
                          globalDriveUrl={project.globalDriveUrl}
                          onUploadSuccess={() => router.refresh()}
                          trigger={
                            <button
                              type="button"
                              className="relative h-6.5 w-6.5 rounded-md flex items-center justify-center bg-blue-500/15 text-blue-600 hover:bg-blue-500/25 transition-all cursor-pointer"
                              title={`Drawing (${engCalc.drawingCount || 0} file)`}
                            >
                              <PenTool className="w-3.5 h-3.5" />
                              {engCalc.drawingCount > 0 && (
                                <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 rounded-full bg-blue-600 text-white text-[8px] font-bold flex items-center justify-center ring-1 ring-background">
                                  {engCalc.drawingCount}
                                </span>
                              )}
                            </button>
                          }
                        />

                        {/* 2. Mechanical Part List (Icon FileCog) */}
                        <DocumentManagerDialog
                          categories={["MECH_PART_LIST"]}
                          defaultCategory="MECH_PART_LIST"
                          ownerId={project.id}
                          ownerType="PROJECT"
                          leadId={project.leadId}
                          globalDriveUrl={project.globalDriveUrl}
                          onUploadSuccess={() => router.refresh()}
                          trigger={
                            <button
                              type="button"
                              className="relative h-6.5 w-6.5 rounded-md flex items-center justify-center bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 transition-all cursor-pointer"
                              title={`Mechanical Part List (${partListCount || 0} file)`}
                            >
                              <FileCog className="w-3.5 h-3.5" />
                              {partListCount > 0 && (
                                <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 rounded-full bg-amber-600 text-white text-[8px] font-bold flex items-center justify-center ring-1 ring-background">
                                  {partListCount}
                                </span>
                              )}
                            </button>
                          }
                        />

                        {/* 3. Assembly List (Icon Settings) */}
                        <DocumentManagerDialog
                          categories={["ASSEMBLY_LIST"]}
                          defaultCategory="ASSEMBLY_LIST"
                          ownerId={project.id}
                          ownerType="PROJECT"
                          leadId={project.leadId}
                          globalDriveUrl={project.globalDriveUrl}
                          onUploadSuccess={() => router.refresh()}
                          trigger={
                            <button
                              type="button"
                              className="relative h-6.5 w-6.5 rounded-md flex items-center justify-center bg-teal-500/15 text-teal-600 hover:bg-teal-500/25 transition-all cursor-pointer"
                              title={`Assembly List (${assemblyListCount || 0} file)`}
                            >
                              <Settings className="w-3.5 h-3.5" />
                              {assemblyListCount > 0 && (
                                <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 rounded-full bg-teal-600 text-white text-[8px] font-bold flex items-center justify-center ring-1 ring-background">
                                  {assemblyListCount}
                                </span>
                              )}
                            </button>
                          }
                        />

                        {/* 4. BoQ Management (Icon FileText) */}
                        <button
                          type="button"
                          onClick={() => setBoqManagerProject(project)}
                          className="relative h-6.5 w-6.5 rounded-md flex items-center justify-center bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 transition-all cursor-pointer"
                          title={`Input / Kelola BoQ (${engCalc.boqCount || 0} item)`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {engCalc.boqCount > 0 && (
                            <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 rounded-full bg-emerald-600 text-white text-[8px] font-bold flex items-center justify-center ring-1 ring-background">
                              {engCalc.boqCount}
                            </span>
                          )}
                        </button>

                        {/* 5. Catatan PPIC (Jika ada) */}
                        {ppicNotes.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setPpicNotesProject(project)}
                            className="relative h-6.5 w-6.5 rounded-md flex items-center justify-center bg-indigo-500/15 text-indigo-600 hover:bg-indigo-500/25 transition-all cursor-pointer"
                            title={`Lihat Catatan PPIC (${ppicNotes.length} catatan)`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 rounded-full bg-indigo-600 text-white text-[8px] font-bold flex items-center justify-center ring-1 ring-background">
                              {ppicNotes.length}
                            </span>
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 cursor-pointer"
                            >
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent
                          align="end"
                          className="w-48"
                          finalFocus={false}
                        >
                          <DropdownMenuItem
                            className="text-xs font-medium cursor-pointer"
                            onClick={() => setViewDetailProject(project)}
                          >
                            <FileText className="w-4 h-4 mr-2" /> Project
                            Details
                          </DropdownMenuItem>

                          {/* Akses Document Hub di Action Menu */}
                          <DropdownMenuItem
                            className="text-xs font-medium cursor-pointer"
                            onClick={() => setDocHubProject(project)}
                          >
                            <FolderOpen className="w-4 h-4 mr-2 text-primary" />
                            <span>Document Hub</span>
                            {totalDocCount > 0 && (
                              <Badge
                                variant="secondary"
                                className="ml-auto bg-primary/20 text-primary text-[10px] px-1.5 py-0 font-bold"
                              >
                                {totalDocCount}
                              </Badge>
                            )}
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            className="text-xs font-medium cursor-pointer"
                            onClick={() => setBoqManagerProject(project)}
                          >
                            <PenTool className="w-4 h-4 mr-2 text-primary" />{" "}
                            Kelola BoQ
                          </DropdownMenuItem>

                          {project.engStatus === "REVISION_TO_ENG" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-xs font-semibold text-rose-600 cursor-pointer"
                                onClick={() =>
                                  setResolveRevisionProject(project)
                                }
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2" />{" "}
                                Selesaikan Revisi Drawing
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-xs font-semibold cursor-pointer text-amber-700"
                            onClick={() => setDrManagerProject(project)}
                          >
                            <PenTool className="w-4 h-4 mr-2 text-amber-600" />
                            Request Revisi Drawing (DR)
                            {(() => {
                              const activeDRCount =
                                getProjectDRs(project).activeCount;

                              if (activeDRCount === 0) return null;
                              return (
                                <Badge
                                  variant="secondary"
                                  className="ml-auto bg-amber-500/20 text-amber-800 text-[10px] px-1.5 py-0 font-bold animate-pulse"
                                >
                                  {activeDRCount}
                                </Badge>
                              );
                            })()}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-xs font-medium cursor-pointer text-primary"
                            onClick={() => setHistoryProject(project)}
                          >
                            <History className="w-4 h-4 mr-2" /> View Logs
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Global Detail Dialog */}
      <ProjectDetailDialog
        data={viewDetailProject}
        open={!!viewDetailProject}
        onOpenChange={(open) => !open && setViewDetailProject(null)}
        type="PROJECT"
        showValue={false}
      />

      {/* Confirm Status Dialog */}
      <Dialog
        open={!!confirmStatusProject}
        onOpenChange={(open) => !open && setConfirmStatusProject(null)}
      >
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle>Confirm Status Update</DialogTitle>
            <DialogDescription>
              Are you sure you want to change the status of{" "}
              <strong className="text-primary">
                {confirmStatusProject?.project?.projectName}
              </strong>{" "}
              to{" "}
              <strong className="text-primary">
                {
                  ENGINEERING_STATUSES.find(
                    (s) => s.id === confirmStatusProject?.status,
                  )?.label
                }
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmStatusProject(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (confirmStatusProject) {
                  handleStatusUpdate(
                    confirmStatusProject.project.id,
                    confirmStatusProject.status,
                    confirmStatusProject.division,
                  );
                  setConfirmStatusProject(null);
                }
              }}
              disabled={isPending}
            >
              {isPending ? "Updating..." : "Confirm Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Hub Dialog */}
      {docHubProject && (
        <DocumentManagerDialog
          ownerId={docHubProject.id}
          ownerType="PROJECT"
          leadId={docHubProject.leadId}
          globalDriveUrl={docHubProject.globalDriveUrl}
          onUploadSuccess={() => router.refresh()}
          open={!!docHubProject}
          onOpenChange={(open) => !open && setDocHubProject(null)}
        />
      )}

      {/* Resolve Drawing Revision Dialog */}
      <Dialog
        open={!!resolveRevisionProject}
        onOpenChange={(open) => {
          if (!open) {
            setResolveRevisionProject(null);
            setResolveNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1 text-sm font-bold text-rose-600">
              <CheckCircle2 className="w-4 h-4" />
              Selesaikan Revisi Drawing
            </DialogTitle>
            <DialogDescription className="text-xs">
              Selesaikan revisi gambar kerja untuk proyek{" "}
              <strong className="text-foreground">
                {resolveRevisionProject?.projectName}
              </strong>
              . Pastikan Anda sudah mengunggah drawing terbaru ke Document Hub.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1">
              <Label
                htmlFor="resolveNotes"
                className="font-medium text-foreground"
              >
                Catatan Revisi Selesai
              </Label>
              <Textarea
                id="resolveNotes"
                placeholder="Tulis detail revisi yang diselesaikan (contoh: 'Drawing v2 diupload, lubang flange disesuaikan')..."
                className="min-h-25 text-xs resize-y"
                value={resolveNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setResolveNotes(e.target.value)
                }
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setResolveRevisionProject(null);
                setResolveNotes("");
              }}
              disabled={isResolving}
              className="text-xs h-8 cursor-pointer"
            >
              Batal
            </Button>
            <Button
              onClick={handleResolveRevisionSubmit}
              disabled={isResolving || !resolveNotes.trim()}
              className="text-xs h-8 bg-primary font-bold shadow-xs cursor-pointer"
            >
              {isResolving && (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              )}
              Selesaikan & Kirim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProjectHistoryDialog
        project={historyProject}
        open={!!historyProject}
        onOpenChange={(open) => !open && setHistoryProject(null)}
      />

      {boqManagerProject && (
        <BoQManagerDialog
          project={boqManagerProject}
          open={!!boqManagerProject}
          onOpenChange={(open) => !open && setBoqManagerProject(null)}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Modal Dialog khusus Catatan dari PPIC */}
      <Dialog
        open={!!ppicNotesProject}
        onOpenChange={(open) => !open && setPpicNotesProject(null)}
      >
        <DialogContent className="max-w-md p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Catatan dari PPIC
            </DialogTitle>
            <DialogDescription className="text-xs">
              Daftar catatan dan instruksi dari divisi PPIC untuk proyek{" "}
              <span className="font-semibold text-foreground">
                {ppicNotesProject?.projectName}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const pastEngNotes = (ppicNotesProject?.history || []).filter(
              (h: any) => {
                const act = (h.action || "").toLowerCase();
                const remark = (h.remark || "").toLowerCase();
                const notes = (h.notes || "").toLowerCase();
                return (
                  act.includes("catatan dari ppic") ||
                  remark.includes("ppic note") ||
                  (h.division === "ENGINEERING" && notes.length > 0)
                );
              },
            );

            return (
              <div className="max-h-72 overflow-y-auto space-y-2.5 py-2 pr-1">
                {pastEngNotes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Belum ada catatan dari PPIC.
                  </p>
                ) : (
                  pastEngNotes.map((item: any, idx: number) => (
                    <div
                      key={item.id || idx}
                      className="p-3 rounded-xl bg-muted/20 border border-border/50 space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                        <span className="font-bold text-foreground flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-indigo-500" />
                          {item.updatedBy || "PPIC"}
                        </span>
                        <span>
                          {item.createdAt || item.entryDate
                            ? format(
                                new Date(item.createdAt || item.entryDate),
                                "dd MMM yyyy, HH:mm",
                              )
                            : "-"}
                        </span>
                      </div>
                      <p className="text-foreground text-xs whitespace-pre-wrap leading-relaxed">
                        {(item.notes || "")
                          .replace(
                            /\.?\s*Engineering KPI diselesaikan\.?/gi,
                            "",
                          )
                          .trim()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            );
          })()}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPpicNotesProject(null)}
              className="cursor-pointer"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DR Manager Dialog for Engineering */}
      <DRManagerDialog
        open={!!drManagerProject}
        onOpenChange={(open) => !open && setDrManagerProject(null)}
        project={drManagerProject}
        onSuccess={() => router.refresh()}
      />

      {/* Dialog Edit Estimasi Tonase Proyek */}
      <Dialog
        open={!!editTonnageProject}
        onOpenChange={(o) => !o && setEditTonnageProject(null)}
      >
        <DialogContent className="w-[90vw] sm:max-w-md rounded-2xl p-4 sm:p-6 space-y-3">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary shrink-0" />
              Estimasi Total Tonase Proyek
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Masukkan estimasi total berat/tonase (Ton). Angka ini digunakan
              sebagai acuan 100% progress Masterplan Engineering.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1">
            <Label className="text-xs font-semibold text-foreground block">
              Estimasi Total Tonase Proyek (Ton)
            </Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              placeholder="Contoh: 50 (Ton)"
              value={newTonnageInput}
              onChange={(e) => setNewTonnageInput(e.target.value)}
              className="h-9 text-xs rounded-xl font-semibold text-foreground"
            />
          </div>

          <DialogFooter className="mt-3 flex flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditTonnageProject(null)}
              disabled={isUpdatingTonnage}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSaveTonnage}
              disabled={isUpdatingTonnage}
              className="rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isUpdatingTonnage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              Simpan Estimasi Tonase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
