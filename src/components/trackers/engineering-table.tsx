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
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
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

export function EngineeringTable({
  projects,
  meta,
}: {
  projects: any[];
  meta?: { totalPages: number; totalCount: number; currentPage: number };
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
  const [resolveRevisionProject, setResolveRevisionProject] = useState<
    any | null
  >(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [isResolving, startResolveTransition] = useTransition();
  const [boqManagerProject, setBoqManagerProject] = useState<any | null>(null);

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
              {(currentStatus !== "ALL" ||
                currentStart ||
                currentSort !== "desc") && (
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
                  Status
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={currentStatus === "ALL" ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs px-2 cursor-pointer"
                    onClick={() => updateQuery({ status: null })}
                  >
                    All
                  </Button>
                  {ENGINEERING_STATUSES.map((s) => (
                    <Button
                      key={s.id}
                      variant={currentStatus === s.id ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs px-2 cursor-pointer"
                      onClick={() => updateQuery({ status: s.id })}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>

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
                    status: "ALL",
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
              <TableHead className="w-[50px] text-center">No.</TableHead>
              <TableHead className="min-w-[200px]">
                Project & Customer
              </TableHead>
              <TableHead>Entry Date</TableHead>
              <TableHead>Running</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Project Status</TableHead>
              <TableHead className="text-center">Docs</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
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
                const entryDate = project.createdAt;
                const exitDate = project.engCompletedAt;
                const displayStatus = project.ppicStatus === "REVIEW" ? "REVIEW" : project.engStatus;

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
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <ArrowRight className="w-2.5 h-2.5 rotate-90 opacity-50" />
                            <span>
                              In:{" "}
                              {entryDate
                                ? format(new Date(entryDate), "dd MMM yy")
                                : "-"}
                            </span>
                          </div>
                          {project.engReviewedAt && (
                            <div className="flex items-center gap-1.5 text-blue-600/80 font-semibold">
                              <History className="w-2.5 h-2.5 opacity-70" />
                              <span>
                                Rev:{" "}
                                {format(
                                  new Date(project.engReviewedAt),
                                  "dd MMM yy",
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                        {(project.engStatus === "DONE" ||
                          project.engStatus === "APPROVED" ||
                          project.engStatus === "APPROVED_BY_PPIC") &&
                          exitDate && (
                            <div className="flex items-center gap-1.5 text-green-600/80">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>
                                Out: {format(new Date(exitDate), "dd MMM yy")}
                              </span>
                            </div>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-primary">
                          {project.createdAt
                            ? differenceInDays(
                                new Date(),
                                new Date(project.createdAt),
                              )
                            : 0}{" "}
                          Days
                        </span>
                        {/* <span className="text-xs text-muted-foreground font-semibold">
                          Total Running
                        </span> */}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5 opacity-60" />
                          <span>
                            {project.expectedDate
                              ? format(
                                  new Date(project.expectedDate),
                                  "dd MMM yy",
                                )
                              : "No Date"}
                          </span>
                        </div>
                        {getTimelineStatus(project.expectedDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 gap-2 cursor-pointer hover:bg-muted font-semibold text-xs"
                            >
                              <div
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  displayStatus === "APPROVED_BY_CUSTOMER"
                                    ? "bg-cyan-500"
                                    : displayStatus === "APPROVED" ||
                                        displayStatus === "APPROVED_BY_PPIC" ||
                                        displayStatus === "DONE"
                                      ? "bg-green-500"
                                      : displayStatus === "REVIEW"
                                        ? "bg-orange-500"
                                        : displayStatus === "IN_PROGRESS"
                                          ? "bg-blue-500"
                                          : displayStatus === "REVISION"
                                            ? "bg-purple-500"
                                            : displayStatus === "REVISION_TO_ENG"
                                              ? "bg-rose-500 animate-pulse"
                                              : "bg-slate-400",
                                )}
                              />
                              {ENGINEERING_STATUSES.find(
                                (s) => s.id === displayStatus,
                              )?.label || displayStatus}
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="start" className="w-48">
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Update Status
                          </div>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            {ENGINEERING_STATUSES.map((status) => (
                              <DropdownMenuItem
                                key={status.id}
                                disabled={displayStatus === status.id}
                                onClick={() =>
                                  setConfirmStatusProject({
                                    project,
                                    status: status.id,
                                  })
                                }
                                className="text-xs py-2"
                              >
                                <div
                                  className={cn(
                                    "w-2 h-2 rounded-full mr-2",
                                    status.id === "APPROVED_BY_CUSTOMER"
                                      ? "bg-cyan-500"
                                      : status.id === "APPROVED_BY_PPIC"
                                        ? "bg-green-500"
                                        : status.id === "REVIEW"
                                          ? "bg-orange-500"
                                          : status.id === "IN_PROGRESS"
                                            ? "bg-blue-500"
                                            : status.id === "REVISION"
                                              ? "bg-purple-500"
                                              : status.id === "REVISION_TO_ENG"
                                                ? "bg-rose-500"
                                                : "bg-slate-400",
                                  )}
                                />
                                {status.label}
                                {displayStatus === status.id && (
                                  <div className="ml-auto flex items-center gap-1.5">
                                    <div className="w-1 h-1 rounded-full bg-primary" />
                                    <span className="text-[10px] text-muted-foreground">
                                      Active
                                    </span>
                                  </div>
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell>
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
                    <TableCell className="text-center">
                      <DocumentManagerDialog
                        ownerId={project.id}
                        ownerType="PROJECT"
                        leadId={project.leadId}
                        globalDriveUrl={project.globalDriveUrl}
                        onUploadSuccess={() => router.refresh()}
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="relative h-8 px-2 gap-2 cursor-pointer transition-all border border-transparent"
                          >
                            <FolderOpen className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-medium">
                              {project.documentCount || 0}
                            </span>
                            {project.hasRevisedDocs && (
                              <span className="absolute top-0 right-0 -mt-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-background"></span>
                              </span>
                            )}
                          </Button>
                        }
                      />
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

                          <DropdownMenuItem
                            className="text-xs font-medium cursor-pointer"
                            onClick={() => setBoqManagerProject(project)}
                          >
                            <PenTool className="w-4 h-4 mr-2 text-primary" /> Kelola BoQ
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            className={cn(
                              "text-xs font-semibold transition-colors",
                              (project.currentDivision === "ENGINEERING")
                                ? "text-primary cursor-pointer"
                                : "text-muted-foreground opacity-50 cursor-not-allowed",
                            )}
                            disabled={project.currentDivision !== "ENGINEERING"}
                            onClick={() => {
                              if (project.currentDivision === "ENGINEERING") {
                                setConfirmStatusProject({
                                  project,
                                  status: "REVIEW",
                                  division: "PPIC",
                                });
                              } else {
                                toast.error(
                                  project.currentDivision === "PPIC"
                                    ? "Proyek sudah berada di divisi PPIC!"
                                    : "Proyek tidak sedang berada di divisi Engineering!",
                                );
                              }
                            }}
                          >
                            <ArrowRight className="w-4 h-4 mr-2" /> Handover to
                            PPIC
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
        <DialogContent className="sm:max-w-[425px]">
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
        <DialogContent className="sm:max-w-[425px]">
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
                className="min-h-[100px] text-xs resize-y"
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
    </div>
  );
}
