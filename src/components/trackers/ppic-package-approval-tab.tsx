"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Check,
  X,
  Search,
  Filter,
  Loader2,
  ChevronDown,
  ChevronRight,
  Package,
  Layers,
  Scale,
  Maximize2,
  Building2,
  UserCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  approveShipmentPackageByPpic,
  rejectShipmentPackageByPpic,
} from "@/app/actions/shipping";

export interface PpicPackageApprovalTabProps {
  initialPackages: any[];
}

export function PpicPackageApprovalTab({
  initialPackages,
}: PpicPackageApprovalTabProps) {
  const router = useRouter();
  const [packages, setPackages] = useState<any[]>(initialPackages || []);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("WAITING_APPROVAL");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [openDetailIds, setOpenDetailIds] = useState<Record<string, boolean>>(
    {},
  );

  // Dialog states (Confirmation Dialogs)
  const [approvingPackage, setApprovingPackage] = useState<any | null>(null);
  const [rejectingPackage, setRejectingPackage] = useState<any | null>(null);
  const [isBulkApproveOpen, setIsBulkApproveOpen] = useState(false);
  const [isBulkRejectOpen, setIsBulkRejectOpen] = useState(false);

  const [approveNotes, setApproveNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered packages
  const filteredPackages = useMemo(() => {
    const list = packages.filter((pkg) => {
      // Status filter
      if (statusFilter !== "ALL") {
        if (statusFilter === "WAITING_APPROVAL") {
          if (pkg.ppicStatus !== "WAITING_APPROVAL") return false;
        } else if (pkg.ppicStatus !== statusFilter) {
          return false;
        }
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();

      // 1. Identitas Paket & Lot
      const code = (pkg.code || "").toLowerCase();
      const lot = (pkg.lotNo || "").toLowerCase();

      // 2. Identitas Proyek
      const projName = (pkg.project?.projectName || "").toLowerCase();
      const projNo = (pkg.project?.projectNumber || "").toLowerCase();

      // 3. Identitas Customer (Perusahaan, Nama Kontak, Alamat, No Telp, Email)
      const cust = pkg.project?.customer;
      const custName = (cust?.name || "").toLowerCase();
      const custCompany = (cust?.company || "").toLowerCase();
      const custAddress = (cust?.address || "").toLowerCase();
      const custPhone = (cust?.phone || "").toLowerCase();
      const custEmail = (cust?.email || "").toLowerCase();

      // 4. Komponen & Muatan
      const itemDesc = (pkg.itemName || "").toLowerCase();
      const compTexts = (pkg.project_components || [])
        .map((c: any) => `${c.markingCode || ""} ${c.name || ""}`)
        .join(" ")
        .toLowerCase();

      return (
        code.includes(q) ||
        lot.includes(q) ||
        projName.includes(q) ||
        projNo.includes(q) ||
        custName.includes(q) ||
        custCompany.includes(q) ||
        custAddress.includes(q) ||
        custPhone.includes(q) ||
        custEmail.includes(q) ||
        itemDesc.includes(q) ||
        compTexts.includes(q)
      );
    });

    return list.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.updatedAt || 0).getTime();
      const timeB = new Date(b.createdAt || b.updatedAt || 0).getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });
  }, [packages, statusFilter, searchQuery, sortOrder]);

  // Status counts
  const counts = useMemo(() => {
    let waiting = 0;
    let approved = 0;
    let rejected = 0;

    for (const p of packages) {
      if (p.ppicStatus === "WAITING_APPROVAL") waiting++;
      else if (p.ppicStatus === "APPROVED") approved++;
      else if (p.ppicStatus === "REJECTED") rejected++;
    }

    return {
      all: packages.length,
      waiting,
      approved,
      rejected,
    };
  }, [packages]);

  // Toggle detail accordion
  const toggleDetail = (id: string) => {
    setOpenDetailIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Bulk selection toggles
  const handleSelectAll = () => {
    const selectable = filteredPackages
      .filter((p) => p.ppicStatus === "WAITING_APPROVAL")
      .map((p) => p.id);

    if (
      selectedPackageIds.length === selectable.length &&
      selectable.length > 0
    ) {
      setSelectedPackageIds([]);
    } else {
      setSelectedPackageIds(selectable);
    }
  };

  const toggleSelectPackage = (id: string) => {
    setSelectedPackageIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  // Approve single package
  const handleApproveSubmit = async () => {
    if (!approvingPackage) return;
    setIsSubmitting(true);
    const toastId = toast.loading(
      `Menyetujui paket ${approvingPackage.code}...`,
    );

    try {
      const res = await approveShipmentPackageByPpic(
        [approvingPackage.id],
        approveNotes.trim() || undefined,
      );

      if (res.success) {
        toast.success(
          res.message || `Paket ${approvingPackage.code} berhasil disetujui!`,
          { id: toastId, duration: 4000 },
        );
        setPackages((prev) =>
          prev.map((p) =>
            p.id === approvingPackage.id
              ? {
                  ...p,
                  ppicStatus: "APPROVED",
                  ppicNotes: approveNotes.trim() || null,
                  ppicApprovedAt: new Date().toISOString(),
                }
              : p,
          ),
        );
        setSelectedPackageIds((prev) =>
          prev.filter((id) => id !== approvingPackage.id),
        );
        setApprovingPackage(null);
        setApproveNotes("");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menyetujui paket.", {
          id: toastId,
          duration: 5000,
        });
      }
    } catch (err: any) {
      toast.error(
        err?.message || "Terjadi kesalahan sistem saat menyetujui paket.",
        { id: toastId, duration: 5000 },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reject single package
  const handleRejectSubmit = async () => {
    if (!rejectingPackage) return;
    if (!rejectReason.trim()) {
      toast.error("Alasan penolakan (Reject) wajib diisi!");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(`Menolak paket ${rejectingPackage.code}...`);

    try {
      const res = await rejectShipmentPackageByPpic(
        [rejectingPackage.id],
        rejectReason.trim(),
      );

      if (res.success) {
        toast.success(
          res.message || `Paket ${rejectingPackage.code} berhasil ditolak.`,
          { id: toastId, duration: 4000 },
        );
        setPackages((prev) =>
          prev.map((p) =>
            p.id === rejectingPackage.id
              ? {
                  ...p,
                  ppicStatus: "REJECTED",
                  ppicNotes: rejectReason.trim(),
                  ppicApprovedAt: new Date().toISOString(),
                }
              : p,
          ),
        );
        setSelectedPackageIds((prev) =>
          prev.filter((id) => id !== rejectingPackage.id),
        );
        setRejectingPackage(null);
        setRejectReason("");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menolak paket.", {
          id: toastId,
          duration: 5000,
        });
      }
    } catch (err: any) {
      toast.error(
        err?.message || "Terjadi kesalahan sistem saat menolak paket.",
        { id: toastId, duration: 5000 },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk Approve
  const handleBulkApproveSubmit = async () => {
    if (selectedPackageIds.length === 0) return;
    setIsSubmitting(true);
    const count = selectedPackageIds.length;
    const toastId = toast.loading(`Menyetujui ${count} paket terpilih...`);

    try {
      const res = await approveShipmentPackageByPpic(
        selectedPackageIds,
        approveNotes.trim() || undefined,
      );

      if (res.success) {
        toast.success(res.message || `${count} paket berhasil disetujui!`, {
          id: toastId,
          duration: 4000,
        });
        setPackages((prev) =>
          prev.map((p) =>
            selectedPackageIds.includes(p.id)
              ? {
                  ...p,
                  ppicStatus: "APPROVED",
                  ppicNotes: approveNotes.trim() || null,
                  ppicApprovedAt: new Date().toISOString(),
                }
              : p,
          ),
        );
        setSelectedPackageIds([]);
        setIsBulkApproveOpen(false);
        setApproveNotes("");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menyetujui paket terpilih.", {
          id: toastId,
          duration: 5000,
        });
      }
    } catch (err: any) {
      toast.error(
        err?.message || "Terjadi kesalahan sistem saat menyetujui paket.",
        { id: toastId, duration: 5000 },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk Reject
  const handleBulkRejectSubmit = async () => {
    if (selectedPackageIds.length === 0) return;
    if (!rejectReason.trim()) {
      toast.error("Alasan penolakan (Reject) wajib diisi!");
      return;
    }

    setIsSubmitting(true);
    const count = selectedPackageIds.length;
    const toastId = toast.loading(`Menolak ${count} paket terpilih...`);

    try {
      const res = await rejectShipmentPackageByPpic(
        selectedPackageIds,
        rejectReason.trim(),
      );

      if (res.success) {
        toast.success(res.message || `${count} paket berhasil ditolak.`, {
          id: toastId,
          duration: 4000,
        });
        setPackages((prev) =>
          prev.map((p) =>
            selectedPackageIds.includes(p.id)
              ? {
                  ...p,
                  ppicStatus: "REJECTED",
                  ppicNotes: rejectReason.trim(),
                  ppicApprovedAt: new Date().toISOString(),
                }
              : p,
          ),
        );
        setSelectedPackageIds([]);
        setIsBulkRejectOpen(false);
        setRejectReason("");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menolak paket terpilih.", {
          id: toastId,
          duration: 5000,
        });
      }
    } catch (err: any) {
      toast.error(
        err?.message || "Terjadi kesalahan sistem saat menolak paket.",
        { id: toastId, duration: 5000 },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Parse items if serialized as JSON string in itemName
  const parseItems = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return null;
  };

  return (
    <div className="space-y-4 m-0 border-0 p-0 outline-hidden w-full max-w-full">
      {/* 1 & 2: TOOLBAR RESPONSIVE */}
      <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-stretch sm:items-center bg-card border border-border/60 p-3 sm:p-3.5 rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto flex-1">
          {/* Search Bar on the LEFT */}
          <div className="relative flex-1 min-w-[220px] sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari No. Paket, Customer, Proyek..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-xl bg-background border border-border/70 text-xs font-medium focus-visible:ring-primary/20 w-full"
            />
          </div>

          {/* Filter Popover Button identical to QC Table / user's design */}
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 gap-2 rounded-xl text-xs font-semibold cursor-pointer border border-border/70 hover:bg-accent hover:text-accent-foreground transition-all active:scale-95 shrink-0"
                >
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Filter</span>
                  {(statusFilter !== "ALL" || sortOrder !== "desc") && (
                    <Badge
                      variant="secondary"
                      className="ml-0.5 px-1.5 h-4 min-w-4 text-[10px] justify-center rounded-full bg-primary text-primary-foreground font-bold"
                    >
                      !
                    </Badge>
                  )}
                </Button>
              }
            />
            <PopoverContent
              className="w-72 sm:w-80 p-4 space-y-4 rounded-2xl shadow-xl border border-border/70"
              align="start"
            >
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Status QC / Validasi
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "ALL", label: "Semua" },
                    { id: "WAITING_APPROVAL", label: "Menunggu Persetujuan" },
                    { id: "APPROVED", label: "Disetujui" },
                    { id: "REJECTED", label: "Ditolak" },
                  ].map((item) => {
                    const isSelected = statusFilter === item.id;
                    return (
                      <Button
                        key={item.id}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className={`h-8 text-xs px-2.5 rounded-xl cursor-pointer font-medium transition-all ${
                          isSelected
                            ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                            : "bg-background hover:bg-muted/60 text-foreground/80 border-border"
                        }`}
                        onClick={() => setStatusFilter(item.id)}
                      >
                        {item.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Urutan
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between h-9 cursor-pointer font-medium rounded-xl text-xs"
                  onClick={() =>
                    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                  }
                >
                  <span className="flex items-center gap-2">
                    <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                    {sortOrder === "desc"
                      ? "Terbaru Dahulu"
                      : "Terlama Dahulu"}
                  </span>
                </Button>
              </div>

              <Button
                variant="default"
                size="sm"
                className="w-full text-xs hover:bg-primary/90 bg-primary text-primary-foreground hover:text-primary-foreground h-9 cursor-pointer rounded-xl font-bold transition-all shadow-xs"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                  setSortOrder("desc");
                }}
              >
                Reset Filters
              </Button>
            </PopoverContent>
          </Popover>

          {/* Hasil: X Paket */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-1 whitespace-nowrap">
            <span>
              Hasil:{" "}
              <span className="font-semibold text-foreground">
                {filteredPackages.length}
              </span>{" "}
              Paket
            </span>
          </div>
        </div>

        {/* Right side status indicator & count */}
        <div className="flex items-center justify-between sm:justify-end gap-2 text-xs font-semibold text-muted-foreground pt-1 sm:pt-0">
          <span className="text-[11px] sm:text-xs">Status aktif:</span>
          <Badge
            variant="outline"
            className={`text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-lg border ${
              statusFilter === "WAITING_APPROVAL"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                : statusFilter === "APPROVED"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : statusFilter === "REJECTED"
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    : "bg-primary/10 text-primary border-primary/20"
            }`}
          >
            {statusFilter === "WAITING_APPROVAL"
              ? `Menunggu (${counts.waiting})`
              : statusFilter === "APPROVED"
                ? `Disetujui (${counts.approved})`
                : statusFilter === "REJECTED"
                  ? `Ditolak (${counts.rejected})`
                  : `Semua (${counts.all})`}
          </Badge>
        </div>
      </div>

      {/* BULK ACTION FLOATING BAR */}
      {selectedPackageIds.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between p-3 px-4 bg-primary/10 border border-primary/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary text-primary-foreground font-bold text-xs">
              {selectedPackageIds.length} Terpilih
            </Badge>
            <span className="text-xs font-semibold text-foreground">
              Pilih tindakan massal:
            </span>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedPackageIds([])}
              className="h-8 text-xs font-semibold rounded-lg flex-1 sm:flex-initial"
            >
              Batal
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setIsBulkRejectOpen(true)}
              className="h-8 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 flex-1 sm:flex-initial justify-center"
            >
              <X className="w-3.5 h-3.5" />
              <span>Tolak Terpilih</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setIsBulkApproveOpen(true)}
              className="h-8 text-xs font-bold rounded-lg cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 flex-1 sm:flex-initial justify-center"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Setujui Terpilih</span>
            </Button>
          </div>
        </div>
      )}

      {/* SELECT ALL FOR WAITING APPROVAL */}
      {statusFilter === "WAITING_APPROVAL" && filteredPackages.length > 0 && (
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground font-medium">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all-packages"
              checked={
                selectedPackageIds.length > 0 &&
                selectedPackageIds.length ===
                  filteredPackages.filter(
                    (p) => p.ppicStatus === "WAITING_APPROVAL",
                  ).length
              }
              onCheckedChange={handleSelectAll}
              className="rounded-md"
            />
            <label
              htmlFor="select-all-packages"
              className="cursor-pointer select-none font-semibold hover:text-foreground text-xs"
            >
              Pilih Semua Koli Antrean ({filteredPackages.length})
            </label>
          </div>
          <span className="text-[11px]">
            Menampilkan {filteredPackages.length} paket
          </span>
        </div>
      )}

      {/* PACKAGE LIST CARDS */}
      {filteredPackages.length === 0 ? (
        <Card className="border border-dashed border-border/60 bg-muted/10 rounded-2xl p-8 sm:p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">
            Tidak Ada Paket Koli Ditemukan
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {statusFilter === "WAITING_APPROVAL"
              ? "Semua paket koli pengiriman yang siap kirim telah divalidasi oleh PPIC."
              : "Tidak ada data paket koli yang sesuai dengan kriteria filter saat ini."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPackages.map((pkg) => {
            const isSelected = selectedPackageIds.includes(pkg.id);
            const isDetailOpen = !!openDetailIds[pkg.id];
            const parsedItems = parseItems(pkg.itemName);
            const components = pkg.project_components || [];

            return (
              <Card
                key={pkg.id}
                className={`transition-all rounded-2xl border ${
                  isSelected
                    ? "border-primary/50 shadow-md bg-primary/5"
                    : pkg.ppicStatus === "WAITING_APPROVAL"
                      ? "border-amber-500/30 hover:border-amber-500/50 bg-card shadow-xs"
                      : pkg.ppicStatus === "APPROVED"
                        ? "border-emerald-500/20 bg-card shadow-xs"
                        : "border-rose-500/20 bg-card shadow-xs"
                }`}
              >
                {/* 3. LAYOUT HEADER: 
                    KIRI: Nomor Palet + DIBAWAHNYA Total Muatan Koli, Berat, Dimensi, Kubikasi
                    KANAN: Nomor Project + DIBAWAHNYA Nama Customer */}
                <CardHeader className="p-3.5 sm:p-4 pb-3 border-b border-border/40">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-start">
                    {/* SISI KIRI (KOLI & SPESIFIKASI MUATAN) */}
                    <div className="md:col-span-7 flex flex-col gap-2">
                      {/* Baris Atas Koli */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {pkg.ppicStatus === "WAITING_APPROVAL" && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectPackage(pkg.id)}
                            className="rounded-md"
                          />
                        )}

                        {/* 4. Nomor Lot saja (1, 2, dst) */}
                        <Badge
                          variant="outline"
                          className="h-6 w-6 p-0 flex items-center justify-center font-extrabold text-xs bg-primary/10 text-primary border-primary/25 rounded-md shrink-0"
                          title={`Koli ke-${pkg.lotNo || "1"}`}
                        >
                          {pkg.lotNo || "1"}
                        </Badge>

                        <span className="font-semibold text-sm text-foreground">
                          {pkg.code}
                        </span>

                        <Badge
                          variant="secondary"
                          className="text-[10px] font-semibold uppercase bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-md"
                        >
                          {pkg.packageType || "PALET"}
                        </Badge>

                        {/* PPIC Status Badge */}
                        {pkg.ppicStatus === "WAITING_APPROVAL" && (
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold text-[10px] sm:text-[11px] px-2 py-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Menunggu Validasi
                          </Badge>
                        )}
                        {pkg.ppicStatus === "APPROVED" && (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold text-[10px] sm:text-[11px] px-2 py-0.5 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Disetujui
                          </Badge>
                        )}
                        {pkg.ppicStatus === "REJECTED" && (
                          <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-semibold text-[10px] sm:text-[11px] px-2 py-0.5 flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Ditolak
                          </Badge>
                        )}
                      </div>

                      {/* 3. DIBAWAH NOMOR PALET: Keterangan Total Muatan, Berat, Dimensi, Kubikasi */}
                      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground bg-muted/20 sm:bg-transparent p-2 sm:p-0 rounded-xl sm:rounded-none border border-border/30 sm:border-0">
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-muted-foreground">Muatan:</span>
                          <span className="font-semibold text-foreground">
                            {pkg.qty} {pkg.unit}
                          </span>
                        </div>
                        <span className="text-border/60 hidden sm:inline">
                          •
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Scale className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-muted-foreground">Berat:</span>
                          <span className="font-semibold text-foreground">
                            {pkg.weight
                              ? `${pkg.weight.toLocaleString("id-ID")} kg`
                              : "-"}
                          </span>
                        </div>
                        <span className="text-border/60 hidden sm:inline">
                          •
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Maximize2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-muted-foreground">
                            Dimensi:
                          </span>
                          <span className="font-semibold text-foreground">
                            {pkg.dimensions || "-"} mm
                          </span>
                        </div>
                        <span className="text-border/60 hidden sm:inline">
                          •
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-muted-foreground">Volume:</span>
                          <span className="font-semibold text-foreground">
                            {pkg.cubication ? `${pkg.cubication} m³` : "-"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SISI KANAN (PROYEK & DIBAWAHNYA CUSTOMER) */}
                    <div className="md:col-span-5 flex flex-col md:items-end justify-start gap-1.5 pt-2 md:pt-0 border-t border-border/30 md:border-0">
                      {/* Baris Atas Proyek */}
                      <div className="flex items-center md:justify-end gap-1.5 text-xs text-muted-foreground font-semibold flex-wrap">
                        <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="text-foreground font-semibold">
                          {pkg.project?.projectNumber || "-"}
                        </span>
                        <span>•</span>
                        <span
                          className="truncate max-w-50 sm:max-w-65 text-foreground/90 font-medium"
                          title={pkg.project?.projectName}
                        >
                          {pkg.project?.projectName || "-"}
                        </span>
                      </div>

                      {/* 3. DIBAWAH NOMOR PROJECT: Nama Customer & Lokasi */}
                      {pkg.project?.customer && (
                        <div className="text-[11px] text-muted-foreground flex items-center md:justify-end gap-1.5 flex-wrap">
                          <span className="font-semibold text-foreground/80">
                            Customer:
                          </span>
                          <span className="font-semibold text-foreground">
                            {pkg.project.customer.company ||
                              pkg.project.customer.name ||
                              "-"}
                          </span>
                          {(pkg.project.customer.city ||
                            pkg.project.customer.province ||
                            pkg.project.customer.address) && (
                            <>
                              <span className="text-border/60">•</span>
                              <span
                                className="truncate max-w-45 sm:max-w-55 text-foreground/80"
                                title={[
                                  pkg.project.customer.address,
                                  pkg.project.customer.city,
                                  pkg.project.customer.province,
                                ]
                                  .filter(Boolean)
                                  .join(", ")}
                              >
                                {[
                                  pkg.project.customer.city,
                                  pkg.project.customer.province,
                                ]
                                  .filter(Boolean)
                                  .join(" - ") || pkg.project.customer.address}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-3.5 sm:p-4 space-y-3">
                  {/* REJECTION NOTES ALERT (IF REJECTED) */}
                  {pkg.ppicStatus === "REJECTED" && pkg.ppicNotes && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                      <div>
                        <span className="font-bold">
                          Alasan Penolakan PPIC:{" "}
                        </span>
                        <span>{pkg.ppicNotes}</span>
                        {pkg.ppicApprovedBy && (
                          <div className="text-[11px] text-rose-600/70 dark:text-rose-400/70 mt-1">
                            Oleh: {pkg.ppicApprovedBy} •{" "}
                            {pkg.ppicApprovedAt
                              ? format(
                                  new Date(pkg.ppicApprovedAt),
                                  "dd MMM yyyy, HH:mm",
                                  { locale: id },
                                )
                              : "-"}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* APPROVAL NOTES ALERT (IF APPROVED) */}
                  {pkg.ppicStatus === "APPROVED" && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                      <UserCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                      <div>
                        <span className="font-bold">
                          Disetujui untuk Penerbitan Surat Jalan
                        </span>
                        {pkg.ppicNotes && (
                          <span className="block text-muted-foreground mt-0.5">
                            Catatan: {pkg.ppicNotes}
                          </span>
                        )}
                        <div className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 mt-1">
                          Validator: {pkg.ppicApprovedBy || "PPIC"} •{" "}
                          {pkg.ppicApprovedAt
                            ? format(
                                new Date(pkg.ppicApprovedAt),
                                "dd MMM yyyy, HH:mm",
                                { locale: id },
                              )
                            : "-"}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. RINCIAN ITEM KOMPONEN (LENGKAP DENGAN KOLOM NOMOR & MOBILE SCROLL) */}
                  <div className="pt-0.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleDetail(pkg.id)}
                        className="h-7 px-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg flex items-center gap-1.5 cursor-pointer w-fit"
                      >
                        {isDetailOpen ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                        <span>
                          Rincian Item Komponen (
                          {components.length > 0
                            ? components.length
                            : parsedItems
                              ? parsedItems.length
                              : "1"}{" "}
                          Item)
                        </span>
                      </Button>

                      {pkg.ppicRequestedAt && (
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 pl-2 sm:pl-0">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            Diajukan:{" "}
                            {format(
                              new Date(pkg.ppicRequestedAt),
                              "dd MMM yyyy, HH:mm",
                              { locale: id },
                            )}
                            {pkg.ppicRequestedBy && ` (${pkg.ppicRequestedBy})`}
                          </span>
                        </div>
                      )}
                    </div>

                    {isDetailOpen && (
                      <div className="mt-2.5 border border-border/50 rounded-xl overflow-hidden bg-background/50 overflow-x-auto">
                        {components.length > 0 ? (
                          <div className="divide-y divide-border/40 text-xs min-w-130">
                            {/* Table Header with Nomor # */}
                            <div className="grid grid-cols-12 gap-2 p-2 bg-muted/40 font-bold text-muted-foreground text-[11px]">
                              <div className="col-span-1 text-center">No</div>
                              <div className="col-span-3">Kode Marking</div>
                              <div className="col-span-4">Nama Komponen</div>
                              <div className="col-span-2">
                                Material / Dimensi
                              </div>
                              <div className="col-span-2 text-right">
                                Jumlah
                              </div>
                            </div>
                            {/* Table Body with Nomor # */}
                            {components.map((c: any, cIdx: number) => (
                              <div
                                key={c.id}
                                className="grid grid-cols-12 gap-2 p-2 items-center hover:bg-muted/20"
                              >
                                <div className="col-span-1 text-center font-bold text-muted-foreground text-xs">
                                  {cIdx + 1}
                                </div>
                                <div className="col-span-3 font-mono font-bold text-primary truncate">
                                  {c.markingCode || "-"}
                                </div>
                                <div
                                  className="col-span-4 font-medium text-foreground"
                                  title={c.name}
                                >
                                  {c.name}
                                </div>
                                <div className="col-span-2 text-muted-foreground text-[11px]">
                                  {c.material || "-"}
                                  {c.dimensionP &&
                                    ` (${c.dimensionP}×${c.dimensionL || 0}×${
                                      c.dimensionT || 0
                                    })`}
                                </div>
                                <div className="col-span-2 text-right font-bold text-foreground">
                                  {c.qty} {c.unit || "PCS"}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : parsedItems && parsedItems.length > 0 ? (
                          <div className="divide-y divide-border/40 text-xs min-w-[460px]">
                            {/* Table Header with Nomor # */}
                            <div className="grid grid-cols-12 gap-2 p-2 bg-muted/40 font-bold text-muted-foreground text-[11px] uppercase">
                              <div className="col-span-1 text-center">No</div>
                              <div className="col-span-3">Kode Marking</div>
                              <div className="col-span-5">Nama Item</div>
                              <div className="col-span-3 text-right">
                                Jumlah
                              </div>
                            </div>
                            {/* Table Body with Nomor # */}
                            {parsedItems.map((item: any, idx: number) => (
                              <div
                                key={idx}
                                className="grid grid-cols-12 gap-2 p-2 items-center hover:bg-muted/20"
                              >
                                <div className="col-span-1 text-center font-bold text-muted-foreground text-xs">
                                  {idx + 1}
                                </div>
                                <div className="col-span-3 font-mono font-bold text-primary truncate">
                                  {item.markingCode || "-"}
                                </div>
                                <div className="col-span-5 font-medium text-foreground truncate">
                                  {item.itemName || "-"}
                                </div>
                                <div className="col-span-3 text-right font-bold text-foreground">
                                  {item.qty} {item.unit || "UNIT"}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 text-xs text-muted-foreground italic">
                            Muatan item: {pkg.itemName} ({pkg.qty} {pkg.unit})
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 1 & 5. ACTION BUTTONS: Responsif di Smartphone dengan Dialog Konfirmasi */}
                  <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2 border-t border-border/40">
                    {pkg.ppicStatus === "WAITING_APPROVAL" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRejectingPackage(pkg);
                            setRejectReason("");
                          }}
                          className="w-full sm:w-auto h-9 sm:h-8 px-3.5 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/25 rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Tolak Paket</span>
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => {
                            setApprovingPackage(pkg);
                            setApproveNotes("");
                          }}
                          className="w-full sm:w-auto h-9 sm:h-8 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Setujui (Approve)</span>
                        </Button>
                      </>
                    ) : pkg.ppicStatus === "REJECTED" ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          setApprovingPackage(pkg);
                          setApproveNotes("");
                        }}
                        className="w-full sm:w-auto h-9 sm:h-8 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Re-Approve Paket</span>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 5. DIALOG KONFIRMASI: APPROVE SINGLE PACKAGE */}
      <Dialog
        open={!!approvingPackage}
        onOpenChange={(open) => !open && setApprovingPackage(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>Konfirmasi Persetujuan Paket</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Apakah Anda yakin ingin menyetujui paket koli ini? Setelah
              disetujui, tim logistik dapat segera menerbitkan Surat Jalan
              resmi.
            </DialogDescription>
          </DialogHeader>

          {approvingPackage && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 border border-border/50">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kode Paket:</span>
                  <span className="font-semibold text-foreground">
                    {approvingPackage.code}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Koli / Lot:</span>
                  <span className="font-semibold text-foreground">
                    {approvingPackage.lotNo || "1"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Muatan:</span>
                  <span className="font-semibold text-foreground">
                    {approvingPackage.qty} {approvingPackage.unit} (
                    {approvingPackage.weight} kg)
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-xs text-foreground">
                  Catatan Persetujuan (Opsional)
                </label>
                <Textarea
                  placeholder="Contoh: Muatan dan alokasi kirim sesuai jadwal produksi..."
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  className="rounded-xl text-xs mt-2"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApprovingPackage(null)}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-semibold w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleApproveSubmit}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Menyetujui...
                </>
              ) : (
                "Ya, Setujui Paket"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. DIALOG KONFIRMASI: REJECT SINGLE PACKAGE */}
      <Dialog
        open={!!rejectingPackage}
        onOpenChange={(open) => !open && setRejectingPackage(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-rose-600">
              <XCircle className="w-5 h-5 shrink-0" />
              <span>Konfirmasi Penolakan Paket</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Apakah Anda yakin ingin menolak paket koli ini? Paket yang ditolak
              akan diblokir dari penerbitan Surat Jalan sampai muatan direvisi.
            </DialogDescription>
          </DialogHeader>

          {rejectingPackage && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 border border-border/50">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kode Paket:</span>
                  <span className="font-semibold text-foreground">
                    {rejectingPackage.code}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Koli / Lot:</span>
                  <span className="font-semibold text-foreground">
                    {rejectingPackage.lotNo || "1"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Muatan:</span>
                  <span className="font-semibold text-foreground">
                    {rejectingPackage.qty} {rejectingPackage.unit} (
                    {rejectingPackage.weight} kg)
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-xs text-foreground">
                  Alasan Penolakan <span className="text-rose-500">*</span>
                </label>
                <Textarea
                  placeholder="Contoh: Kuantitas melebihi batch pengiriman minggu ini. Pisahkan menjadi 1 unit per palet..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="rounded-xl text-xs mt-2 border-rose-500/30 focus-visible:ring-rose-500/20"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectingPackage(null)}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-semibold w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-bold cursor-pointer w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Menolak...
                </>
              ) : (
                "Ya, Tolak Paket"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. DIALOG KONFIRMASI: BULK APPROVE */}
      <Dialog open={isBulkApproveOpen} onOpenChange={setIsBulkApproveOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>
                Konfirmasi Persetujuan {selectedPackageIds.length} Paket
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Apakah Anda yakin ingin menyetujui seluruh{" "}
              {selectedPackageIds.length} paket terpilih sekaligus untuk
              penerbitan Surat Jalan?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 text-xs">
            <label className="font-bold text-xs text-foreground">
              Catatan Persetujuan Massal (Opsional)
            </label>
            <Textarea
              placeholder="Contoh: Disetujui serentak untuk batch pengiriman hari ini..."
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              className="rounded-xl text-xs resize-none"
              rows={3}
            />
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkApproveOpen(false)}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-semibold w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleBulkApproveSubmit}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Menyetujui...
                </>
              ) : (
                `Ya, Setujui ${selectedPackageIds.length} Paket`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. DIALOG KONFIRMASI: BULK REJECT */}
      <Dialog open={isBulkRejectOpen} onOpenChange={setIsBulkRejectOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-rose-600">
              <XCircle className="w-5 h-5 shrink-0" />
              <span>
                Konfirmasi Penolakan {selectedPackageIds.length} Paket
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Apakah Anda yakin ingin menolak seluruh{" "}
              {selectedPackageIds.length} paket terpilih sekaligus? Seluruh
              paket akan diblokir dari Surat Jalan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 text-xs">
            <label className="font-bold text-xs text-foreground">
              Alasan Penolakan <span className="text-rose-500">*</span>
            </label>
            <Textarea
              placeholder="Alasan penolakan untuk seluruh paket yang dipilih..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="rounded-xl text-xs resize-none border-rose-500/30 focus-visible:ring-rose-500/20"
              rows={3}
            />
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkRejectOpen(false)}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-semibold w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkRejectSubmit}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-bold cursor-pointer w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Menolak...
                </>
              ) : (
                `Ya, Tolak ${selectedPackageIds.length} Paket`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
