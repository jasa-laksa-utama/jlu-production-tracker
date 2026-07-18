"use client";

import { useTransition, useState, useEffect } from "react";
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
import { DateRangePicker } from "@/components/leads/date-range-picker";
import { DateRange } from "react-day-picker";
import {
  RotateCcw,
  Eye,
  Loader2,
  Calendar,
  FileText,
  MoreHorizontal,
  ArrowRight,
  History,
  CheckCircle2,
  FolderOpen,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  ArrowUpDown,
  UploadCloud,
  Truck,
  Package,
  X,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, differenceInDays } from "date-fns";
import {
  updateProjectDivisionStatus,
  handoverToInventory,
  getPurchaseOrders,
} from "@/app/actions/projects";
import { getSPBHistory, updateSPBItemStatus } from "@/app/actions/spb";
import { getProjectShipments, getAllShipments } from "@/app/actions/shipping";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DocumentManagerDialog } from "@/components/document-manager-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ProjectDetailDialog } from "@/components/project-detail-dialog";
import { ProjectHistoryDialog } from "@/components/project-history-dialog";
import { CreateSPBDialog } from "@/components/trackers/create-spb-dialog";

const PPIC_STATUSES = [
  {
    id: "REVIEW",
    label: "In Review",
    color: "bg-orange-500",
  },
  {
    id: "APPROVED_BY_PPIC",
    label: "Approved PPIC",
    color: "bg-blue-500",
  },
  {
    id: "WAITING_INVENTORY",
    label: "Waiting Inventory",
    color: "bg-purple-500",
  },
  {
    id: "INVENTORY_READY",
    label: "Inventory Ready",
    color: "bg-emerald-500",
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
    case "INVENTORY_ACCEPTED":
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
    case "INVENTORY_ACCEPTED":
      return "Inventory Accepted";
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

const getPOStatusLabel = (status?: string) => {
  if (!status) return "-";
  switch (status.toUpperCase()) {
    case "PENDING":
    case "PENDING_APPROVAL":
      return "Menunggu Persetujuan";
    case "APPROVED_WAITING_SIGNATURE":
      return "Menunggu Tanda Tangan";
    case "APPROVED":
      return "Disetujui";
    case "PARTIALLY_RECEIVED":
      return "Diterima Sebagian";
    case "RECEIVED":
      return "Diterima Lengkap";
    case "CLOSED":
      return "Selesai";
    case "REJECTED":
      return "Ditolak";
    default:
      return status.replace(/_/g, " ");
  }
};

const getPOStatusColor = (status?: string) => {
  if (!status) return "bg-gray-500/10 text-gray-700 border-gray-500/20";
  switch (status.toUpperCase()) {
    case "PENDING":
    case "PENDING_APPROVAL":
      return "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400";
    case "APPROVED_WAITING_SIGNATURE":
      return "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400";
    case "APPROVED":
      return "bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400";
    case "PARTIALLY_RECEIVED":
      return "bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400";
    case "RECEIVED":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-450";
    case "CLOSED":
      return "bg-zinc-500/10 text-zinc-700 border-zinc-500/20 dark:text-zinc-400";
    case "REJECTED":
      return "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400";
    default:
      return "bg-gray-500/10 text-gray-700 border-gray-500/20";
  }
};

const getSpbStatusLabel = (status?: string) => {
  if (!status) return "Disetujui";
  switch (status.toUpperCase()) {
    case "PENDING_APPROVAL":
      return "Menunggu Persetujuan";
    case "APPROVED":
      return "Disetujui";
    case "REJECTED":
      return "Ditolak";
    default:
      return status.replace(/_/g, " ");
  }
};

const getSpbStatusColor = (status?: string) => {
  if (!status)
    return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  switch (status.toUpperCase()) {
    case "PENDING_APPROVAL":
      return "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400";
    case "APPROVED":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-450";
    case "REJECTED":
      return "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400";
    default:
      return "bg-gray-500/10 text-gray-700 border-gray-500/20";
  }
};

export function PpicTable({
  projects,
  meta,
}: {
  projects: any[];
  meta: { totalPages: number; totalCount: number; currentPage: number };
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Extraction from searchParams
  const currentPage = Number(searchParams.get("page")) || 1;
  const currentLimit = Number(searchParams.get("limit")) || 10;
  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "ALL";
  const currentSort = searchParams.get("sort") || "desc";
  const currentStart = searchParams.get("start") || "";
  const currentEnd = searchParams.get("end") || "";

  // For controlled search input
  const [searchInput, setSearchInput] = useState(currentSearch);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: currentStart ? new Date(currentStart) : undefined,
    to: currentEnd ? new Date(currentEnd) : undefined,
  });

  function updateQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    // Reset page if a filter (non-page) is changed
    if (!updates.page) params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  // Handle debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== currentSearch) {
        updateQuery({ search: searchInput });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const [activeTab, setActiveTab] = useState<
    "pipeline" | "spb" | "shipping" | "po"
  >("pipeline");
  const [allShipments, setAllShipments] = useState<any[]>([]);
  const [isLoadingAllShipments, setIsLoadingAllShipments] = useState(false);
  const [allPurchaseOrders, setAllPurchaseOrders] = useState<any[]>([]);
  const [isLoadingAllPurchaseOrders, setIsLoadingAllPurchaseOrders] =
    useState(false);
  const [detailShipment, setDetailShipment] = useState<any | null>(null);
  const [shipmentSearch, setShipmentSearch] = useState("");
  const [poSearch, setPoSearch] = useState("");
  const [poPage, setPoPage] = useState(1);
  const [poLimit, setPoLimit] = useState(10);
  const [poItemSearch, setPoItemSearch] = useState("");
  const [selectedDetailPO, setSelectedDetailPO] = useState<any | null>(null);
  const [docHubProject, setDocHubProject] = useState<any | null>(null);
  const [detailProject, setDetailProject] = useState<any | null>(null);
  const [historyProject, setHistoryProject] = useState<any | null>(null);
  const [spbProject, setSpbProject] = useState<any | null>(null);
  const [shippingProject, setShippingProject] = useState<any | null>(null);
  const [shipmentsList, setShipmentsList] = useState<any[]>([]);
  const [isLoadingShipping, setIsLoadingShipping] = useState(false);
  const [spbMonitorProject, setSpbMonitorProject] = useState<any | null>(null);
  const [spbMonitorHistory, setSpbMonitorHistory] = useState<any[]>([]);
  const [isLoadingSpbMonitor, setIsLoadingSpbMonitor] = useState(false);
  const [expandedSpbMonitorIds, setExpandedSpbMonitorIds] = useState<
    Record<string, boolean>
  >({});
  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >({});
  const [expandedPoProjects, setExpandedPoProjects] = useState<
    Record<string, boolean>
  >({});
  const [selectedDetailSpb, setSelectedDetailSpb] = useState<any | null>(null);
  const [spbSearchQuery, setSpbSearchQuery] = useState("");

  const findSpbAndOpen = (spbNumberText: string) => {
    let foundSpb: any = null;
    for (const project of projects) {
      if (project.spb) {
        foundSpb = project.spb.find(
          (s: any) =>
            s.spbNumber.toLowerCase() === spbNumberText.trim().toLowerCase(),
        );
        if (foundSpb) break;
      }
    }
    if (foundSpb) {
      setSelectedDetailSpb(foundSpb);
    } else {
      alert(`Dokumen SPB ${spbNumberText} tidak ditemukan.`);
    }
  };

  useEffect(() => {
    if (spbMonitorProject) {
      setIsLoadingSpbMonitor(true);
      setSpbMonitorHistory([]);
      setExpandedSpbMonitorIds({});
      getSPBHistory(spbMonitorProject.id)
        .then((res) => {
          setSpbMonitorHistory(res || []);
        })
        .catch((err) => {
          console.error("Error loading SPB monitor history:", err);
        })
        .finally(() => {
          setIsLoadingSpbMonitor(false);
        });
    }
  }, [spbMonitorProject]);

  const toggleSpbMonitor = (id: string) => {
    setExpandedSpbMonitorIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    projectId: string;
    status: string;
    division?: string;
    notes?: string;
    title: string;
    description: string;
    type: "approve" | "return" | "handover";
  } | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");

  const [isChecked1, setIsChecked1] = useState(false);
  const [isChecked2, setIsChecked2] = useState(false);
  const [isChecked3, setIsChecked3] = useState(false);
  const [dialogSpbList, setDialogSpbList] = useState<any[]>([]);
  const [isLoadingSpb, setIsLoadingSpb] = useState(false);

  useEffect(() => {
    if (
      confirmDialog?.show &&
      confirmDialog.type === "handover" &&
      confirmDialog.division === "PRODUCTION"
    ) {
      setIsLoadingSpb(true);
      setDialogSpbList([]);
      setIsChecked1(false);
      setIsChecked2(false);
      setIsChecked3(false);

      getSPBHistory(confirmDialog.projectId)
        .then((history) => {
          setDialogSpbList(history);
        })
        .catch((err) => {
          console.error("Error fetching SPB history for handover dialog:", err);
          toast.error("Gagal mengambil riwayat status SPB");
        })
        .finally(() => {
          setIsLoadingSpb(false);
        });
    }
  }, [confirmDialog]);

  useEffect(() => {
    if (shippingProject) {
      setIsLoadingShipping(true);
      setShipmentsList([]);
      getProjectShipments(shippingProject.id)
        .then((data) => {
          setShipmentsList(data);
        })
        .catch((err) => {
          console.error("Error fetching shipments for shipping monitor:", err);
          toast.error("Gagal mengambil status pengiriman");
        })
        .finally(() => {
          setIsLoadingShipping(false);
        });
    }
  }, [shippingProject]);

  useEffect(() => {
    if (activeTab === "shipping") {
      setIsLoadingAllShipments(true);
      getAllShipments()
        .then((res) => {
          if (res.success && res.data) {
            setAllShipments(res.data);
          } else if (res.error) {
            toast.error(res.error);
          }
        })
        .catch((err) => {
          console.error("Error fetching all shipments:", err);
          toast.error("Gagal memuat data pengiriman.");
        })
        .finally(() => {
          setIsLoadingAllShipments(false);
        });
    } else if (activeTab === "po") {
      setIsLoadingAllPurchaseOrders(true);
      getPurchaseOrders()
        .then((res) => {
          if (res.success && res.data) {
            setAllPurchaseOrders(res.data);
          } else if (res.error) {
            toast.error(res.error);
          }
        })
        .catch((err) => {
          console.error("Error fetching purchase orders:", err);
          toast.error("Gagal memuat data Purchase Order.");
        })
        .finally(() => {
          setIsLoadingAllPurchaseOrders(false);
        });
    }
  }, [activeTab]);

  const handleStatusUpdate = async (
    projectId: string,
    status: string,
    division: string = "PPIC",
    notes?: string,
  ) => {
    startTransition(async () => {
      const promise = async () => {
        if (division === "INVENTORY" && status === "WAITING_INVENTORY") {
          const result = await handoverToInventory(projectId);
          if (!result.success) throw new Error(result.error);
          return result;
        }

        // If status is APPROVED_BY_PPIC, the backend will automatically set
        // Engineering to APPROVED and PPIC to APPROVED_BY_PPIC in one transaction.
        if (division === "PPIC" && status === "APPROVED_BY_PPIC") {
          const result = await updateProjectDivisionStatus(
            projectId,
            "PPIC",
            "APPROVED_BY_PPIC",
            notes || "PPIC: Approved (Dual Approval with PM)",
          );
          if (!result.success) throw new Error(result.error);
          return result;
        } else {
          // Standard single division update (e.g. Return to Engineering, Handover, etc)
          const result = await updateProjectDivisionStatus(
            projectId,
            division,
            status,
            notes || `Status updated to ${status}`,
          );
          if (!result.success) throw new Error(result.error);
          return result;
        }
      };

      toast.promise(promise(), {
        loading: "Updating status...",
        success: () => {
          setConfirmDialog(null);
          setRevisionNotes("");
          router.refresh();
          return division !== "PPIC"
            ? `Project moved to ${division}`
            : `Project status updated to ${status === "APPROVED_BY_PPIC" ? "Approved" : status}`;
        },
      });
    });
  };

  const handleUpdateSpbItemStatus = (itemId: string, newStatus: string) => {
    const promise = async () => {
      const res = await updateSPBItemStatus(itemId, newStatus);
      if (!res.success) throw new Error(res.error);
      return res;
    };

    toast.promise(promise(), {
      loading: "Updating SPB item status...",
      success: () => {
        router.refresh();
        setSelectedDetailSpb((prev: any) => {
          if (!prev) return null;
          return {
            ...prev,
            items: prev.items.map((item: any) =>
              item.id === itemId ? { ...item, status: newStatus } : item,
            ),
          };
        });
        return "Status item SPB berhasil diperbarui!";
      },
      error: (err) => err.message || "Gagal memperbarui status item SPB",
    });
  };

  const filteredShipments = allShipments.filter((s) => {
    const q = shipmentSearch.toLowerCase();
    return (
      s.suratJalanNo.toLowerCase().includes(q) ||
      s.projectNumber.toLowerCase().includes(q) ||
      s.projectName.toLowerCase().includes(q) ||
      s.destination.toLowerCase().includes(q) ||
      s.driverName.toLowerCase().includes(q) ||
      s.vehiclePlate.toLowerCase().includes(q)
    );
  });

  return (
    <TooltipProvider>
      <div className="space-y-4 relative">
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl w-fit border border-border">
          <button
            onClick={() => setActiveTab("pipeline")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              activeTab === "pipeline"
                ? "bg-background text-foreground shadow-xs border border-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Approval Pipeline
          </button>
          <button
            onClick={() => setActiveTab("spb")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              activeTab === "spb"
                ? "bg-background text-foreground shadow-xs border border-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Monitoring SPB
          </button>
          <button
            onClick={() => setActiveTab("shipping")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              activeTab === "shipping"
                ? "bg-background text-foreground shadow-xs border border-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Shipping Monitor
          </button>
          <button
            onClick={() => setActiveTab("po")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              activeTab === "po"
                ? "bg-background text-foreground shadow-xs border border-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Monitoring PO
          </button>
        </div>
        {activeTab === "pipeline" && (
          <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 md:max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search projects..."
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
                      </Button>
                    }
                  />
                  <PopoverContent className="w-80 p-4 space-y-4" align="end">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Status
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          "ALL",
                          "REVIEW",
                          "APPROVED_BY_PPIC",
                          "WAITING_INVENTORY",
                          "INVENTORY_READY",
                        ].map((s) => (
                          <Button
                            key={s}
                            variant={
                              currentStatus === s ? "default" : "outline"
                            }
                            size="sm"
                            className="h-8 text-xs px-2 cursor-pointer"
                            onClick={() => updateQuery({ status: s })}
                          >
                            {s === "ALL"
                              ? "All"
                              : PPIC_STATUSES.find((ps) => ps.id === s)
                                  ?.label || s}
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
                            start: range?.from
                              ? range.from.toISOString()
                              : null,
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
                            ? "Newest First"
                            : "Oldest First"}
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
                    <span className="font-semibold text-muted-foreground">
                      {meta?.totalCount || 0}
                    </span>{" "}
                    projects
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-row items-center justify-between text-sm py-1 border-b border-border/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-xs whitespace-nowrap text-muted-foreground">
                  Show:
                </span>
                <select
                  value={currentLimit}
                  onChange={(e) =>
                    updateQuery({ limit: e.target.value, page: "1" })
                  }
                  className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer text-foreground font-semibold"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-xs text-muted-foreground ml-2 font-medium">
                  Showing projects{" "}
                  {Math.min(
                    meta?.totalCount || 0,
                    (currentPage - 1) * currentLimit + 1,
                  )}{" "}
                  -{" "}
                  {Math.min(meta?.totalCount || 0, currentPage * currentLimit)}{" "}
                  of {meta?.totalCount || 0}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 cursor-pointer rounded-lg border-border hover:bg-muted"
                  onClick={() => updateQuery({ page: String(currentPage - 1) })}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-muted-foreground mx-2 text-xs font-semibold">
                  Page{" "}
                  <span className="font-bold text-foreground">
                    {currentPage}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-foreground">
                    {meta?.totalPages || 1}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 cursor-pointer rounded-lg border-border hover:bg-muted"
                  onClick={() => updateQuery({ page: String(currentPage + 1) })}
                  disabled={currentPage >= (meta?.totalPages || 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-4 relative">
              {isPending && (
                <div className="absolute inset-0 z-50 bg-background/40 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              )}

              <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/20 border-b">
                    <TableRow className="border-border hover:bg-transparent text-sm font-bold">
                      <TableHead className="w-[50px] text-center">
                        No.
                      </TableHead>
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
                          colSpan={10}
                          className="text-center h-48 text-muted-foreground"
                        >
                          <div className="flex flex-col items-center gap-2 opacity-30">
                            <ClipboardCheck className="w-8 h-8" />
                            <p className="text-sm font-medium">
                              No projects in PPIC
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      projects.map((project, index) => {
                        const entryDate =
                          project.ppicEntryDate || project.createdAt;
                        const deadline = project.expectedDate
                          ? new Date(project.expectedDate)
                          : null;
                        const today = new Date();
                        const diff = deadline
                          ? differenceInDays(deadline, today)
                          : null;

                        const getProjectStatus = () => {
                          const match = PPIC_STATUSES.find(
                            (s) => s.id === project.ppicStatus,
                          );
                          return (
                            match || {
                              label: project.ppicStatus,
                              color: "bg-slate-400",
                            }
                          );
                        };

                        const currentStatus = getProjectStatus();

                        return (
                          <TableRow
                            key={project.id}
                            className="border-border/40 hover:bg-muted/20 transition-colors group"
                          >
                            <TableCell className="text-center text-muted-foreground text-sm font-mono">
                              {(currentPage - 1) * currentLimit + index + 1}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                {project.projectNumber && (
                                  <span className="text-xs text-primary font-semibold">
                                    {project.projectNumber}
                                  </span>
                                )}
                                <span className="font-bold text-sm group-hover:text-primary transition-colors">
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
                              <div className="flex flex-col gap-1 text-[11px]">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-muted-foreground w-7">
                                    In:
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {project.ppicEntryDate
                                      ? format(
                                          new Date(project.ppicEntryDate),
                                          "dd MMM yy",
                                        )
                                      : "-"}
                                  </span>
                                </div>
                                {project.ppicCompletedAt && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-green-600/80 w-7 font-bold">
                                      App:
                                    </span>
                                    <span className="font-medium text-foreground">
                                      {format(
                                        new Date(project.ppicCompletedAt),
                                        "dd MMM yy",
                                      )}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-bold text-primary">
                                  {differenceInDays(
                                    new Date(),
                                    new Date(project.createdAt),
                                  )}{" "}
                                  Days
                                </span>
                                <span className="text-xs text-muted-foreground font-semibold">
                                  Since Start
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                                  <Calendar className="w-3.5 h-3.5 opacity-60" />
                                  <span>
                                    {deadline
                                      ? format(deadline, "dd MMM yy")
                                      : "-"}
                                  </span>
                                </div>
                                {diff !== null && (
                                  <span
                                    className={cn(
                                      "text-[11px] font-bold",
                                      diff < 0
                                        ? "text-red-600"
                                        : diff <= 7
                                          ? "text-orange-600"
                                          : "text-green-600",
                                    )}
                                  >
                                    {diff < 0
                                      ? `Delayed ${Math.abs(diff)} days`
                                      : `${diff} days left`}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={cn(
                                      "w-2 h-2 rounded-full",
                                      currentStatus.color,
                                    )}
                                  />
                                  <span className="text-sm font-medium">
                                    {currentStatus.label}
                                  </span>
                                </div>
                                {project.spbCount > 0 && (
                                  <div className="flex flex-col gap-1 mt-1">
                                    <span className="text-[11px] font-semibold text-primary bg-primary/5 border border-primary/20 px-1.5 py-0.5 rounded w-max">
                                      SPB Dibuat: {project.spbCount}
                                    </span>
                                    <span
                                      className={cn(
                                        "text-[11px] font-semibold px-1.5 py-0.5 rounded w-max border",
                                        project.approvedSpbCount ===
                                          project.spbCount
                                          ? "bg-emerald-500/5 text-emerald-600 border-emerald-500/20"
                                          : project.approvedSpbCount > 0
                                            ? "bg-blue-500/5 text-blue-600 border-blue-500/20"
                                            : "bg-zinc-500/5 text-zinc-500 border-zinc-500/20",
                                      )}
                                    >
                                      SPB Disetujui:{" "}
                                      {project.approvedSpbCount || 0}
                                    </span>
                                  </div>
                                )}
                              </div>
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
                                    Divisi:{" "}
                                    {formatDivision(project.currentDivision)}
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
                                      className="h-8 w-8 rounded-full cursor-pointer"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  }
                                />
                                <DropdownMenuContent
                                  align="end"
                                  className="w-56"
                                  finalFocus={false}
                                >
                                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                    Actions
                                  </div>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuGroup>
                                    <DropdownMenuItem
                                      className="text-xs font-medium focus:text-orange-700 focus:bg-orange-50 cursor-pointer"
                                      onClick={() => setDetailProject(project)}
                                    >
                                      <Eye className="w-4 h-4 mr-2" /> View
                                      Project Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-xs font-medium text-orange-600 focus:text-orange-700 focus:bg-orange-50 cursor-pointer"
                                      onClick={() => setSpbProject(project)}
                                    >
                                      <FileText className="w-4 h-4 mr-2" />{" "}
                                      Create SPB
                                    </DropdownMenuItem>
                                    {project.currentDivision === "PPIC" &&
                                      project.ppicStatus !==
                                        "APPROVED_BY_PPIC" && (
                                        <DropdownMenuItem
                                          className="text-xs font-semibold text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50 cursor-pointer"
                                          onClick={() => {
                                            setConfirmDialog({
                                              show: true,
                                              projectId: project.id,
                                              status: "APPROVED_BY_PPIC",
                                              division: "PPIC",
                                              notes: "PPIC: Approved",
                                              title: "Approve PPIC",
                                              description:
                                                "Apakah Anda yakin ingin menyetujui proyek ini? Tindakan ini akan mengubah status PPIC menjadi Approved PPIC.",
                                              type: "approve",
                                            });
                                          }}
                                        >
                                          <CheckCircle2 className="w-4 h-4 mr-2" />{" "}
                                          Approve PPIC
                                        </DropdownMenuItem>
                                      )}

                                    {project.currentDivision ===
                                      "INVENTORY" && (
                                      <DropdownMenuItem
                                        className="text-xs font-semibold text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50 cursor-pointer"
                                        onClick={() => {
                                          setConfirmDialog({
                                            show: true,
                                            projectId: project.id,
                                            status: "IN_PROGRESS",
                                            division: "PRODUCTION",
                                            notes:
                                              "PPIC: Handed over to Production",
                                            title: "Handover to Production",
                                            description:
                                              "Apakah Anda yakin ingin menyetujui dan melakukan serah terima proyek ini ke divisi Produksi? Tindakan ini akan memulai proses produksi.",
                                            type: "handover",
                                          });
                                        }}
                                      >
                                        <CheckCircle2 className="w-4 h-4 mr-2" />{" "}
                                        Handover to Production
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    {/* REJECTION / REVISION */}
                                    <DropdownMenuItem
                                      className="text-xs font-medium text-red-600 cursor-pointer"
                                      onClick={() => {
                                        setConfirmDialog({
                                          show: true,
                                          projectId: project.id,
                                          status: "REVISION",
                                          division: "ENGINEERING",
                                          notes: "PPIC: Returned for Revision",
                                          title: "Return to Engineering",
                                          description:
                                            "Are you sure you want to return this project to Engineering for revision?",
                                          type: "return",
                                        });
                                      }}
                                    >
                                      <RotateCcw className="w-4 h-4 mr-2" />{" "}
                                      Return to Engineering
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-xs font-medium text-primary cursor-pointer"
                                      onClick={() => setHistoryProject(project)}
                                    >
                                      <History className="w-4 h-4 mr-2" /> View
                                      Logs
                                    </DropdownMenuItem>
                                  </DropdownMenuGroup>
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
            </div>
          </>
        )}
        {activeTab === "shipping" && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 md:max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Cari nomor Surat Jalan, proyek, tujuan, atau armada..."
                  className="pl-9 w-full shadow-none bg-background rounded-md border-border h-9 text-sm"
                  value={shipmentSearch}
                  onChange={(e) => setShipmentSearch(e.target.value)}
                />
              </div>
              <div className="text-xs text-muted-foreground font-semibold">
                Total Pengiriman: {filteredShipments.length}
              </div>
            </div>

            <div className="flex flex-row items-center justify-between text-sm py-1 border-b border-border/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-xs whitespace-nowrap text-muted-foreground">
                  Show:
                </span>
                <select
                  value={currentLimit}
                  onChange={(e) =>
                    updateQuery({ limit: e.target.value, page: "1" })
                  }
                  className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer text-foreground font-semibold"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-xs text-muted-foreground ml-2 font-medium">
                  Showing projects{" "}
                  {Math.min(
                    meta?.totalCount || 0,
                    (currentPage - 1) * currentLimit + 1,
                  )}{" "}
                  -{" "}
                  {Math.min(meta?.totalCount || 0, currentPage * currentLimit)}{" "}
                  of {meta?.totalCount || 0}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 cursor-pointer rounded-lg border-border hover:bg-muted"
                  onClick={() => updateQuery({ page: String(currentPage - 1) })}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-muted-foreground mx-2 text-xs font-semibold">
                  Page{" "}
                  <span className="font-bold text-foreground">
                    {currentPage}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-foreground">
                    {meta?.totalPages || 1}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 cursor-pointer rounded-lg border-border hover:bg-muted"
                  onClick={() => updateQuery({ page: String(currentPage + 1) })}
                  disabled={currentPage >= (meta?.totalPages || 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted/20 border-b">
                  <TableRow className="border-border hover:bg-transparent text-sm font-bold">
                    <TableHead className="w-[50px] text-center">No.</TableHead>
                    <TableHead>No. Surat Jalan</TableHead>
                    <TableHead>Proyek</TableHead>
                    <TableHead>Rencana Kirim</TableHead>
                    <TableHead>Tujuan</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[60px] text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingAllShipments ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center h-48">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground font-medium">
                            Memuat data pengiriman...
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredShipments.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center h-48 text-muted-foreground"
                      >
                        Tidak ada data pengiriman ditemukan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredShipments.map((shipment, idx) => (
                      <TableRow
                        key={shipment.id}
                        className="border-border hover:bg-muted/10 transition-colors"
                      >
                        <TableCell className="text-center text-muted-foreground font-mono text-xs">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-bold font-mono text-xs text-blue-700">
                          {shipment.suratJalanNo}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-primary font-semibold">
                              {shipment.projectNumber}
                            </span>
                            <span className="font-bold text-xs">
                              {shipment.projectName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          {format(
                            new Date(shipment.deliveryDate),
                            "dd MMM yyyy",
                          )}
                        </TableCell>
                        <TableCell
                          className="text-xs text-muted-foreground max-w-[200px] truncate"
                          title={shipment.destination}
                        >
                          {shipment.destination}
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] font-semibold text-muted-foreground bg-muted border px-1.5 py-0.5 rounded">
                            {shipment.shippingMethod === "INTERNAL_DELIVERY"
                              ? "Pengiriman Internal"
                              : "Ambil Sendiri"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "font-black text-[9px] px-2 py-0.5 rounded border shadow-none",
                              shipment.status === "DELIVERED"
                                ? "bg-green-500/10 text-green-700 border-green-500/20"
                                : shipment.status === "IN_DELIVERY"
                                  ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                                  : shipment.status === "RETUR"
                                    ? "bg-red-500/10 text-red-700 border-red-500/20"
                                    : "bg-blue-500/10 text-blue-700 border-blue-500/20",
                            )}
                            variant="outline"
                          >
                            {shipment.status === "READY_TO_SHIP"
                              ? "Siap Dikirim"
                              : shipment.status === "IN_DELIVERY"
                                ? "Dalam Perjalanan"
                                : shipment.status === "DELIVERED"
                                  ? "Terkirim"
                                  : shipment.status === "RETUR"
                                    ? "Retur"
                                    : shipment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-primary"
                            onClick={() => setDetailShipment(shipment)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        {activeTab === "po" && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 md:max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Cari projek, nomor PO, supplier, atau barang..."
                  className="pl-9 w-full shadow-none bg-background rounded-md border-border h-9 text-sm"
                  value={poSearch}
                  onChange={(e) => {
                    setPoSearch(e.target.value);
                    setPoPage(1);
                  }}
                />
              </div>
              <div className="text-xs text-muted-foreground font-semibold">
                Total Purchase Order:{" "}
                {(() => {
                  const q = poSearch.toLowerCase();
                  return allPurchaseOrders.filter((po) => {
                    return (
                      po.nomorPO.toLowerCase().includes(q) ||
                      po.kepada.toLowerCase().includes(q) ||
                      (po.projek && po.projek.toLowerCase().includes(q)) ||
                      po.items.some((item: any) =>
                        item.namaBarang.toLowerCase().includes(q),
                      )
                    );
                  }).length;
                })()}
              </div>
            </div>

            {/* Accordion List grouped by Project */}
            {(() => {
              const q = poSearch.toLowerCase();
              const filtered = allPurchaseOrders.filter((po) => {
                return (
                  po.nomorPO.toLowerCase().includes(q) ||
                  po.kepada.toLowerCase().includes(q) ||
                  (po.projek && po.projek.toLowerCase().includes(q)) ||
                  po.items.some((item: any) =>
                    item.namaBarang.toLowerCase().includes(q),
                  )
                );
              });

              if (isLoadingAllPurchaseOrders) {
                return (
                  <div className="text-center h-48 border border-dashed border-border/60 rounded-xl bg-muted/5 flex flex-col items-center justify-center text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                    <p className="text-sm font-semibold">
                      Memuat data Purchase Order...
                    </p>
                  </div>
                );
              }

              // Group PO by Project name
              const groups: Record<string, any[]> = {};
              filtered.forEach((po) => {
                const projectKey = po.projek || "Tanpa Proyek";
                if (!groups[projectKey]) {
                  groups[projectKey] = [];
                }
                groups[projectKey].push(po);
              });

              const projectKeys = Object.keys(groups);

              if (projectKeys.length === 0) {
                return (
                  <div className="text-center h-48 border border-dashed border-border/60 rounded-xl bg-muted/5 flex flex-col items-center justify-center text-muted-foreground">
                    <FileText className="w-8 h-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm font-semibold">
                      Tidak ada data Purchase Order ditemukan
                    </p>
                  </div>
                );
              }

              // Client-side pagination for PO project accordions
              const paginatedProjectKeys = projectKeys.slice(
                (poPage - 1) * poLimit,
                poPage * poLimit,
              );

              return (
                <div className="space-y-4">
                  {/* Pagination Controls */}
                  <div className="flex flex-row items-center justify-between text-sm py-1 border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs whitespace-nowrap text-muted-foreground">
                        Show:
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
                      <span className="text-xs text-muted-foreground ml-2 font-medium">
                        Showing projects{" "}
                        {Math.min(
                          projectKeys.length,
                          (poPage - 1) * poLimit + 1,
                        )}{" "}
                        - {Math.min(projectKeys.length, poPage * poLimit)} of{" "}
                        {projectKeys.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 cursor-pointer rounded-lg border-border hover:bg-muted"
                        onClick={() =>
                          setPoPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={poPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-muted-foreground mx-2 text-xs font-semibold">
                        Page{" "}
                        <span className="font-bold text-muted-foreground">
                          {poPage}
                        </span>{" "}
                        of{" "}
                        <span className="font-bold text-muted-foreground">
                          {Math.ceil(projectKeys.length / poLimit) || 1}
                        </span>
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 cursor-pointer rounded-lg border-border hover:bg-muted"
                        onClick={() =>
                          setPoPage((prev) =>
                            Math.min(
                              Math.ceil(projectKeys.length / poLimit),
                              prev + 1,
                            ),
                          )
                        }
                        disabled={
                          poPage >= Math.ceil(projectKeys.length / poLimit)
                        }
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Accordion List */}
                  <div className="space-y-3">
                    {paginatedProjectKeys.map((projectKey, idx) => {
                      const absoluteIdx = (poPage - 1) * poLimit + idx;
                      const isExpanded = !!expandedPoProjects[projectKey];
                      const posInProject = groups[projectKey];

                      // Find project info from parent list
                      const matchingProject = projects.find(
                        (p) =>
                          p.projectName.toLowerCase() ===
                            projectKey.toLowerCase() ||
                          (p.projectNumber &&
                            p.projectNumber.toLowerCase() ===
                              projectKey.toLowerCase()),
                      );
                      const projectNumber =
                        matchingProject?.projectNumber || "-";
                      const customerName =
                        matchingProject?.customer?.name || "-";

                      const completedPos = posInProject.filter(
                        (po: any) => po.isReceived || po.status === "RECEIVED",
                      ).length;
                      const totalPos = posInProject.length;

                      return (
                        <div
                          key={projectKey}
                          className={cn(
                            "border border-border/60 rounded-2xl bg-card overflow-hidden transition-all",
                            isExpanded
                              ? "shadow-md ring-1 ring-primary/10"
                              : "shadow-xs hover:border-border",
                          )}
                        >
                          {/* Project Header (Accordion Trigger) */}
                          <div
                            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-muted/5 transition-colors select-none"
                            onClick={() => {
                              setExpandedPoProjects((prev) => ({
                                ...prev,
                                [projectKey]: !prev[projectKey],
                              }));
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-foreground mr-1">
                                  {absoluteIdx + 1}.
                                </span>
                                <span className="text-xs font-semibold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                                  {projectNumber}
                                </span>
                                <h3 className="text-xs font-semibold text-foreground">
                                  {projectKey}
                                </h3>
                                {/* {matchingProject?.status && (
                                  <Badge
                                    className={cn(
                                      "text-xs font-semibold rounded-full shadow-none border",
                                      getProjectStatusColor(matchingProject.status),
                                    )}
                                  >
                                    {getProjectStatusLabel(matchingProject.status)}
                                  </Badge>
                                )} */}
                              </div>
                              <p className="text-xs text-muted-foreground font-semibold mt-1 ml-6">
                                Customer: {customerName}
                              </p>
                            </div>

                            {/* Stats and Accordion Toggle inside header, without progress bar */}
                            <div className="flex items-center gap-4 shrink-0 ml-auto">
                              <Badge
                                className={cn(
                                  "text-[10px] font-bold rounded-lg border-none shadow-none px-2.5 py-1",
                                  completedPos === totalPos
                                    ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400"
                                    : "bg-orange-500/10 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400",
                                )}
                              >
                                {completedPos}/{totalPos} PO Selesai
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground shrink-0 rounded-lg"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4.5 h-4.5" />
                                ) : (
                                  <ChevronDown className="w-4.5 h-4.5" />
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Accordion Content (Table list of POs under this project) */}
                          {isExpanded && (
                            <div className="border-t border-border/40 overflow-x-auto bg-muted/5 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                              <Table className="w-full text-xs">
                                <TableHeader>
                                  <TableRow className="bg-muted/20">
                                    <TableHead className="w-12 text-center">
                                      No
                                    </TableHead>
                                    <TableHead className="w-40 font-semibold">
                                      Nomor PO
                                    </TableHead>
                                    <TableHead className="w-32">
                                      Tanggal PO
                                    </TableHead>
                                    <TableHead className="w-48">
                                      Supplier (Kepada)
                                    </TableHead>
                                    <TableHead className="w-24 text-center">
                                      Total Items
                                    </TableHead>
                                    <TableHead className="w-32 text-center">
                                      Status PO
                                    </TableHead>
                                    <TableHead className="w-32 text-center">
                                      Payment Status
                                    </TableHead>
                                    <TableHead className="w-16 text-right">
                                      Aksi
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {posInProject.map((po, poIdx) => (
                                    <TableRow
                                      key={po.id}
                                      className="hover:bg-muted/10 transition-colors"
                                    >
                                      <TableCell className="text-center font-bold text-muted-foreground">
                                        {poIdx + 1}
                                      </TableCell>
                                      <TableCell className="font-bold text-primary">
                                        {po.nomorPO}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground font-medium">
                                        {format(
                                          new Date(po.tanggal),
                                          "dd MMM yyyy",
                                        )}
                                      </TableCell>
                                      <TableCell className="font-semibold text-foreground">
                                        {po.kepada}
                                      </TableCell>
                                      <TableCell className="text-center font-bold text-zinc-600 dark:text-zinc-400">
                                        {po.items.length} Item
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Badge
                                          className={cn(
                                            "font-semibold text-[10px] px-2 py-0.5 rounded border shadow-none",
                                            getPOStatusColor(po.status),
                                          )}
                                          variant="outline"
                                        >
                                          {getPOStatusLabel(po.status)}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Badge
                                          className={cn(
                                            "font-semibold text-[10px] px-2 py-0.5 rounded border shadow-none",
                                            po.paymentStatus === "PAID"
                                              ? "bg-green-500/10 text-green-700 border-green-500/20"
                                              : po.paymentStatus === "PARTIAL"
                                                ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                                                : "bg-red-500/10 text-red-700 border-red-500/20",
                                          )}
                                          variant="outline"
                                        >
                                          {po.paymentStatus === "PAID"
                                            ? "Lunas"
                                            : po.paymentStatus === "PARTIAL"
                                              ? "Dibayar Sebagian"
                                              : "Belum Lunas"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-primary rounded-lg"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedDetailPO(po);
                                          }}
                                        >
                                          <Eye className="w-4 h-4" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
        {activeTab === "spb" && (
          <div className="space-y-4">
            {/* Search and stats bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 md:max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Cari proyek, nomor SPB, atau material..."
                  className="pl-9 w-full shadow-none bg-background rounded-md border-border h-9 text-sm"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <div className="text-xs text-muted-foreground font-semibold">
                Total Proyek:{" "}
                {projects.filter((p) => p.spb && p.spb.length > 0).length}
              </div>
            </div>

            <div className="flex flex-row items-center justify-between text-sm py-1 border-b border-border/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-xs whitespace-nowrap text-muted-foreground">
                  Show:
                </span>
                <select
                  value={currentLimit}
                  onChange={(e) =>
                    updateQuery({ limit: e.target.value, page: "1" })
                  }
                  className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer text-foreground font-semibold"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-xs text-muted-foreground ml-2 font-medium">
                  Showing projects{" "}
                  {Math.min(
                    meta?.totalCount || 0,
                    (currentPage - 1) * currentLimit + 1,
                  )}{" "}
                  -{" "}
                  {Math.min(meta?.totalCount || 0, currentPage * currentLimit)}{" "}
                  of {meta?.totalCount || 0}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 cursor-pointer rounded-lg border-border hover:bg-muted"
                  onClick={() => updateQuery({ page: String(currentPage - 1) })}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-muted-foreground mx-2 text-xs font-semibold">
                  Page{" "}
                  <span className="font-bold text-muted-foreground">
                    {currentPage}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-muted-foreground">
                    {meta?.totalPages || 1}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 cursor-pointer rounded-lg border-border hover:bg-muted"
                  onClick={() => updateQuery({ page: String(currentPage + 1) })}
                  disabled={currentPage >= (meta?.totalPages || 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Project accordion list */}
            {(() => {
              const spbProjects = projects.filter((project) => {
                // Keep projects that have SPB records
                if (!project.spb || project.spb.length === 0) return false;

                const q = searchInput.toLowerCase();
                return (
                  project.projectName.toLowerCase().includes(q) ||
                  (project.projectNumber || "").toLowerCase().includes(q) ||
                  (project.customer?.name || "").toLowerCase().includes(q) ||
                  project.spb.some(
                    (s: any) =>
                      s.spbNumber.toLowerCase().includes(q) ||
                      s.items.some((it: any) =>
                        it.name.toLowerCase().includes(q),
                      ),
                  )
                );
              });

              if (spbProjects.length === 0) {
                return (
                  <div className="text-center h-48 border border-dashed border-border/60 rounded-xl bg-muted/5 flex flex-col items-center justify-center text-muted-foreground">
                    <FileText className="w-8 h-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm font-semibold">
                      Tidak ada data SPB ditemukan
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Silakan buat SPB terlebih dahulu melalui menu proyek.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {spbProjects.map((project, idx) => {
                    const isExpanded = !!expandedProjects[project.id];

                    // Calculate totals & progress across all SPBs for this project
                    let totalItems = 0;
                    let completedItems = 0;
                    project.spb.forEach((s: any) => {
                      s.items.forEach((it: any) => {
                        totalItems++;
                        if (
                          it.status === "FULFILLED" ||
                          it.status === "RECEIVED"
                        ) {
                          completedItems++;
                        }
                      });
                    });

                    const progressPercent =
                      totalItems > 0
                        ? Math.round((completedItems / totalItems) * 100)
                        : 0;

                    return (
                      <div
                        key={project.id}
                        className={cn(
                          "border border-border/60 rounded-2xl bg-card overflow-hidden transition-all",
                          isExpanded
                            ? "shadow-md ring-1 ring-primary/10"
                            : "shadow-xs hover:border-border",
                        )}
                      >
                        {/* Project Header (Accordion Trigger) */}
                        <div
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-muted/5 transition-colors select-none"
                          onClick={() => {
                            setExpandedProjects((prev) => ({
                              ...prev,
                              [project.id]: !prev[project.id],
                            }));
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-foreground mr-1">
                                {idx + 1 + (currentPage - 1) * currentLimit}.
                              </span>
                              <span className="text-xs font-semibold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                                {project.projectNumber || "-"}
                              </span>
                              <h3 className="text-xs font-bold text-foreground">
                                {project.projectName}
                              </h3>
                              <Badge
                                className={cn(
                                  "text-xs font-semibold rounded-full shadow-none border",
                                  getProjectStatusColor(project.status),
                                )}
                              >
                                {getProjectStatusLabel(project.status)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground font-semibold mt-1">
                              Customer: {project.customer?.name || "-"}
                            </p>
                          </div>

                          {/* Stats and Progress bar inside header */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:w-64">
                            <div className="flex-1">
                              <div className="flex justify-between items-center text-xs font-semibold">
                                <span className="text-muted-foreground">
                                  Kesiapan Material
                                </span>
                                <span className="font-semibold text-muted-foreground">
                                  {completedItems}/{totalItems} Item (
                                  {progressPercent}%)
                                </span>
                              </div>
                              <div className="w-full bg-muted border border-border/30 h-1.5 rounded-full overflow-hidden mt-1">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    progressPercent === 100
                                      ? "bg-emerald-500"
                                      : "bg-primary",
                                  )}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground shrink-0 rounded-lg"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Accordion Content (SPB Documents list) */}
                        {isExpanded && (
                          <div className="border-t border-border/50 bg-muted/5 p-4 space-y-3 animate-in fade-in duration-200">
                            {project.spb.map((spb: any) => {
                              const totalSpbItems = spb.items.length;
                              const completedSpbItems = spb.items.filter(
                                (it: any) =>
                                  it.status === "FULFILLED" ||
                                  it.status === "RECEIVED",
                              ).length;
                              const isSpbCompleted =
                                completedSpbItems === totalSpbItems;

                              return (
                                <div
                                  key={spb.id}
                                  className="flex items-center justify-between gap-4 p-3.5 border border-border/40 rounded-xl bg-background hover:border-border/80 transition-colors shadow-none"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600 border border-orange-500/20 shrink-0">
                                      <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="text-xs font-bold text-foreground truncate">
                                        {spb.spbNumber}
                                      </h4>
                                      <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                                        Tanggal:{" "}
                                        {format(
                                          new Date(spb.date),
                                          "dd MMM yyyy",
                                        )}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {spb.status === "REJECTED" &&
                                      spb.rejectedReason && (
                                        <span
                                          className="text-[10px] text-red-500 font-semibold italic max-w-[120px] truncate"
                                          title={spb.rejectedReason}
                                        >
                                          Alasan: {spb.rejectedReason}
                                        </span>
                                      )}
                                    <Badge
                                      className={cn(
                                        "text-[10px] font-semibold rounded-lg border-none shadow-none px-2 py-0.5",
                                        getSpbStatusColor(spb.status),
                                      )}
                                    >
                                      {getSpbStatusLabel(spb.status)}
                                    </Badge>
                                    <Badge
                                      className={cn(
                                        "text-[10px] font-semibold rounded-lg border-none shadow-none px-2 py-0.5",
                                        isSpbCompleted
                                          ? "bg-emerald-500/10 text-emerald-600"
                                          : "bg-orange-500/10 text-orange-600",
                                      )}
                                    >
                                      {completedSpbItems}/{totalSpbItems} Item
                                      Diproses
                                    </Badge>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSelectedDetailSpb(spb)}
                                      className="h-7 text-xs font-semibold px-2.5 gap-1 cursor-pointer border-border/80 hover:bg-orange-500/5 hover:text-orange-600 hover:border-orange-500/20 rounded-lg shadow-none"
                                    >
                                      <Eye className="w-3 h-3" /> Detail
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}{" "}
        {/* Dialog Detail Barang SPB */}
        <Dialog
          open={!!selectedDetailSpb}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedDetailSpb(null);
              setSpbSearchQuery("");
            }
          }}
        >
          <DialogContent className="sm:max-w-[900px] max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-border shadow-2xl">
            <DialogHeader className="p-6 pb-4 shrink-0 border-b border-border/50">
              <div className="flex items-center justify-between w-full pr-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600 border border-orange-500/20 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-foreground">
                      {selectedDetailSpb?.spbNumber}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground font-medium mt-0.5">
                      Tanggal Dibuat:{" "}
                      {selectedDetailSpb &&
                        format(
                          new Date(selectedDetailSpb.date),
                          "dd MMMM yyyy",
                        )}
                    </DialogDescription>
                    {selectedDetailSpb?.status === "REJECTED" &&
                      selectedDetailSpb.rejectedReason && (
                        <div className="text-xs text-red-500 font-semibold mt-1">
                          Alasan Ditolak: {selectedDetailSpb.rejectedReason}
                        </div>
                      )}
                  </div>
                </div>
                {selectedDetailSpb?.status && (
                  <Badge
                    className={cn(
                      "text-[10px] font-bold rounded-lg border-none shadow-none px-2.5 py-1",
                      getSpbStatusColor(selectedDetailSpb.status),
                    )}
                  >
                    {getSpbStatusLabel(selectedDetailSpb.status)}
                  </Badge>
                )}
              </div>
            </DialogHeader>

            {/* Search Bar */}
            <div className="px-6 py-3.5 shrink-0 bg-muted/10 border-b border-border/30 flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cari nama barang..."
                  value={spbSearchQuery}
                  onChange={(e) => setSpbSearchQuery(e.target.value)}
                  className="pl-9 pr-9 h-9 text-xs rounded-xl bg-background border-border"
                />
                {spbSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setSpbSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-muted-foreground/60 hover:text-foreground cursor-pointer rounded-full hover:bg-muted/80 active:scale-95 transition-all"
                    title="Bersihkan pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* SPB Items Table inside the Dialog */}
            <div className="flex-1 overflow-y-auto p-6 bg-muted/5">
              <div className="border border-border/40 rounded-xl overflow-x-auto shadow-xs bg-card">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/30 text-xs font-semibold text-muted-foreground border-b border-border/30">
                      <th className="px-4 py-3 w-12 text-center">No</th>
                      <th className="px-4 py-3 w-[120px]">Kode Barang</th>
                      <th className="px-4 py-3">Nama Barang</th>
                      <th className="px-4 py-3 text-center w-24">Kuantitas</th>
                      <th className="px-4 py-3 text-center w-24">Sumber</th>
                      <th className="px-4 py-3 text-center w-32">Status SPB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered =
                        selectedDetailSpb?.items.filter((it: any) => {
                          const q = spbSearchQuery.toLowerCase();
                          return (
                            it.name.toLowerCase().includes(q) ||
                            (it.material?.code &&
                              it.material.code.toLowerCase().includes(q)) ||
                            (it.typeMerk &&
                              it.typeMerk.toLowerCase().includes(q))
                          );
                        }) || [];

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td
                              colSpan={6}
                              className="p-8 text-center text-muted-foreground italic"
                            >
                              Tidak ada barang yang cocok dengan kata kunci
                              pencarian.
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map((it: any, idx: number) => {
                        return (
                          <tr
                            key={it.id}
                            className="border-b border-border/10 hover:bg-muted/5 transition-colors last:border-0"
                          >
                            <td className="px-4 py-3 text-center text-foreground font-bold">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3 font-semibold text-primary">
                              {it.material?.code || "-"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-foreground">
                                {it.name}
                              </div>
                              {it.typeMerk && (
                                <div className="text-[10px] font-medium text-muted-foreground mt-0.5">
                                  Merk/Tipe: {it.typeMerk}
                                </div>
                              )}
                              {it.note && (
                                <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                                  Catatan: {it.note}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-primary">
                              {it.qty} {it.unit}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge
                                className={cn(
                                  "text-[10px] font-bold rounded border-none shadow-none px-2 py-0.5",
                                  it.source === "WAREHOUSE"
                                    ? "bg-blue-500/10 text-blue-600"
                                    : "bg-orange-500/10 text-orange-600",
                                )}
                              >
                                {it.source === "WAREHOUSE"
                                  ? "GUDANG"
                                  : "TRADING"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={cn(
                                  "text-[10px] font-bold px-2 py-0.5 rounded border inline-block",
                                  it.status === "FULFILLED" ||
                                    it.status === "RECEIVED"
                                    ? "bg-emerald-500/5 text-emerald-600 border-emerald-500/10"
                                    : it.status === "REJECTED"
                                      ? "bg-red-500/5 text-red-600 border-red-500/10"
                                      : "bg-amber-500/5 text-amber-600 border-amber-500/10",
                                )}
                              >
                                {it.status === "FULFILLED"
                                  ? "Terpenuhi"
                                  : it.status === "RECEIVED"
                                    ? "Diterima"
                                    : it.status === "PENDING"
                                      ? "Pending"
                                      : it.status === "APPROVED_WAREHOUSE"
                                        ? "Disetujui Gudang"
                                        : it.status === "PO_PENDING"
                                          ? "Menunggu PO"
                                          : it.status === "PO_CREATED"
                                            ? "PO DIBUAT"
                                            : it.status}
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter className="p-4 bg-muted/10 border-t border-border/10 shrink-0 mx-0 mb-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDetailSpb(null)}
                className="cursor-pointer font-semibold"
              >
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Dialog Detail Purchase Order (PO) */}
        <Dialog
          open={!!selectedDetailPO}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedDetailPO(null);
              setPoItemSearch("");
            }
          }}
        >
          <DialogContent className="sm:max-w-[850px] max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-border shadow-2xl">
            <DialogHeader className="p-6 pb-4 shrink-0 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-foreground">
                      Detail Purchase Order: {selectedDetailPO?.nomorPO}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground font-medium mt-0.5">
                      Supplier:{" "}
                      <strong className="text-foreground">
                        {selectedDetailPO?.kepada}
                      </strong>{" "}
                      | Tanggal:{" "}
                      {selectedDetailPO &&
                        format(
                          new Date(selectedDetailPO.tanggal),
                          "dd MMMM yyyy",
                        )}
                    </DialogDescription>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 pr-6">
                  {selectedDetailPO?.status && (
                    <Badge
                      className={cn(
                        "font-black text-[9px] px-2 py-0.5 rounded border shadow-none",
                        getPOStatusColor(selectedDetailPO.status),
                      )}
                      variant="outline"
                    >
                      PO Status: {getPOStatusLabel(selectedDetailPO.status)}
                    </Badge>
                  )}
                  {selectedDetailPO?.paymentStatus && (
                    <Badge
                      className={cn(
                        "font-black text-[9px] px-2 py-0.5 rounded border shadow-none",
                        selectedDetailPO.paymentStatus === "PAID"
                          ? "bg-green-500/10 text-green-700 border-green-500/20"
                          : selectedDetailPO.paymentStatus === "PARTIAL"
                            ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                            : "bg-red-500/10 text-red-700 border-red-500/20",
                      )}
                      variant="outline"
                    >
                      Payment Status:{" "}
                      {selectedDetailPO.paymentStatus === "PAID"
                        ? "Lunas"
                        : selectedDetailPO.paymentStatus === "PARTIAL"
                          ? "Dibayar Sebagian"
                          : "Belum Lunas"}
                    </Badge>
                  )}
                </div>
              </div>
            </DialogHeader>

            {/* Search Bar inside PO detail */}
            <div className="px-6 py-3.5 shrink-0 bg-muted/10 border-b border-border/30 flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cari barang atau No SPB..."
                  value={poItemSearch}
                  onChange={(e) => setPoItemSearch(e.target.value)}
                  className="pl-9 pr-9 h-9 text-xs rounded-xl bg-background border-border"
                />
                {poItemSearch && (
                  <button
                    type="button"
                    onClick={() => setPoItemSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-muted-foreground/60 hover:text-foreground cursor-pointer rounded-full hover:bg-muted/80 active:scale-95 transition-all"
                    title="Bersihkan pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {selectedDetailPO?.totalAmount && (
                <div className="text-xs text-muted-foreground font-semibold">
                  Total Nilai PO:{" "}
                  <strong className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                    {"Rp " +
                      Number(selectedDetailPO.totalAmount).toLocaleString(
                        "id-ID",
                      )}
                  </strong>
                </div>
              )}
            </div>

            {/* Table of PO Items */}
            <div className="flex-1 overflow-y-auto p-6 bg-muted/5">
              <div className="border border-border/40 rounded-xl overflow-x-auto shadow-xs bg-card">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/30 text-xs font-semibold text-muted-foreground border-b border-border/30">
                      <th className="p-3 w-12 text-center">No</th>
                      <th className="p-3">Nama / Kode Barang</th>
                      <th className="p-3 w-48">Kuantitas</th>
                      <th className="p-3 text-center w-36">No SPB Asal</th>
                      <th className="p-3 text-center w-28">Status Item</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const q = poItemSearch.toLowerCase();
                      const filtered =
                        selectedDetailPO?.items.filter((it: any) => {
                          return (
                            it.namaBarang.toLowerCase().includes(q) ||
                            (it.kode && it.kode.toLowerCase().includes(q)) ||
                            (it.noSpb && it.noSpb.toLowerCase().includes(q))
                          );
                        }) || [];

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td
                              colSpan={5}
                              className="p-8 text-center text-muted-foreground italic"
                            >
                              Tidak ada barang yang cocok dengan kata kunci
                              pencarian.
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map((it: any, idx: number) => {
                        const remaining = Math.max(0, it.qty - it.qtyReceived);
                        const isClosed = it.isClosed || remaining === 0;
                        return (
                          <tr
                            key={it.id}
                            className="border-b border-border/10 hover:bg-muted/5 transition-colors last:border-0"
                          >
                            <td className="px-4 py-3 text-center text-foreground font-bold">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-foreground">
                                {it.namaBarang}
                              </div>
                              {it.kode && (
                                <div className="text-[10px] text-primary font-bold mt-0.5">
                                  {it.kode}
                                </div>
                              )}
                              {it.noticeMerkJenis && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  Merk/Jenis: {it.noticeMerkJenis}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1 text-[11px] font-medium text-foreground">
                                <div>
                                  <span className="text-muted-foreground">
                                    QTY PO:
                                  </span>{" "}
                                  <span className="font-semibold">
                                    {it.qty} {it.satuan}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    QTY Diterima:
                                  </span>{" "}
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                    {it.qtyReceived} {it.satuan}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    QTY Sisa:
                                  </span>{" "}
                                  <span className="font-bold text-orange-600 dark:text-orange-400">
                                    {remaining} {it.satuan}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {(() => {
                                const spbList = it.noSpb
                                  ? it.noSpb
                                      .split(",")
                                      .map((s: string) => s.trim())
                                      .filter(Boolean)
                                  : [];
                                if (spbList.length === 0) {
                                  return (
                                    <span className="text-muted-foreground">
                                      -
                                    </span>
                                  );
                                }
                                return (
                                  <div className="flex flex-col gap-1 items-center">
                                    {spbList.map((spbNum: string) => (
                                      <button
                                        key={spbNum}
                                        onClick={() => {
                                          setSelectedDetailPO(null);
                                          findSpbAndOpen(spbNum);
                                        }}
                                        className="text-xs font-bold text-primary hover:underline hover:text-primary/80 transition-colors cursor-pointer bg-transparent border-none p-0"
                                      >
                                        {spbNum}
                                      </button>
                                    ))}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge
                                className={cn(
                                  "text-[9px] font-black rounded border shadow-none px-2 py-0.5",
                                  isClosed
                                    ? "bg-green-500/10 text-green-700 border-green-500/20"
                                    : "bg-amber-500/10 text-amber-700 border-amber-500/20",
                                )}
                                variant="outline"
                              >
                                {isClosed ? "Selesai" : "Pending"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter className="p-4 bg-muted/10 border-t border-border/10 shrink-0 mx-0 mb-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDetailPO(null)}
                className="cursor-pointer font-semibold"
              >
                Tutup
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
            trigger={null}
          />
        )}
        {/* Project Detail Dialog */}
        <ProjectDetailDialog
          data={detailProject}
          open={!!detailProject}
          onOpenChange={(open) => !open && setDetailProject(null)}
          type="PROJECT"
          showValue={false}
        />
        {/* Confirmation Dialog */}
        <Dialog
          open={confirmDialog?.show || false}
          onOpenChange={(open) => {
            if (!open) {
              setConfirmDialog(null);
              setRevisionNotes("");
            }
          }}
        >
          <DialogContent
            className={cn(
              "sm:max-w-[600px]",
              confirmDialog?.type === "handover" &&
                confirmDialog?.division === "PRODUCTION" &&
                "sm:max-w-[600px]",
            )}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {confirmDialog?.type === "return" ? (
                  <RotateCcw className="w-5 h-5 text-red-500" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                )}
                {confirmDialog?.title}
              </DialogTitle>
              <DialogDescription className="py-2">
                {confirmDialog?.description}
              </DialogDescription>
            </DialogHeader>

            {confirmDialog?.type === "return" && (
              <div className="space-y-2 my-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Catatan / Alasan Revisi{" "}
                  <span className="text-red-600">*</span>
                </label>
                <Textarea
                  placeholder="Masukkan alasan pengembalian untuk revisi..."
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  className="text-xs min-h-[80px]"
                  required
                />
              </div>
            )}

            {confirmDialog?.type === "handover" &&
              confirmDialog?.division === "PRODUCTION" && (
                <div className="space-y-3 my-3">
                  <label className="text-sm font-semibold text-muted-foreground block">
                    Status Kesiapan Material (SPB)
                  </label>

                  {isLoadingSpb ? (
                    <div className="flex items-center justify-center py-6 border border-border/40 rounded-xl bg-muted/10">
                      <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
                      <span className="text-xs text-muted-foreground font-medium">
                        Memuat status material...
                      </span>
                    </div>
                  ) : dialogSpbList.length === 0 ? (
                    <div className="p-3 text-center border border-border/40 rounded-xl bg-muted/10">
                      <p className="text-xs text-muted-foreground font-medium">
                        Tidak ada SPB terdaftar untuk proyek ini.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[160px] overflow-y-auto border border-border/40 rounded-xl p-2.5 bg-muted/10 space-y-3">
                      {dialogSpbList.map((spb) => (
                        <div
                          key={spb.dbId}
                          className="space-y-1.5 border-b border-border/30 pb-2 last:border-b-0 last:pb-0"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-foreground">
                              {spb.id}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">
                              {spb.date}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {spb.items.map((item: any, idx: number) => {
                              const getStatusStyle = (status: string) => {
                                const s = status.toUpperCase();
                                if (s === "FULFILLED" || s === "RECEIVED") {
                                  return "bg-green-500/10 text-green-700 border-green-500/20";
                                }
                                if (
                                  s === "PENDING" ||
                                  s === "WAITING_PO" ||
                                  s === "PARTIALLY_ISSUED"
                                ) {
                                  return "bg-amber-500/10 text-amber-700 border-amber-500/20";
                                }
                                if (s === "REJECTED") {
                                  return "bg-red-500/10 text-red-700 border-red-500/20";
                                }
                                return "bg-blue-500/10 text-blue-700 border-blue-500/20";
                              };

                              const getStatusLabel = (status: string) => {
                                const s = status.toUpperCase();
                                switch (s) {
                                  case "PENDING":
                                    return "Menunggu Verifikasi";
                                  case "APPROVED":
                                    return "Disetujui Gudang";
                                  case "PREPARING":
                                    return "Sedang Disiapkan";
                                  case "FULFILLED":
                                    return "Sudah Dikeluarkan";
                                  case "WAITING_PO":
                                    return "Menunggu PO";
                                  case "PO_CREATED":
                                    return "PO Dibuat";
                                  case "RECEIVED":
                                    return "Barang Diterima";
                                  case "REJECTED":
                                    return "Ditolak";
                                  case "PARTIALLY_ISSUED":
                                    return "Diproses Sebagian";
                                  default:
                                    return status;
                                }
                              };

                              return (
                                <div
                                  key={idx}
                                  className="flex justify-between items-center text-xs font-medium pl-1.5 border-l border-border/50"
                                >
                                  <span className="text-muted-foreground truncate">
                                    {item.name} ({item.qty} {item.unit})
                                  </span>
                                  <span
                                    className={cn(
                                      "px-1.5 py-0.5 rounded-[4px] text-[9px] font-black border",
                                      getStatusStyle(item.status),
                                    )}
                                  >
                                    {getStatusLabel(item.status)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Validation Checkboxes */}
                  <div className="space-y-3 pt-2 border-t border-border/40">
                    <div className="flex items-start space-x-2.5">
                      <Checkbox
                        id="chk-valid-1"
                        checked={isChecked1}
                        onCheckedChange={(checked) => setIsChecked1(!!checked)}
                        className="mt-0.5 border border-gray-500"
                      />
                      <label
                        htmlFor="chk-valid-1"
                        className="text-xs text-muted-foreground font-medium cursor-pointer select-none leading-normal"
                      >
                        Saya telah memeriksa detail status kesiapan material
                        (SPB) di atas.
                      </label>
                    </div>
                    <div className="flex items-start space-x-2.5">
                      <Checkbox
                        id="chk-valid-2"
                        checked={isChecked2}
                        onCheckedChange={(checked) => setIsChecked2(!!checked)}
                        className="mt-0.5 border border-gray-500"
                      />
                      <label
                        htmlFor="chk-valid-2"
                        className="text-xs text-muted-foreground font-medium cursor-pointer select-none leading-normal"
                      >
                        Saya memahami produksi dapat berjalan dengan material
                        yang tersedia saat ini.
                      </label>
                    </div>
                    <div className="flex items-start space-x-2.5">
                      <Checkbox
                        id="chk-valid-3"
                        checked={isChecked3}
                        onCheckedChange={(checked) => setIsChecked3(!!checked)}
                        className="mt-0.5 border border-gray-500"
                      />
                      <label
                        htmlFor="chk-valid-3"
                        className="text-xs text-muted-foreground font-medium cursor-pointer select-none leading-normal"
                      >
                        Saya menyetujui serah terima proyek ini sepenuhnya ke
                        bagian Produksi.
                      </label>
                    </div>
                  </div>
                </div>
              )}

            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDialog(null)}
                disabled={isPending}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant={
                  confirmDialog?.type === "return" ? "destructive" : "default"
                }
                size="sm"
                className="cursor-pointer"
                onClick={() =>
                  confirmDialog &&
                  handleStatusUpdate(
                    confirmDialog.projectId,
                    confirmDialog.status,
                    confirmDialog.division,
                    confirmDialog.type === "return"
                      ? `PPIC: Returned for Revision - ${revisionNotes}`
                      : confirmDialog.notes,
                  )
                }
                disabled={
                  isPending ||
                  (confirmDialog?.type === "return" && !revisionNotes.trim()) ||
                  (confirmDialog?.type === "handover" &&
                    confirmDialog?.division === "PRODUCTION" &&
                    (!isChecked1 || !isChecked2 || !isChecked3))
                }
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Confirm Action"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ProjectHistoryDialog
          project={historyProject}
          open={!!historyProject}
          onOpenChange={(open) => !open && setHistoryProject(null)}
        />
        <CreateSPBDialog
          project={spbProject}
          open={!!spbProject}
          onOpenChange={(open) => !open && setSpbProject(null)}
        />
        {/* Dialog Monitoring Shipping Eksekusi */}
        <Dialog
          open={!!shippingProject}
          onOpenChange={(open) => !open && setShippingProject(null)}
        >
          <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <Truck className="w-5 h-5 text-blue-600" />
                Monitoring Eksekusi Shipping (Conveyor)
              </DialogTitle>
              <DialogDescription>
                Detail surat jalan, status armada, dan paket conveyor jadi yang
                dikirim untuk proyek <b>{shippingProject?.projectName}</b>.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-4">
              {isLoadingShipping ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground font-medium">
                    Memuat status pengiriman barang...
                  </span>
                </div>
              ) : shipmentsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground bg-muted/10 border border-dashed rounded-xl">
                  <Package className="w-10 h-10 opacity-30" />
                  <p className="text-sm font-medium">
                    Belum ada pengiriman (Surat Jalan) untuk proyek ini.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {shipmentsList.map((shipment) => (
                    <div
                      key={shipment.id}
                      className="border border-border rounded-xl p-4 bg-muted/5 space-y-4 shadow-xs"
                    >
                      {/* Header Surat Jalan */}
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 pb-3 border-b border-border/40">
                        <div className="space-y-1">
                          <span className="text-sm font-semibold text-primary">
                            Surat Jalan
                          </span>
                          <h4 className="text-sm font-bold text-blue-700 font-mono">
                            {shipment.suratJalanNo}
                          </h4>
                          <p className="text-[11px] text-muted-foreground font-semibold">
                            Tanggal Kirim:{" "}
                            {format(
                              new Date(shipment.deliveryDate),
                              "dd MMM yyyy",
                            )}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {/* Status Pengiriman */}
                          <Badge
                            className={cn(
                              "font-black text-[10px] px-2 py-0.5 rounded border shadow-none",
                              shipment.status === "DELIVERED"
                                ? "bg-green-500/10 text-green-700 border-green-500/20"
                                : shipment.status === "IN_DELIVERY"
                                  ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                                  : shipment.status === "RETUR"
                                    ? "bg-red-500/10 text-red-700 border-red-500/20"
                                    : "bg-blue-500/10 text-blue-700 border-blue-500/20",
                            )}
                            variant="outline"
                          >
                            {shipment.status === "READY_TO_SHIP"
                              ? "Siap Dikirim"
                              : shipment.status === "IN_DELIVERY"
                                ? "Dalam Perjalanan"
                                : shipment.status === "DELIVERED"
                                  ? "Terkirim"
                                  : shipment.status === "RETUR"
                                    ? "Retur"
                                    : shipment.status}
                          </Badge>

                          {/* Metode Pengiriman */}
                          <span className="text-[10px] font-semibold text-muted-foreground bg-muted border px-1.5 py-0.5 rounded">
                            {shipment.shippingMethod === "INTERNAL_DELIVERY"
                              ? "Pengiriman Internal"
                              : "Ambil Sendiri"}
                          </span>
                        </div>
                      </div>

                      {/* Info Armada / Fleet */}
                      {shipment.shippingMethod === "INTERNAL_DELIVERY" && (
                        <div className="bg-background border border-border/40 p-3 rounded-lg space-y-2 text-xs">
                          <h5 className="font-bold text-foreground">
                            Informasi Armada
                          </h5>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-muted-foreground">
                                Driver:
                              </span>
                              <p className="font-semibold text-foreground">
                                {shipment.driverName}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Kendaraan:
                              </span>
                              <p className="font-semibold text-foreground">
                                {shipment.vehicleName} ({shipment.vehiclePlate})
                              </p>
                            </div>
                            <div className="col-span-2 border-t pt-1.5 mt-0.5 flex justify-between items-center">
                              <span className="text-muted-foreground">
                                Status Alokasi Armada:
                              </span>
                              <Badge
                                className={cn(
                                  "font-bold text-[9px] shadow-none",
                                  shipment.fleetRequestStatus === "CONFIRMED"
                                    ? "bg-green-100 text-green-700 border border-green-200/50"
                                    : "bg-amber-100 text-amber-700 border border-amber-200/50",
                                )}
                                variant="secondary"
                              >
                                {shipment.fleetRequestStatus === "CONFIRMED"
                                  ? "Armada Ditugaskan"
                                  : "Menunggu Armada"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Detail Paket / Markings */}
                      <div className="space-y-2">
                        <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-blue-600" />
                          Detail Paket (Marking Conveyor)
                        </h5>
                        <div className="space-y-2">
                          {shipment.packages.map((pkg: any) => (
                            <div
                              key={pkg.id}
                              className="bg-background border border-border/40 p-2.5 rounded-lg text-xs space-y-1.5"
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold text-foreground truncate">
                                    {pkg.itemName}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground font-semibold">
                                    Qty: {pkg.qty} {pkg.unit} • Lot:{" "}
                                    {pkg.lotNo || "-"}
                                  </p>
                                </div>
                                <Badge
                                  className={cn(
                                    "font-black text-[9px] px-1.5 py-0.5 rounded shadow-none",
                                    pkg.status === "SHIPPED"
                                      ? "bg-green-100 text-green-800 border border-green-200/50"
                                      : "bg-blue-100 text-blue-800 border border-blue-200/50",
                                  )}
                                  variant="secondary"
                                >
                                  {pkg.status === "SHIPPED"
                                    ? "SHIPPED / TERKIRIM"
                                    : "SIAP DIKIRIM"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 text-[10px] text-muted-foreground border-t border-dashed pt-1.5 gap-2">
                                <div>
                                  <span>Berat: </span>
                                  <span className="font-bold text-foreground">
                                    {pkg.weight || 0} Kg
                                  </span>
                                </div>
                                <div>
                                  <span>Dimensi: </span>
                                  <span className="font-bold text-foreground">
                                    {pkg.dimensions || "-"}
                                  </span>
                                </div>
                                <div className="col-span-2">
                                  <span>Kode Marking: </span>
                                  <span className="font-mono text-primary font-bold text-[9px]">
                                    {pkg.code}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Notes */}
                      {shipment.notes && (
                        <div className="text-[10px] text-muted-foreground bg-background p-2 rounded border border-dashed border-border italic">
                          Catatan Pengiriman: "{shipment.notes}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="mt-6">
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => setShippingProject(null)}
              >
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Dialog Monitoring SPB */}
        <Dialog
          open={!!spbMonitorProject}
          onOpenChange={(open) => !open && setSpbMonitorProject(null)}
        >
          <DialogContent className="sm:max-w-[650px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-2 shrink-0">
              <DialogTitle className="flex items-center gap-2 text-foreground text-lg font-bold">
                <ClipboardCheck className="w-5 h-5 text-orange-600 shrink-0" />
                Monitoring SPB (Surat Permintaan Barang)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Daftar dokumen permintaan barang, status alokasi, dan kesiapan
                material untuk proyek <b>{spbMonitorProject?.projectName}</b>.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {isLoadingSpbMonitor ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground font-medium">
                    Memuat status SPB proyek...
                  </span>
                </div>
              ) : spbMonitorHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground bg-muted/10 border border-dashed rounded-xl">
                  <FileText className="w-10 h-10 opacity-30" />
                  <p className="text-xs font-bold">
                    Belum ada dokumen SPB diterbitkan untuk proyek ini.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Top Stats Dashboard */}
                  {(() => {
                    const totalSpb = spbMonitorHistory.length;
                    let totalItems = 0;
                    let processedItems = 0;
                    let warehouseCount = 0;
                    let tradingCount = 0;

                    spbMonitorHistory.forEach((spb) => {
                      spb.items.forEach((it: any) => {
                        totalItems++;
                        if (
                          it.status === "FULFILLED" ||
                          it.status === "RECEIVED"
                        ) {
                          processedItems++;
                        }
                        if (it.source === "WAREHOUSE") {
                          warehouseCount++;
                        } else {
                          tradingCount++;
                        }
                      });
                    });

                    const progressPercent =
                      totalItems > 0
                        ? Math.round((processedItems / totalItems) * 100)
                        : 0;

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-muted/20 p-4 border border-border/40 rounded-2xl">
                        <div className="flex flex-col gap-1 justify-center">
                          <span className="text-xs text-muted-foreground font-semibold">
                            Total SPB
                          </span>
                          <span className="text-xl font-black text-foreground">
                            {totalSpb}{" "}
                            <span className="text-xs font-semibold text-muted-foreground">
                              Dokumen
                            </span>
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 justify-center">
                          <span className="text-xs text-muted-foreground font-semibold">
                            Sumber Material
                          </span>
                          <div className="flex gap-2 text-[10px] font-black mt-1">
                            <span className="text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-full">
                              {warehouseCount} Gudang
                            </span>
                            <span className="text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded-full">
                              {tradingCount} Trading
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 justify-center">
                          <div className="flex justify-between items-center text-xs font-semibold">
                            <span className="text-muted-foreground">
                              Kesiapan
                            </span>
                            <span className="font-bold text-primary">
                              {processedItems}/{totalItems} Item
                            </span>
                          </div>
                          <div className="w-full bg-muted border border-border/30 h-2 rounded-full overflow-hidden mt-1.5">
                            <div
                              className="bg-primary h-full rounded-full transition-all duration-500"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* List of SPB Documents */}
                  <div className="space-y-3">
                    {spbMonitorHistory.map((spb) => {
                      const spbProcessed = spb.items.filter(
                        (it: any) =>
                          it.status === "FULFILLED" || it.status === "RECEIVED",
                      ).length;
                      const spbTotal = spb.items.length;
                      const isAll = spbProcessed === spbTotal;
                      const isNone = spbProcessed === 0;

                      return (
                        <div
                          key={spb.id}
                          className="border border-border/50 rounded-2xl p-4 bg-background hover:shadow-xs transition-all space-y-4"
                        >
                          {/* SPB Document Header */}
                          <div
                            className="flex justify-between items-center cursor-pointer"
                            onClick={() => toggleSpbMonitor(spb.id)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-foreground font-mono">
                                  {spb.id}
                                </h4>
                                <Badge
                                  className={cn(
                                    "font-black text-[9px] px-2 py-0.5 rounded-full border shadow-none shrink-0",
                                    isAll
                                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                                      : isNone
                                        ? "bg-zinc-100 text-zinc-600 border-zinc-200"
                                        : "bg-blue-500/10 text-blue-700 border-blue-200",
                                  )}
                                  variant="outline"
                                >
                                  {spbProcessed}/{spbTotal} barang sudah
                                  diproses
                                </Badge>
                              </div>
                              <p className="text-[10px] text-muted-foreground font-semibold mt-1">
                                Diterbitkan: {spb.date}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg shrink-0"
                            >
                              {expandedSpbMonitorIds[spb.id] ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </Button>
                          </div>

                          {/* Expanded Table */}
                          {expandedSpbMonitorIds[spb.id] && (
                            <div className="border border-border/30 rounded-xl overflow-hidden mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                              <table className="w-full text-left text-xs bg-muted/5">
                                <thead>
                                  <tr className="bg-muted/30 text-[10px] font-bold text-muted-foreground border-b border-border/40">
                                    <th className="px-4 py-2.5 w-10">No</th>
                                    <th className="px-4 py-2.5">Material</th>
                                    <th className="px-4 py-2.5 text-center w-24">
                                      Qty
                                    </th>
                                    <th className="px-4 py-2.5 text-center w-36">
                                      Status
                                    </th>
                                    <th className="px-4 py-2.5 text-right w-24">
                                      Alokasi
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {spb.items.map((it: any, idx: number) => {
                                    const getStatusDetails = (
                                      status: string,
                                    ) => {
                                      const s = status.toUpperCase();
                                      if (
                                        s === "FULFILLED" ||
                                        s === "RECEIVED"
                                      ) {
                                        return {
                                          label:
                                            s === "FULFILLED"
                                              ? "Sudah Dikeluarkan"
                                              : "Barang Diterima",
                                          className:
                                            "bg-green-500/10 text-green-700 border-green-500/20",
                                        };
                                      }
                                      if (s === "PENDING") {
                                        return {
                                          label: "Menunggu Verifikasi",
                                          className:
                                            "bg-zinc-100 text-zinc-600 border-zinc-200",
                                        };
                                      }
                                      if (s === "REJECTED") {
                                        return {
                                          label: "Ditolak",
                                          className:
                                            "bg-red-500/10 text-red-700 border-red-500/20",
                                        };
                                      }
                                      if (s === "APPROVED_WAREHOUSE") {
                                        return {
                                          label: "Disetujui Gudang",
                                          className:
                                            "bg-sky-500/10 text-sky-700 border-sky-200",
                                        };
                                      }
                                      if (s === "PREPARING") {
                                        return {
                                          label: "Sedang Disiapkan",
                                          className:
                                            "bg-indigo-500/10 text-indigo-700 border-indigo-200",
                                        };
                                      }
                                      if (s === "PARTIALLY_ISSUED") {
                                        return {
                                          label: "Diproses Sebagian",
                                          className:
                                            "bg-orange-500/10 text-orange-700 border-orange-200",
                                        };
                                      }
                                      if (s === "PO_PENDING") {
                                        return {
                                          label: "Menunggu PO",
                                          className:
                                            "bg-amber-500/10 text-amber-700 border-amber-500/20",
                                        };
                                      }
                                      if (s === "PO_CREATED") {
                                        return {
                                          label: "PO Dibuat",
                                          className:
                                            "bg-blue-500/10 text-blue-700 border-blue-200",
                                        };
                                      }
                                      return {
                                        label: status,
                                        className:
                                          "bg-zinc-100 text-zinc-600 border-zinc-200",
                                      };
                                    };

                                    const { label, className } =
                                      getStatusDetails(it.status);

                                    return (
                                      <tr
                                        key={idx}
                                        className="border-b border-border/20 hover:bg-muted/10 transition-colors last:border-0"
                                      >
                                        <td className="px-4 py-3 font-bold text-muted-foreground text-center">
                                          {idx + 1}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-foreground">
                                          <div>
                                            <p className="flex items-center gap-1.5 flex-wrap">
                                              {it.source === "WAREHOUSE" &&
                                                it.materialCode && (
                                                  <span className="text-[9px] font-bold text-primary uppercase shrink-0">
                                                    [{it.materialCode}]
                                                  </span>
                                                )}
                                              <span className="font-bold text-foreground/80">
                                                {it.name}
                                              </span>
                                            </p>
                                            {it.typeMerk && (
                                              <p className="text-[9px] text-muted-foreground font-semibold mt-0.5">
                                                {it.typeMerk}
                                              </p>
                                            )}
                                            {it.note && (
                                              <p className="text-[10px] text-muted-foreground font-normal italic mt-1">
                                                Catatan: {it.note}
                                              </p>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-primary">
                                          {it.qty} {it.unit}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          <Badge
                                            className={cn(
                                              "text-[9px] font-black px-2 py-0.5 rounded-full border shadow-none",
                                              className,
                                            )}
                                          >
                                            {label}
                                          </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                          <Badge
                                            className={cn(
                                              "text-[9px] font-black px-2.5 py-0.5 rounded-full border-none shadow-none",
                                              it.source === "WAREHOUSE"
                                                ? "bg-blue-500/10 text-blue-600"
                                                : "bg-orange-500/10 text-orange-600",
                                            )}
                                          >
                                            {it.source === "WAREHOUSE"
                                              ? "GUDANG"
                                              : "TRADING"}
                                          </Badge>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="p-6 bg-muted/10 border-t border-border/50 shrink-0 mx-0 mb-0">
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer font-semibold text-xs"
                onClick={() => setSpbMonitorProject(null)}
              >
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Shipment Detail Dialog for PPIC global tracking */}
        <Dialog
          open={!!detailShipment}
          onOpenChange={(open) => !open && setDetailShipment(null)}
        >
          <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <Truck className="w-5 h-5 text-blue-600" />
                Detail Manifes Pengiriman
              </DialogTitle>
              <DialogDescription>
                Detail surat jalan, armada pengirim, dan paket barang jadi untuk
                proyek <b>{detailShipment?.projectName}</b>.
              </DialogDescription>
            </DialogHeader>

            {detailShipment && (
              <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-4">
                <div className="border border-border rounded-xl p-4 bg-muted/5 space-y-4 shadow-xs">
                  {/* Header Surat Jalan */}
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 pb-3 border-b border-border/40">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-primary">
                        Surat Jalan
                      </span>
                      <h4 className="text-sm font-bold text-blue-700 font-mono">
                        {detailShipment.suratJalanNo}
                      </h4>
                      <p className="text-[11px] text-muted-foreground font-semibold">
                        Tanggal Kirim:{" "}
                        {format(
                          new Date(detailShipment.deliveryDate),
                          "dd MMM yyyy",
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Badge
                        className={cn(
                          "font-black text-[10px] px-2 py-0.5 rounded border shadow-none",
                          detailShipment.status === "DELIVERED"
                            ? "bg-green-500/10 text-green-700 border-green-500/20"
                            : detailShipment.status === "IN_DELIVERY"
                              ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                              : detailShipment.status === "RETUR"
                                ? "bg-red-500/10 text-red-700 border-red-500/20"
                                : "bg-blue-500/10 text-blue-700 border-blue-500/20",
                        )}
                        variant="outline"
                      >
                        {detailShipment.status === "READY_TO_SHIP"
                          ? "Siap Dikirim"
                          : detailShipment.status === "IN_DELIVERY"
                            ? "Dalam Perjalanan"
                            : detailShipment.status === "DELIVERED"
                              ? "Terkirim"
                              : detailShipment.status === "RETUR"
                                ? "Retur"
                                : detailShipment.status}
                      </Badge>
                      <span className="text-[10px] font-semibold text-muted-foreground bg-muted border px-1.5 py-0.5 rounded">
                        {detailShipment.shippingMethod === "INTERNAL_DELIVERY"
                          ? "Pengiriman Internal"
                          : "Ambil Sendiri"}
                      </span>
                    </div>
                  </div>

                  {/* Destination */}
                  <div className="text-xs space-y-1">
                    <span className="font-bold text-muted-foreground">
                      Alamat Tujuan:
                    </span>
                    <p className="font-medium text-foreground bg-background p-2.5 rounded-lg border border-border/40 leading-relaxed">
                      {detailShipment.destination}
                    </p>
                  </div>

                  {/* Fleet Info */}
                  {detailShipment.shippingMethod === "INTERNAL_DELIVERY" && (
                    <div className="bg-background border border-border/40 p-3 rounded-lg space-y-2 text-xs">
                      <h5 className="font-bold text-foreground">
                        Informasi Armada
                      </h5>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-muted-foreground">Driver:</span>
                          <p className="font-semibold text-foreground">
                            {detailShipment.driverName}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Kendaraan:
                          </span>
                          <p className="font-semibold text-foreground">
                            {detailShipment.vehicleName} (
                            {detailShipment.vehiclePlate})
                          </p>
                        </div>
                        <div className="col-span-2 border-t pt-1.5 mt-0.5 flex justify-between items-center">
                          <span className="text-muted-foreground">
                            Status Alokasi Armada:
                          </span>
                          <Badge
                            className={cn(
                              "font-bold text-[9px] shadow-none",
                              detailShipment.fleetRequestStatus === "CONFIRMED"
                                ? "bg-green-100 text-green-700 border border-green-200/50"
                                : detailShipment.fleetRequestStatus ===
                                    "ASSIGNED"
                                  ? "bg-blue-100 text-blue-700 border border-blue-200/50"
                                  : "bg-amber-100 text-amber-700 border border-amber-200/50",
                            )}
                          >
                            {detailShipment.fleetRequestStatus === "CONFIRMED"
                              ? "Terkonfirmasi"
                              : detailShipment.fleetRequestStatus === "ASSIGNED"
                                ? "Armada Ditunjuk"
                                : "Menunggu Armada"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Packages List */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-primary" />
                      Daftar Paket / Marking Label (
                      {detailShipment.packages.length})
                    </h5>
                    <div className="border border-border/40 rounded-lg overflow-hidden bg-background">
                      <Table>
                        <TableHeader className="bg-muted/10 text-[10px]">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="font-semibold text-[10px] py-1.5 h-auto">
                              Kode Stiker
                            </TableHead>
                            <TableHead className="font-semibold text-[10px] py-1.5 h-auto">
                              Nama Barang
                            </TableHead>
                            <TableHead className="font-semibold text-[10px] py-1.5 h-auto text-right">
                              Qty
                            </TableHead>
                            <TableHead className="font-semibold text-[10px] py-1.5 h-auto text-right">
                              Berat
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-[11px]">
                          {detailShipment.packages.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="text-center py-4 text-muted-foreground"
                              >
                                Tidak ada item kemasan dalam Surat Jalan ini.
                              </TableCell>
                            </TableRow>
                          ) : (
                            detailShipment.packages.map((pkg: any) => (
                              <TableRow
                                key={pkg.id}
                                className="hover:bg-muted/5 border-border/30"
                              >
                                <TableCell className="font-bold font-mono text-[10px] text-primary">
                                  {pkg.code}
                                </TableCell>
                                <TableCell
                                  className="font-medium max-w-[120px] truncate"
                                  title={pkg.itemName}
                                >
                                  {pkg.itemName}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {pkg.qty} {pkg.unit}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {pkg.weight ? `${pkg.weight} kg` : "-"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Notes */}
                  {detailShipment.notes && (
                    <div className="text-[11px] p-2.5 rounded-lg bg-background border border-border/40">
                      <span className="font-bold text-muted-foreground block mb-0.5">
                        Catatan/Keterangan:
                      </span>
                      <p className="text-foreground/80 leading-normal">
                        {detailShipment.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter className="mt-4 pt-3 border-t shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailShipment(null)}
                className="cursor-pointer"
              >
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function ClipboardCheck(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}
