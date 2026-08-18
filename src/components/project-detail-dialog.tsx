"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatJakartaDate } from "@/lib/date-utils";
import {
  AlertCircle,
  ExternalLink,
  Info,
  Package,
  Layers,
  Calendar,
  DollarSign,
  User as UserIcon,
  FileText,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { cn, formatRupiah } from "@/lib/utils";

interface ProjectDetailDialogProps {
  data: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type?: "LEAD" | "PROJECT";
  showValue?: boolean;
}

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
  {
    id: "OM",
    label: "OM",
    color: "bg-amber-500/10 text-amber-600 border-amber-200",
  },
] as const;

export function ProjectDetailDialog({
  data,
  open,
  onOpenChange,
  type = "LEAD",
  showValue = true,
}: ProjectDetailDialogProps) {
  if (!data) return null;

  const resolvedStatus = type === "PROJECT" ? (data.currentStatus || data.status || "PENDING") : (data.status || "NEW");

  const getStatusColor = (status: string) => {
    const s = status ? status.toUpperCase() : "";
    switch (s) {
      // Leads Statuses
      case "NEW":
        return "bg-slate-500/10 text-slate-600 border-slate-200";
      case "OFFERING":
        return "bg-blue-500/10 text-blue-600 border-blue-200";
      case "NEGOTIATION":
        return "bg-orange-500/10 text-orange-600 border-orange-200";
      case "DEAL":
        return "bg-green-500/10 text-green-600 border-green-200";
      case "LOST":
        return "bg-red-500/10 text-red-600 border-red-200";

      // Project Statuses
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

  const formatDivision = (division: string) => {
    switch (division?.toUpperCase()) {
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
        return division || "-";
    }
  };

  const getProjectTypeBadge = (typeId: string) => {
    const type = PROJECT_TYPES.find((t) => t.id === typeId);
    return (
      <Badge
        variant="outline"
        className={cn("text-[10px] font-bold", type?.color || "bg-slate-100")}
      >
        {type?.label || typeId || "Unknown"}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {data.projectName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {type === "PROJECT" ? "Production Project" : "Lead Engagement"}{" "}
            Overview • ID: {data.id.slice(-8).toUpperCase()}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-2">
          {/* Main Info Grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 border-b pb-6 border-border/50">
            {showValue && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Project Value
                </Label>
                <p className="text-sm font-bold text-primary">
                  {data.value ? formatRupiah(data.value) : "Rp 0"}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Status
              </Label>
              <div className="block pt-0.5">
                <Badge
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-bold shadow-none",
                    getStatusColor(resolvedStatus),
                  )}
                >
                  {resolvedStatus}
                </Badge>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Category
              </Label>
              <div className="block">
                {getProjectTypeBadge(
                  data.projectType || data.lead?.projectType,
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Deadline
              </Label>
              <p className="text-sm font-semibold text-foreground">
                {data.expectedDate
                  ? formatJakartaDate(data.expectedDate, "date")
                  : data.lead?.expectedDate
                    ? formatJakartaDate(data.lead.expectedDate, "date")
                    : "N/A"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Sales Handler
              </Label>
              <p className="text-sm font-medium text-foreground">
                {data.salesPerson || data.lead?.salesPerson || "-"}
              </p>
            </div>

          </div>

          {/* Customer Section */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">
              Customer Information
            </Label>
            <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
              <p className="font-semibold text-sm">
                {data.customer?.company || "Personal Customer"}
              </p>
              <p className="text-xs text-muted-foreground">
                Contact: {data.customer?.name}
              </p>
              {(data.customer?.phone || data.customer?.email) && (
                <div className="mt-2 pt-2 border-t border-border/10 text-[10px] text-muted-foreground flex flex-col gap-0.5">
                  {data.customer?.phone && (
                    <span>Phone: {data.customer?.phone}</span>
                  )}
                  {data.customer?.email && (
                    <span>Email: {data.customer?.email}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">
              Description
            </Label>
            <div className="min-h-15 max-h-30 overflow-y-auto bg-muted/20 rounded-lg p-3 border border-border/50 text-xs text-foreground/80 whitespace-pre-wrap">
              {data.description || "No description provided."}
            </div>
          </div>



          {/* LOST Reason */}
          {data.status === "LOST" && data.lostReason && (
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <Label className="text-[10px] font-bold text-red-600 uppercase">
                Reason for Lost
              </Label>
              <p className="text-xs font-medium text-red-900/80 mt-1 italic">
                "{data.lostReason}"
              </p>
            </div>
          )}

          {/* Footer Info */}
          <div className="pt-4 flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>
              Record Created: {formatJakartaDate(data.createdAt, "date")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-[10px] font-bold h-7 cursor-pointer hover:bg-muted"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
