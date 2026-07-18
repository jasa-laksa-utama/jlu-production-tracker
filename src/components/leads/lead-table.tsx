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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  MoreHorizontal,
  Plus,
  Briefcase,
  FileSignature,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpDown,
  Calendar as CalendarIcon,
  Edit,
  Trash2,
  Settings,
  Loader2,
  Info,
  Eye,
  Undo2,
  Check,
  ChevronsUpDown,
  User as UserIcon,
  FolderOpen,
  ExternalLink,
  Receipt,
  Mail,
  FileText,
  History,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  createLead,
  updateLeadStatus,
  updateLead,
  deleteLead,
} from "@/app/actions/leads";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { convertToProject, revertProjectToLead } from "@/app/actions/projects";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { format } from "date-fns";
import { DateRangePicker } from "./date-range-picker";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { cn, sanitizeInput, formatRupiah } from "@/lib/utils";
import { Label } from "../ui/label";
import { DocumentManagerDialog } from "@/components/document-manager-dialog";
import { ProjectDetailDialog } from "@/components/project-detail-dialog";
import { SalesDocumentsDialog } from "@/components/sales-documents-dialog";
import { ProjectHistoryDialog } from "@/components/project-history-dialog";
import {
  saveDocumentRecord,
  createDocumentUploadUrl,
} from "@/app/actions/documents";
// No longer using UI Select here to avoid context issues with Base UI,
// using native <select> instead which matches the rest of the file.

const PROJECT_TYPES = [
  {
    id: "PO_PROJECT",
    label: "PO Project",
    color: "bg-blue-500/10 text-blue-600 border-blue-200",
  },
  {
    id: "PO_SPAREPART",
    label: "PO Sparepart",
    color: "bg-purple-500/10 text-purple-600 border-purple-200",
  },
] as const;

export function LeadTable({
  leads,
  customers,
  meta,
}: {
  leads: any[];
  customers: any[];
  meta?: any;
}) {
  const [isPending, startTransition] = useTransition();
  const [dialogKey, setDialogKey] = useState(0);
  const [displayValue, setDisplayValue] = useState("");
  const [rawValue, setRawValue] = useState("");
  const [confirmStatus, setConfirmStatus] = useState<{
    lead: any;
    newStatus: string;
  } | null>(null);
  const [editLead, setEditLead] = useState<any | null>(null);
  const [editDialogKey, setEditDialogKey] = useState(0);
  const [deleteConfirmLead, setDeleteConfirmLead] = useState<any | null>(null);
  const [deleteValidation, setDeleteValidation] = useState("");
  const [convertToProjectLead, setConvertToProjectLead] = useState<any | null>(
    null,
  );
  const [expectedDate, setExpectedDate] = useState<Date | undefined>(undefined);
  const [dealChecks, setDealChecks] = useState({
    poFile: null as File | null,
    ssFile: null as File | null,
    notes: "",
  });
  const [viewDetailLead, setViewDetailLead] = useState<any | null>(null);
  const [lostReasonLead, setLostReasonLead] = useState<any | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [revertConfirmLead, setRevertConfirmLead] = useState<any | null>(null);
  const [openCustomerPopover, setOpenCustomerPopover] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [openEditCustomerPopover, setOpenEditCustomerPopover] = useState(false);
  const [editSelectedCustomerId, setEditSelectedCustomerId] = useState("");

  const [selectedLeadForDocs, setSelectedLeadForDocs] = useState<string | null>(
    null,
  );
  const [docOwnerType, setDocOwnerType] = useState<"LEAD" | "PROJECT">("LEAD");
  const [historyProject, setHistoryProject] = useState<any | null>(null);

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
    // Reset page if a filter (non-page) is changed
    if (!updates.page) params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  // Handle debounced search (simulate with effect or just on Enter/Blur)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== currentSearch) {
        updateQuery({ search: searchInput });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Synchronize expectedDate and reset validation checks when the Deal dialog opens
  useEffect(() => {
    if (convertToProjectLead) {
      setExpectedDate(
        convertToProjectLead.expectedDate
          ? new Date(convertToProjectLead.expectedDate)
          : undefined,
      );
      setDealChecks({
        poFile: null,
        ssFile: null,
        notes: "",
      });
    }
  }, [convertToProjectLead]);

  const activeCustomers = customers.filter((c) => c.isActive);

  async function handleCreateSubmit(formData: FormData) {
    const projectName = formData.get("projectName") as string;
    const description = formData.get("description") as string;
    const value = formData.get("value") as string;
    const customerId = formData.get("customerId") as string;
    const expectedDate = formData.get("expectedDate") as string;
    const projectType = formData.get("projectType") as string;
    const salesPerson = formData.get("salesPerson") as string;
    const globalDriveUrl = formData.get("globalDriveUrl") as string;

    const sanitizedData = new FormData();
    sanitizedData.append("projectName", sanitizeInput(projectName));
    sanitizedData.append("description", sanitizeInput(description));
    sanitizedData.append("value", value);
    sanitizedData.append("customerId", customerId);
    if (expectedDate) sanitizedData.append("expectedDate", expectedDate);
    if (projectType) sanitizedData.append("projectType", projectType);
    if (salesPerson)
      sanitizedData.append("salesPerson", sanitizeInput(salesPerson));
    if (globalDriveUrl) sanitizedData.append("globalDriveUrl", globalDriveUrl);

    const promise = async () => {
      const result = await createLead(sanitizedData);
      if (result.error) throw new Error(result.error);
      setDialogKey((k) => k + 1);
      setDisplayValue("");
      setRawValue("");
      setSelectedCustomerId("");
      router.refresh();
      return result;
    };

    toast.promise(promise(), {
      loading: "Sedang menyimpan lead baru...",
      success: "Lead berhasil dibuat!",
      error: (err) => err.message || "Gagal menyimpan lead. Silakan coba lagi.",
    });
  }

  async function handleEditSubmit(formData: FormData) {
    if (!editLead) return;
    const projectName = formData.get("projectName") as string;
    const description = formData.get("description") as string;
    const value = formData.get("value") as string;
    const customerId = formData.get("customerId") as string;

    const sanitizedData = new FormData();
    sanitizedData.append("projectName", sanitizeInput(projectName));
    sanitizedData.append("description", sanitizeInput(description));
    sanitizedData.append("value", value);
    sanitizedData.append("customerId", customerId);

    // Add these missing fields
    const projectType = formData.get("projectType") as string;
    const salesPerson = formData.get("salesPerson") as string;
    const globalDriveUrl = formData.get("globalDriveUrl") as string;
    const expectedDate = formData.get("expectedDate") as string;

    if (projectType) sanitizedData.append("projectType", projectType);
    if (salesPerson)
      sanitizedData.append("salesPerson", sanitizeInput(salesPerson));
    if (globalDriveUrl) sanitizedData.append("globalDriveUrl", globalDriveUrl);
    if (expectedDate) sanitizedData.append("expectedDate", expectedDate);

    const promise = async () => {
      const result = await updateLead(editLead.id, sanitizedData);
      if (result.error) throw new Error(result.error);
      setEditDialogKey((k) => k + 1);
      setEditLead(null);
      setEditSelectedCustomerId("");
      router.refresh();
      return result;
    };

    toast.promise(promise(), {
      loading: "Memperbarui data lead...",
      success: "Lead berhasil diperbarui!",
      error: (err) =>
        err.message || "Gagal memperbarui lead. Silakan coba lagi.",
    });
  }

  async function performDelete() {
    if (!deleteConfirmLead || deleteValidation !== "konfirmasi") return;
    const promise = async () => {
      const result = await deleteLead(deleteConfirmLead.id);
      if (result.error) throw new Error(result.error);
      setDeleteConfirmLead(null);
      setDeleteValidation("");
      router.refresh();
      return result;
    };

    toast.promise(promise(), {
      loading: "Menghapus lead...",
      success: "Lead berhasil dihapus!",
      error: (err) => err.message || "Gagal menghapus lead. Silakan coba lagi.",
    });
  }

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = e.target.value.replace(/[^0-9]/g, "");
    setRawValue(numericValue);
    if (numericValue) {
      setDisplayValue(formatRupiah(numericValue));
    } else {
      setDisplayValue("");
    }
  };

  async function performStatusUpdate() {
    if (!confirmStatus) return;

    // If transitioning to DEAL, open the conversion dialog instead
    if (confirmStatus.newStatus === "DEAL") {
      setConvertToProjectLead(confirmStatus.lead);
      if (confirmStatus.lead.expectedDate) {
        setExpectedDate(new Date(confirmStatus.lead.expectedDate));
      } else {
        setExpectedDate(undefined);
      }
      setDealChecks({
        poFile: null,
        ssFile: null,
        notes: "",
      });
      setConfirmStatus(null);
      return;
    }

    // If transitioning to LOST, open the reason dialog instead
    if (confirmStatus.newStatus === "LOST") {
      setLostReasonLead(confirmStatus.lead);
      setConfirmStatus(null);
      return;
    }

    const promise = async () => {
      const result = await updateLeadStatus(
        confirmStatus.lead.id,
        confirmStatus.newStatus,
      );
      if (result.error) throw new Error(result.error);
      setConfirmStatus(null);
      router.refresh();
      return result;
    };

    toast.promise(promise(), {
      loading: "Memperbarui status...",
      success: "Status lead berhasil diupdate!",
      error: (err) =>
        err.message || "Gagal memperbarui status. Silakan coba lagi.",
    });
  }

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case "NEW":
        return "New";
      case "OFFERING":
        return "Offering";
      case "NEGOTIATION":
        return "Negotiation";
      case "DEAL":
        return "Deal";
      case "LOST":
        return "Lost";
      default:
        return status || "";
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "NEW":
        return "bg-blue-500/10 text-blue-600 border-blue-200";
      case "OFFERING":
        return "bg-purple-500/10 text-purple-600 border-purple-200";
      case "NEGOTIATION":
        return "bg-orange-500/10 text-orange-600 border-orange-200";
      case "DEAL":
        return "bg-green-500/10 text-green-600 border-green-200";
      case "LOST":
        return "bg-red-500/10 text-red-600 border-red-200";
      default:
        return "bg-slate-500/10 text-slate-600 border-slate-200";
    }
  };

  const getStatusBadge = (status: string) => {
    const label = getStatusLabel(status);
    const color = getStatusColor(status);
    return (
      <Badge variant="outline" className={cn("font-normal", color)}>
        {label}
      </Badge>
    );
  };

  const getProjectTypeBadge = (type: string) => {
    const pt = PROJECT_TYPES.find((t) => t.id === type);
    if (!pt)
      return (
        <Badge variant="outline" className="font-normal text-xs">
          {type}
        </Badge>
      );
    return (
      <Badge
        variant="outline"
        className={cn("font-normal text-[11px]", pt.color)}
      >
        {pt.label}
      </Badge>
    );
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 md:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search leads..."
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
                    "NEW",
                    "OFFERING",
                    "NEGOTIATION",
                    "DEAL",
                    "LOST",
                  ].map((s) => (
                    <Button
                      key={s}
                      variant={currentStatus === s ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs px-2 cursor-pointer"
                      onClick={() => updateQuery({ status: s })}
                    >
                      {s === "ALL" ? "All" : getStatusLabel(s)}
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
                    Newest First
                  </span>
                  <Badge variant="secondary">
                    {currentSort === "desc" ? "DESC" : "ASC"}
                  </Badge>
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs hover:bg-primary/90 bg-primary text-primary-foreground hover:text-primary-foreground h-8 cursor-pointer"
                onClick={() => {
                  setSearchInput("");
                  setDateRange(undefined);
                  router.push(pathname);
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
              leads
            </span>
          </div>
        </div>

        <Dialog key={dialogKey}>
          <DialogTrigger className="inline-flex w-full md:w-auto items-center justify-center whitespace-nowrap rounded-md text-sm hover:bg-primary/90 bg-primary text-primary-foreground h-9 px-4 shadow-none cursor-pointer font-semibold transition-all active:scale-95">
            <Plus className="w-4 h-4 mr-2" /> New Lead
          </DialogTrigger>
          <DialogContent className="md:max-w-fit!">
            <DialogHeader>
              <DialogTitle>Create New Lead</DialogTitle>
              <DialogDescription>
                A lead represents a potential project opportunity.
              </DialogDescription>
            </DialogHeader>
            <form action={handleCreateSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Customer <span className="text-red-600">*</span>
                </label>
                <Popover
                  open={openCustomerPopover}
                  onOpenChange={setOpenCustomerPopover}
                >
                  <PopoverTrigger className="w-full justify-between bg-muted/20 border-border/50 hover:bg-muted/40 transition-colors h-11 px-4 flex items-center rounded-md border text-sm font-normal">
                    <div className="flex items-center gap-2 overflow-hidden text-left">
                      <UserIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      {selectedCustomerId ? (
                        (() => {
                          const c = activeCustomers.find(
                            (c) => c.id === selectedCustomerId,
                          );
                          return c ? (
                            <div className="flex flex-col items-start leading-tight overflow-hidden">
                              <span className="truncate text-sm font-medium w-full text-foreground">
                                {c.name}
                              </span>
                              {c.company && (
                                <span className="truncate text-[10px] text-muted-foreground w-full">
                                  {c.company}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              Select a customer...
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-muted-foreground">
                          Select a customer...
                        </span>
                      )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent
                    className="p-0 border shadow-md w-72"
                    align="start"
                    side="bottom"
                    sideOffset={4}
                  >
                    <Command className="w-full">
                      <CommandInput placeholder="Search customer or company..." />
                      <CommandList className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          {activeCustomers.map((customer) => (
                            <CommandItem
                              key={customer.id}
                              value={`${customer.name} ${customer.company || ""}`}
                              onSelect={() => {
                                setSelectedCustomerId(customer.id);
                                setOpenCustomerPopover(false);
                              }}
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedCustomerId === customer.id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">
                                  {customer.name}
                                </span>
                                {customer.company && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {customer.company}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {/* Hidden input to capture the customerId for FormData */}
                <input
                  type="hidden"
                  name="customerId"
                  value={selectedCustomerId}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Project Name <span className="text-red-600">*</span>
                </label>
                <Input
                  name="projectName"
                  required
                  placeholder="Conveyor System For Mining Site"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Jenis Project <span className="text-red-600">*</span>
                  </label>
                  <select
                    name="projectType"
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                  >
                    <option value="PO_PROJECT">PO Project</option>
                    <option value="PO_SPAREPART">PO Sparepart</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sales Person</label>
                  <Input name="salesPerson" placeholder="Sales Name" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  name="description"
                  placeholder="Brief details"
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Estimated Value (Rp)
                  </label>
                  <Input
                    type="text"
                    value={displayValue}
                    onChange={handleValueChange}
                    placeholder="Rp 50.000.000"
                  />
                  <input type="hidden" name="value" value={rawValue} />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium">
                    Expected Due Date (Optional)
                  </label>
                  <Input
                    type="date"
                    name="expectedDate"
                    className="cursor-pointer"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 cursor-pointer transition-all active:scale-95">
                  Cancel
                </DialogTrigger>
                <Button
                  type="submit"
                  disabled={isPending || activeCustomers.length === 0}
                  className="cursor-pointer transition-all active:scale-95"
                >
                  {isPending ? "Saving..." : "Save Lead"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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

      <div className="border border-border rounded-xl bg-card overflow-hidden relative">
        {isPending && (
          <div className="absolute inset-0 z-10 bg-background/40 backdrop-blur-[1px] flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-background/80 p-3 rounded-full shadow-lg border border-border">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          </div>
        )}
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-border text-xs font-bold">
              <TableHead className="w-[50px] text-center">No</TableHead>
              <TableHead className="w-[200px]">Project Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Sales</TableHead>
              <TableHead className="w-[100px]">Entry Date</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Project Status</TableHead>
              <TableHead>Docs</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center h-48">
                  <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Search className="w-8 h-8 opacity-20" />
                    <p>No leads found matching your criteria.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead, index) => (
                <TableRow
                  key={lead.id}
                  className="border-border/50 hover:bg-muted/30 group"
                >
                  <TableCell className="text-center text-muted-foreground text-xs font-mono">
                    {(currentPage - 1) * pageSize + index + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/5 p-2 rounded-lg text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-primary">
                          {lead.leadNumber || "-"}
                        </span>
                        <span className="truncate">{lead.projectName}</span>
                        <span className="text-xs text-muted-foreground font-medium truncate max-w-[250px]">
                          {lead.customer?.company || "Personal Customer"}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium truncate max-w-[250px]">
                          {lead.customer?.name || "-"}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    {getProjectTypeBadge(lead.projectType || "PO_PROJECT")}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {lead.salesPerson || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-semibold text-xs">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-3 h-3 opacity-80" />
                      {format(new Date(lead.createdAt), "dd MMM yyyy")}
                    </div>
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground font-mono text-sm"
                    suppressHydrationWarning
                  >
                    {lead.value ? formatRupiah(lead.value) : "-"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        disabled={lead.status === "DEAL"}
                        className={cn(
                          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium hover:bg-muted hover:text-foreground h-8 p-1 px-2 border border-transparent hover:border-border outline-none transition-all",
                          lead.status === "DEAL"
                            ? "cursor-not-allowed opacity-100"
                            : "cursor-pointer",
                        )}
                      >
                        {getStatusBadge(lead.status)}
                        {lead.status !== "DEAL" && (
                          <ChevronDown className="w-3 h-3 ml-2 opacity-30 group-hover:opacity-100" />
                        )}
                      </DropdownMenuTrigger>
                      {lead.status !== "DEAL" && (
                        <DropdownMenuContent align="end">
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Update Status
                          </div>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            {["NEW", "OFFERING", "NEGOTIATION"].map((s) => (
                              <DropdownMenuItem
                                key={s}
                                onClick={() =>
                                  setConfirmStatus({ lead, newStatus: s })
                                }
                              >
                                {getStatusLabel(s)}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                setConfirmStatus({
                                  lead,
                                  newStatus: "DEAL",
                                })
                              }
                              className="text-green-600 focus:text-green-600 font-medium"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" /> Deal
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() =>
                                setConfirmStatus({
                                  lead,
                                  newStatus: "LOST",
                                })
                              }
                              className="text-red-600 focus:text-red-600 font-medium"
                            >
                              <AlertCircle className="w-4 h-4 mr-2" /> Lost
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      )}
                    </DropdownMenu>
                  </TableCell>
                  <TableCell>
                    {lead.project ? (
                      <div className="flex flex-col gap-1">
                        <div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-medium text-[11px] px-2 py-0.5",
                              getProjectStatusColor(
                                lead.project.currentStatus ||
                                  lead.project.status ||
                                  "PENDING",
                              ),
                            )}
                          >
                            {getProjectStatusLabel(
                              lead.project.currentStatus ||
                                lead.project.status ||
                                "PENDING",
                            )}
                          </Badge>
                        </div>
                        {lead.project.currentDivision && (
                          <span className="text-[10px] text-muted-foreground font-medium">
                            Divisi:{" "}
                            {formatDivision(lead.project.currentDivision)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <DocumentManagerDialog
                      ownerId={lead.id}
                      ownerType="LEAD"
                      globalDriveUrl={lead.globalDriveUrl}
                      onUploadSuccess={() => router.refresh()}
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="relative h-8 px-2 gap-2 cursor-pointer transition-all border border-transparent"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-primary" />
                          <span className="text-xs font-medium">
                            {lead.documents?.filter(
                              (d: any) =>
                                d.category !== "PO" &&
                                d.category !== "OFFERING",
                            ).length || 0}
                          </span>
                          {lead.hasRevisedDocs && (
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
                      <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-muted cursor-pointer">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[200px]">
                        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                          Actions
                        </div>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onClick={() => setViewDetailLead(lead)}
                          >
                            <Eye className="w-4 h-4 mr-2" /> View Details
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => setEditLead(lead)}>
                            <Edit className="w-4 h-4 mr-2 text-amber-500" />{" "}
                            Edit Lead/Project
                          </DropdownMenuItem>

                          {lead.status !== "DEAL" && lead.status !== "LOST" && (
                            <DropdownMenuItem
                              onClick={() => setConvertToProjectLead(lead)}
                              className="text-green-600 focus:text-green-600 font-medium"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" /> Deal
                              Project
                            </DropdownMenuItem>
                          )}

                          {lead.status === "DEAL" && !lead.project && (
                            <DropdownMenuItem
                              onClick={() => setConvertToProjectLead(lead)}
                              className="text-blue-600 focus:text-blue-600 font-medium"
                            >
                              <Settings className="w-4 h-4 mr-2" /> Continue to
                              Project
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                            onClick={() => {
                              console.log("Opening docs for:", lead.id);
                              setDocOwnerType("LEAD");
                              setSelectedLeadForDocs(lead.id);
                            }}
                            className="text-orange-600 focus:text-orange-600 font-medium cursor-pointer"
                          >
                            <Receipt className="w-4 h-4 mr-2" /> Sales Documents
                          </DropdownMenuItem>

                          {lead.project && (
                            <>
                              <DropdownMenuItem
                                className="text-green-600 font-medium opacity-70"
                                disabled
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2" />{" "}
                                Project Active
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setRevertConfirmLead(lead)}
                                className="text-orange-600 focus:text-orange-600 font-medium"
                              >
                                <Undo2 className="w-4 h-4 mr-2" /> Revert Leads
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setHistoryProject({
                                    ...lead.project,
                                    lead: lead,
                                  })
                                }
                                className="text-primary font-medium"
                              >
                                <History className="w-4 h-4 mr-2" /> View Logs
                              </DropdownMenuItem>
                            </>
                          )}

                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteConfirmLead(lead)}
                            className="text-red-600 focus:text-red-600 font-medium"
                            disabled={lead.status === "DEAL"}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete Lead
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!confirmStatus}
        onOpenChange={(open) => !open && setConfirmStatus(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Update Lead Status</DialogTitle>
            <DialogDescription>
              Change status of <b>{confirmStatus?.lead.projectName}</b> to{" "}
              <b>{getStatusLabel(confirmStatus?.newStatus)}</b>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmStatus(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={isPending}
              onClick={performStatusUpdate}
            >
              {isPending ? "Updating..." : "Confirm Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Project Dialog */}
      <Dialog
        open={!!convertToProjectLead}
        onOpenChange={(open) => !open && setConvertToProjectLead(null)}
      >
        <DialogContent className="md:max-w-[500px]! max-h-[calc(100vh-10rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Deal Project Confirmation
            </DialogTitle>
            <DialogDescription>
              Silakan lengkapi validasi berikut untuk memproses{" "}
              <b>{convertToProjectLead?.projectName}</b> ke tahap Engineering.
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const existingPo = convertToProjectLead?.documents?.find(
              (d: any) => d.category === "PO",
            );
            const existingOffering = convertToProjectLead?.documents?.find(
              (d: any) => d.category === "OFFERING",
            );

            return (
              <>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">
                      Expected Completion Date
                    </Label>
                    <Input
                      type="date"
                      className="w-full cursor-pointer"
                      value={
                        expectedDate
                          ? expectedDate.toISOString().split("T")[0]
                          : ""
                      }
                      onChange={(e) =>
                        setExpectedDate(
                          e.target.value ? new Date(e.target.value) : undefined,
                        )
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Dapat diubah jika target penyelesaian proyek berubah.
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <Label className="text-sm font-semibold">
                      Validasi Dokumen
                    </Label>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">
                          1. Dokumen PO (Wajib)
                        </Label>
                        {existingPo ? (
                          <div className="flex items-center justify-between p-2 rounded border border-green-200 bg-green-50/50 text-[10px]">
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="w-3.5 h-3.5 text-green-600" />
                              <span className="truncate max-w-[150px] font-medium text-green-700">
                                {existingPo.fileName} (v{existingPo.version})
                              </span>
                            </div>
                            <span className="text-[9px] text-green-600 font-semibold bg-green-100 px-1.5 py-0.5 rounded">
                              READY
                            </span>
                          </div>
                        ) : null}
                        <Input
                          type="file"
                          className="text-xs h-9 cursor-pointer"
                          onChange={(e) =>
                            setDealChecks((p) => ({
                              ...p,
                              poFile: e.target.files?.[0] || null,
                            }))
                          }
                        />
                        {existingPo && (
                          <p className="text-[9px] text-muted-foreground italic">
                            * Upload file baru jika ingin merevisi/override PO
                            yang sudah ada.
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">
                          2. Bukti Penawaran (Wajib)
                        </Label>
                        {existingOffering ? (
                          <div className="flex items-center justify-between p-2 rounded border border-blue-200 bg-blue-50/50 text-[10px]">
                            <div className="flex items-center gap-2 truncate">
                              {existingOffering.isExternal ? (
                                <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                              ) : (
                                <Mail className="w-3.5 h-3.5 text-blue-600" />
                              )}
                              <span className="truncate max-w-[150px] font-medium text-blue-700">
                                {existingOffering.fileName || "External Link"}{" "}
                                (v{existingOffering.version})
                              </span>
                            </div>
                            <span className="text-[9px] text-blue-600 font-semibold bg-blue-100 px-1.5 py-0.5 rounded">
                              READY
                            </span>
                          </div>
                        ) : null}
                        <Input
                          type="file"
                          className="text-xs h-9 cursor-pointer"
                          onChange={(e) =>
                            setDealChecks((p) => ({
                              ...p,
                              ssFile: e.target.files?.[0] || null,
                            }))
                          }
                        />
                        {existingOffering && (
                          <p className="text-[9px] text-muted-foreground italic">
                            * Upload file baru jika ingin merevisi/override
                            Bukti Penawaran.
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">
                          3. Catatan (Opsional)
                        </Label>
                        <Textarea
                          placeholder="Masukkan catatan deal jika ada..."
                          className="text-xs min-h-[60px]"
                          value={dealChecks.notes}
                          onChange={(e) =>
                            setDealChecks((p) => ({
                              ...p,
                              notes: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                    <p className="text-xs text-primary font-medium flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Workflow: Lead → Deal → Engineering (Pending)
                    </p>
                  </div> */}
                </div>

                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setConvertToProjectLead(null)}
                    disabled={isPending}
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    className="cursor-pointer"
                    disabled={
                      isPending ||
                      !expectedDate ||
                      (!dealChecks.poFile && !existingPo) ||
                      (!dealChecks.ssFile && !existingOffering)
                    }
                    onClick={async () => {
                      if (!convertToProjectLead) return;

                      startTransition(async () => {
                        try {
                          // 1. Convert to Project
                          const result = await convertToProject(
                            convertToProjectLead.id,
                            expectedDate,
                          );

                          if (!result.success) throw new Error(result.error);

                          // 2. Handle PO File
                          if (dealChecks.poFile) {
                            const poRes = await createDocumentUploadUrl(
                              convertToProjectLead.id,
                              "LEAD",
                              "PO",
                              dealChecks.poFile.name,
                            );
                            if (poRes.success && poRes.uploadUrl) {
                              await fetch(poRes.uploadUrl, {
                                method: "PUT",
                                body: dealChecks.poFile,
                                headers: {
                                  "Content-Type": dealChecks.poFile.type,
                                },
                              });
                              await saveDocumentRecord({
                                leadId: convertToProjectLead.id,
                                projectId: result.data.id,
                                category: "PO",
                                url: poRes.path!,
                                fileName: dealChecks.poFile.name,
                                version: poRes.version || 1,
                                notes: dealChecks.notes || "PO Updated on Deal",
                              });
                            }
                          } else if (existingPo) {
                            // Link existing record to the new project
                            await saveDocumentRecord({
                              leadId: convertToProjectLead.id,
                              projectId: result.data.id,
                              category: "PO",
                              url: existingPo.url,
                              fileName: existingPo.fileName,
                              isExternal: existingPo.isExternal,
                              version: existingPo.version,
                              notes: "Existing PO linked on Deal",
                            });
                          }

                          // 3. Handle Offering File
                          if (dealChecks.ssFile) {
                            const ssRes = await createDocumentUploadUrl(
                              convertToProjectLead.id,
                              "LEAD",
                              "OFFERING",
                              dealChecks.ssFile.name,
                            );
                            if (ssRes.success && ssRes.uploadUrl) {
                              await fetch(ssRes.uploadUrl, {
                                method: "PUT",
                                body: dealChecks.ssFile,
                                headers: {
                                  "Content-Type": dealChecks.ssFile.type,
                                },
                              });
                              await saveDocumentRecord({
                                leadId: convertToProjectLead.id,
                                projectId: result.data.id,
                                category: "OFFERING",
                                url: ssRes.path!,
                                fileName: dealChecks.ssFile.name,
                                version: ssRes.version || 1,
                                notes:
                                  dealChecks.notes ||
                                  "Offering Updated on Deal",
                              });
                            }
                          } else if (existingOffering) {
                            await saveDocumentRecord({
                              leadId: convertToProjectLead.id,
                              projectId: result.data.id,
                              category: "OFFERING",
                              url: existingOffering.url,
                              fileName: existingOffering.fileName,
                              isExternal: existingOffering.isExternal,
                              version: existingOffering.version,
                              notes: "Existing Offering Proof linked on Deal",
                            });
                          }

                          toast.success(
                            "Leads Berhasil di Deal & Masuk ke Engineering!",
                          );
                          setConvertToProjectLead(null);
                          setExpectedDate(undefined);
                          router.refresh();
                        } catch (err: any) {
                          toast.error(err.message || "Gagal memproses Deal");
                        }
                      });
                    }}
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Submit
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit Lead Dialog */}
      <Dialog
        key={`edit-lead-${editDialogKey}`}
        open={!!editLead}
        onOpenChange={(open) => {
          if (!open) {
            setEditLead(null);
            setDisplayValue("");
            setRawValue("");
          }
        }}
      >
        <DialogContent className="md:max-w-fit!">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>
              Update project details for <b>{editLead?.projectName}</b>
            </DialogDescription>
          </DialogHeader>
          {editLead && (
            <form action={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Customer <span className="text-red-600">*</span>
                </label>
                <Popover
                  open={openEditCustomerPopover}
                  onOpenChange={setOpenEditCustomerPopover}
                >
                  <PopoverTrigger className="w-full justify-between bg-muted/20 border-border/50 hover:bg-muted/40 transition-colors h-11 px-4 flex items-center rounded-md border text-sm font-normal">
                    <div className="flex items-center gap-2 overflow-hidden text-left">
                      <UserIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      {(() => {
                        const c = editSelectedCustomerId
                          ? activeCustomers.find(
                              (c) => c.id === editSelectedCustomerId,
                            ) ||
                            customers.find(
                              (c) => c.id === editSelectedCustomerId,
                            )
                          : editLead.customer;
                        return c ? (
                          <div className="flex flex-col items-start leading-tight overflow-hidden text-left">
                            <span className="truncate text-sm font-medium w-full text-foreground">
                              {c.name}
                            </span>
                            {c.company && (
                              <span className="truncate text-[10px] text-muted-foreground w-full">
                                {c.company}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            Select a customer...
                          </span>
                        );
                      })()}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent
                    className="p-0 border shadow-md w-72"
                    align="start"
                    side="bottom"
                    sideOffset={4}
                  >
                    <Command className="w-full">
                      <CommandInput placeholder="Search customer or company..." />
                      <CommandList className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          {customers.map((customer) => (
                            <CommandItem
                              key={customer.id}
                              value={`${customer.name} ${customer.company || ""}`}
                              onSelect={() => {
                                setEditSelectedCustomerId(customer.id);
                                setOpenEditCustomerPopover(false);
                              }}
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  (editSelectedCustomerId ||
                                    editLead.customerId) === customer.id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {customer.name}
                                </span>
                                {customer.company && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {customer.company}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {/* Hidden input to capture the customerId for FormData */}
                <input
                  type="hidden"
                  name="customerId"
                  value={editSelectedCustomerId || editLead.customerId}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Project Name <span className="text-red-600">*</span>
                </label>
                <Input
                  name="projectName"
                  required
                  defaultValue={editLead.projectName}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  name="description"
                  defaultValue={editLead.description || ""}
                  placeholder="Brief details"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Jenis Project</label>
                  <select
                    name="projectType"
                    defaultValue={editLead.projectType}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                  >
                    {PROJECT_TYPES.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sales Person</label>
                  <Input
                    name="salesPerson"
                    defaultValue={editLead.salesPerson || ""}
                    placeholder="Sales Name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Estimated Value (Rp)
                  </label>
                  <Input
                    type="text"
                    defaultValue={
                      editLead.value
                        ? `Rp ${parseInt(editLead.value, 10).toLocaleString("id-ID")}`
                        : ""
                    }
                    onChange={handleValueChange}
                    placeholder="Rp 50.000.000"
                  />
                  <input
                    type="hidden"
                    name="value"
                    value={rawValue || editLead.value || ""}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium">
                    Expected Due Date (Optional)
                  </label>
                  <Input
                    type="date"
                    name="expectedDate"
                    defaultValue={
                      editLead.expectedDate
                        ? new Date(editLead.expectedDate)
                            .toISOString()
                            .split("T")[0]
                        : ""
                    }
                    className="cursor-pointer"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditLead(null)}
                  className="cursor-pointer transition-all active:scale-95"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="cursor-pointer hover:bg-primary/90 bg-primary text-primary-foreground hover:text-primary-foreground transition-all active:scale-95"
                >
                  {isPending ? "Updating..." : "Update Lead"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Lead Confirmation */}
      <Dialog
        open={!!deleteConfirmLead}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirmLead(null);
            setDeleteValidation("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Lead</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the
              lead for <b>{deleteConfirmLead?.projectName}</b>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Please type <b className="text-foreground">konfirmasi</b> to
              delete this lead.
            </p>
            <Input
              value={deleteValidation}
              onChange={(e) => setDeleteValidation(e.target.value)}
              placeholder="konfirmasi"
              className="border-red-200 focus-visible:ring-red-500"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmLead(null)}
              disabled={isPending}
              className="cursor-pointer transition-all active:scale-95"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending || deleteValidation !== "konfirmasi"}
              onClick={performDelete}
              className="text-white bg-red-600 hover:bg-red-700 transition-all active:scale-95 cursor-pointer"
            >
              {isPending ? "Deleting..." : "Delete Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lost Reason Dialog */}
      <Dialog
        open={!!lostReasonLead}
        onOpenChange={(open) => {
          if (!open) {
            setLostReasonLead(null);
            setLostReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Reason for Lost Lead
            </DialogTitle>
            <DialogDescription>
              Please provide a reason why <b>{lostReasonLead?.projectName}</b>{" "}
              was marked as lost.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label className="text-sm font-semibold mb-2 block">
              Alasan Gagal (Wajib)
            </Label>
            <Textarea
              placeholder="Contoh: Budget client tidak masuk, Client tidak respon, dll"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              className="w-full"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setLostReasonLead(null)}
              disabled={isPending}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              disabled={isPending || !lostReason.trim()}
              onClick={() => {
                startTransition(async () => {
                  const result = await updateLeadStatus(
                    lostReasonLead.id,
                    "LOST",
                    null,
                    lostReason,
                  );
                  if (result.success) {
                    toast.success("Lead marked as lost");
                    setLostReasonLead(null);
                    setLostReason("");
                    router.refresh();
                  } else {
                    toast.error(result.error);
                  }
                });
              }}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirm Lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert Confirmation Dialog */}
      <Dialog
        open={!!revertConfirmLead}
        onOpenChange={(open) => !open && setRevertConfirmLead(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <Undo2 className="w-5 h-5" />
              Revert Project to Lead
            </DialogTitle>
            <DialogDescription>
              Warning: This will <b>permanently delete</b> all production
              tracking data for <b>{revertConfirmLead?.projectName}</b> and move
              it back to sales negotiation stage.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setRevertConfirmLead(null)}
              disabled={isPending}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  if (!revertConfirmLead.project?.id) return;
                  const result = await revertProjectToLead(
                    revertConfirmLead.project.id,
                  );
                  if (result.success) {
                    toast.success("Project reverted and moved back to Leads");
                    setRevertConfirmLead(null);
                    router.refresh();
                  } else {
                    toast.error(result.error);
                  }
                });
              }}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Yes, Revert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProjectDetailDialog
        data={viewDetailLead}
        open={!!viewDetailLead}
        onOpenChange={(open) => !open && setViewDetailLead(null)}
        type="LEAD"
      />

      <SalesDocumentsDialog
        ownerId={selectedLeadForDocs || ""}
        ownerType={docOwnerType}
        open={!!selectedLeadForDocs}
        onOpenChange={(open) => !open && setSelectedLeadForDocs(null)}
      />

      <ProjectHistoryDialog
        project={historyProject}
        open={!!historyProject}
        onOpenChange={(open) => !open && setHistoryProject(null)}
      />
    </div>
  );
}
