"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { type DateRange } from "react-day-picker";
import {
  Building2,
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  ArrowRight,
  TrendingUp,
  CreditCard,
  RefreshCw,
  HelpCircle,
  Layers,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatJakartaDate } from "@/lib/date-utils";
import { formatRupiah, cn } from "@/lib/utils";
import { OfficeBoQDialog } from "@/components/office/office-boq-dialog";
import { OfficeSPBDialog } from "@/components/office/office-spb-dialog";
import { OfficeSPBDetailDialog } from "@/components/office/office-spb-detail-dialog";
import {
  deleteOfficeBoQ,
  deleteOfficeSPB,
} from "@/app/actions/office-procurement";

interface OfficeProcurementViewProps {
  initialData: {
    metrics: {
      totalBoqs: number;
      pendingSpbs: number;
      approvedSpbs: number;
      totalSpendEstimate: number;
    };
    boqs: any[];
    spbs: any[];
  };
}

export function OfficeProcurementView({
  initialData,
}: OfficeProcurementViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("boq");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Pagination states
  const [spbPage, setSpbPage] = useState(1);
  const [spbPageSize, setSpbPageSize] = useState(10);
  const [boqPage, setBoqPage] = useState(1);
  const [boqPageSize, setBoqPageSize] = useState(10);

  // Dialog States
  const [boqDialogOpen, setBoqDialogOpen] = useState(false);
  const [editingBoq, setEditingBoq] = useState<any | null>(null);

  const [spbDialogOpen, setSpbDialogOpen] = useState(false);
  const [editingSpb, setEditingSpb] = useState<any | null>(null);
  const [spbFromBoqId, setSpbFromBoqId] = useState<string | null>(null);

  const [detailSpb, setDetailSpb] = useState<any | null>(null);

  const { metrics, boqs, spbs } = initialData;

  // Filter Date Helper
  const isDateInRange = (dateStr: string | Date | null | undefined) => {
    if (!dateRange?.from) return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const from = new Date(dateRange.from);
    from.setHours(0, 0, 0, 0);
    if (d < from) return false;
    if (dateRange.to) {
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);
      if (d > to) return false;
    }
    return true;
  };

  // Sort Helper
  const sortItemsByDate = <T extends { createdAt: string | Date }>(
    items: T[]
  ): T[] => {
    return [...items].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });
  };

  // Filter & Sort SPBs
  const filteredSpbs = sortItemsByDate(
    spbs.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (s.spbNumber || "").toLowerCase().includes(q) ||
        (s.purpose || "").toLowerCase().includes(q) ||
        (s.makerName || "").toLowerCase().includes(q) ||
        (s.department || "").toLowerCase().includes(q);

      const matchStatus = statusFilter === "ALL" || s.status === statusFilter;
      const matchDate = isDateInRange(s.createdAt);

      return matchSearch && matchStatus && matchDate;
    })
  );

  // Filter & Sort BOQs
  const filteredBoqs = sortItemsByDate(
    boqs.filter((b) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (b.boqNumber || "").toLowerCase().includes(q) ||
        (b.title || "").toLowerCase().includes(q) ||
        (b.makerName || "").toLowerCase().includes(q);

      const matchDate = isDateInRange(b.createdAt);

      return matchSearch && matchDate;
    })
  );

  // Pagination for SPB
  const spbTotalPages = Math.ceil(filteredSpbs.length / spbPageSize) || 1;
  const paginatedSpbs = filteredSpbs.slice(
    (spbPage - 1) * spbPageSize,
    spbPage * spbPageSize
  );

  // Pagination for BOQ
  const boqTotalPages = Math.ceil(filteredBoqs.length / boqPageSize) || 1;
  const paginatedBoqs = filteredBoqs.slice(
    (boqPage - 1) * boqPageSize,
    boqPage * boqPageSize
  );

  // Count active filters
  const activeFilterCount =
    (statusFilter !== "ALL" && activeTab === "spb" ? 1 : 0) +
    (dateRange?.from ? 1 : 0) +
    (sortOrder !== "desc" ? 1 : 0);

  const handleResetFilter = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setDateRange(undefined);
    setSortOrder("desc");
    setSpbPage(1);
    setBoqPage(1);
    setIsFilterOpen(false);
  };

  // Handlers
  const handleOpenCreateBoq = () => {
    setEditingBoq(null);
    setBoqDialogOpen(true);
  };

  const handleOpenEditBoq = (boq: any) => {
    setEditingBoq(boq);
    setBoqDialogOpen(true);
  };

  const handleDeleteBoq = async (id: string, numberStr: string) => {
    if (!confirm(`Hapus BOQ Umum "${numberStr}"?`)) return;
    try {
      const res = await deleteOfficeBoQ(id);
      if (!res.success) throw new Error(res.error);
      toast.success(res.message || "BOQ Umum berhasil dihapus.");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus BOQ.");
    }
  };

  const handleOpenCreateSpb = (fromBoqId?: string) => {
    setEditingSpb(null);
    setSpbFromBoqId(fromBoqId || null);
    setSpbDialogOpen(true);
  };

  const handleOpenEditSpb = (spb: any) => {
    setEditingSpb(spb);
    setSpbFromBoqId(null);
    setSpbDialogOpen(true);
  };

  const handleDeleteSpb = async (id: string, numberStr: string) => {
    if (!confirm(`Hapus pengajuan SPB Umum "${numberStr}"?`)) return;
    try {
      const res = await deleteOfficeSPB(id);
      if (!res.success) throw new Error(res.error);
      toast.success(res.message || "SPB Umum berhasil dihapus.");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus SPB.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Disetujui
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[10px] font-bold gap-1">
            <XCircle className="w-3 h-3" />
            Ditolak
          </Badge>
        );
      case "COMPLETED":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] font-bold gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Selesai Dibeli
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold gap-1">
            <Clock className="w-3 h-3" />
            Menunggu Review
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* 1. HEADER HALAMAN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Building2 className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Pengadaan Umum & Kantor
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Portal khusus Admin Kantor untuk membuat BOQ Umum dan pengajuan SPB
            operasional non-proyek.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            size="sm"
            onClick={handleOpenCreateBoq}
            className="h-8.5 px-3.5 rounded-xl text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Buat BOQ Umum
          </Button>
        </div>
      </div>

      {/* 2. RINGKASAN 4 METRIK OPERASIONAL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total BOQ Umum */}
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">
                Total BOQ Kantor
              </span>
              <div className="text-2xl font-bold text-foreground">
                {metrics.totalBoqs}
              </div>
              <span className="text-[10px] text-muted-foreground">
                Paket rencana kebutuhan
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* SPB Menunggu Persetujuan */}
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">
                SPB Menunggu Approval
              </span>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {metrics.pendingSpbs}
              </div>
              <span className="text-[10px] text-muted-foreground">
                Perlu review manajemen
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* SPB Disetujui */}
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">
                SPB Disetujui
              </span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {metrics.approvedSpbs}
              </div>
              <span className="text-[10px] text-muted-foreground">
                Siap dieksekusi pembelian
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Estimasi Total Belanja */}
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">
                Estimasi Total Belanja
              </span>
              <div className="text-lg font-bold text-foreground truncate max-w-40">
                {formatRupiah(metrics.totalSpendEstimate)}
              </div>
              <span className="text-[10px] text-muted-foreground">
                Dari seluruh SPB aktif
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <CreditCard className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. TABS: SPB UMUM & BOQ UMUM */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val);
        }}
        className="space-y-4"
      >
        {/* TOOLBAR: SEARCH & FILTER DI KIRI, TAB DI KANAN */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Sebelah Kiri: Search Bar & Filter Terpusat */}
          <div className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSpbPage(1);
                  setBoqPage(1);
                }}
                placeholder="Cari nomor, keperluan, pemohon..."
                className="h-8.5 pl-8 text-xs rounded-xl bg-background"
              />
            </div>

            {/* Filter Terpusat Popover */}
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8.5 px-3 rounded-xl text-xs font-semibold gap-1.5 border-border/80 hover:bg-muted cursor-pointer shrink-0"
                  >
                    <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Filter</span>
                    {activeFilterCount > 0 && (
                      <Badge
                        variant="default"
                        className="h-4.5 min-w-4.5 px-1 text-[10px] font-bold rounded-full bg-primary text-primary-foreground ml-0.5"
                      >
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                }
              />
              <PopoverContent
                className="w-80 p-4 space-y-3.5 rounded-2xl shadow-xl"
                align="start"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    <Filter className="w-3.5 h-3.5 text-primary" />
                    <span>Filter & Urutan Data</span>
                  </div>
                  {activeFilterCount > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {activeFilterCount} filter aktif
                    </span>
                  )}
                </div>

                {/* Filter Status (Khusus Tab SPB) */}
                {activeTab === "spb" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Status Pengajuan SPB
                    </label>
                    <Select
                      value={statusFilter}
                      onValueChange={(val) => {
                        setStatusFilter(val || "ALL");
                        setSpbPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Semua Status" />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="ALL">Semua Status</SelectItem>
                        <SelectItem value="PENDING_APPROVAL">
                          Menunggu Review
                        </SelectItem>
                        <SelectItem value="APPROVED">Disetujui</SelectItem>
                        <SelectItem value="COMPLETED">Selesai Dibeli</SelectItem>
                        <SelectItem value="REJECTED">Ditolak</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Filter Tanggal Dibuat */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Tanggal Dibuat
                  </label>
                  <DateRangePicker
                    date={dateRange}
                    setDate={(range) => {
                      setDateRange(range);
                      setSpbPage(1);
                      setBoqPage(1);
                    }}
                  />
                </div>

                {/* Urutan Ascending / Descending */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Urutan Tanggal
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={sortOrder === "desc" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSortOrder("desc");
                        setSpbPage(1);
                        setBoqPage(1);
                      }}
                      className="h-8 text-xs font-medium gap-1.5 cursor-pointer"
                    >
                      <ArrowDownWideNarrow className="w-3.5 h-3.5" />
                      Terbaru (Desc)
                    </Button>
                    <Button
                      type="button"
                      variant={sortOrder === "asc" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSortOrder("asc");
                        setSpbPage(1);
                        setBoqPage(1);
                      }}
                      className="h-8 text-xs font-medium gap-1.5 cursor-pointer"
                    >
                      <ArrowUpNarrowWide className="w-3.5 h-3.5" />
                      Terlama (Asc)
                    </Button>
                  </div>
                </div>

                {/* Reset Filter Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8 font-semibold text-muted-foreground hover:text-foreground cursor-pointer mt-1"
                  onClick={handleResetFilter}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Reset Filter
                </Button>
              </PopoverContent>
            </Popover>
          </div>

          {/* Sebelah Kanan: Tab BOQ & SPB */}
          <TabsList className="bg-muted/60 p-1 rounded-xl h-9 shrink-0 self-start md:self-auto">
            <TabsTrigger
              value="boq"
              className="text-xs font-bold rounded-lg px-4 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Daftar BOQ Umum</span>
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 font-bold ml-1"
              >
                {filteredBoqs.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="spb"
              className="text-xs font-bold rounded-lg px-4 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Daftar SPB Umum</span>
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 font-bold ml-1"
              >
                {filteredSpbs.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB CONTENT 1: DAFTAR BOQ UMUM */}
        <TabsContent value="boq" className="mt-0 space-y-2.5">
          {/* Pagination Controls Di Atas Tabel BOQ */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground px-1">
            <div className="flex items-center gap-2">
              <span>
                Menampilkan{" "}
                <span className="font-semibold text-foreground">
                  {filteredBoqs.length === 0
                    ? 0
                    : (boqPage - 1) * boqPageSize + 1}
                  -
                  {Math.min(boqPage * boqPageSize, filteredBoqs.length)}
                </span>{" "}
                dari{" "}
                <span className="font-semibold text-foreground">
                  {filteredBoqs.length}
                </span>{" "}
                BOQ
              </span>
              <div className="flex items-center gap-1.5 ml-2 border-l pl-2.5">
                <span className="text-[11px]">Tampilkan:</span>
                <select
                  value={boqPageSize}
                  onChange={(e) => {
                    setBoqPageSize(Number(e.target.value));
                    setBoqPage(1);
                  }}
                  className="h-7 rounded-lg border border-border bg-background px-2 text-xs text-foreground cursor-pointer font-medium"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 rounded-lg cursor-pointer"
                disabled={boqPage <= 1}
                onClick={() => setBoqPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="font-medium text-foreground text-xs">
                Halaman {boqPage} dari {boqTotalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 rounded-lg cursor-pointer"
                disabled={boqPage >= boqTotalPages}
                onClick={() => setBoqPage((p) => Math.min(boqTotalPages, p + 1))}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <Card className="rounded-2xl border border-border/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">No. BOQ</th>
                    <th className="p-3 min-w-48">Judul Rencana Kebutuhan</th>
                    <th className="p-3">Pembuat</th>
                    <th className="p-3 w-20 text-center">Item</th>
                    <th className="p-3 text-right">Total Anggaran</th>
                    <th className="p-3 text-center">SPB Terkait</th>
                    <th className="p-3 text-center">Tgl Dibuat</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredBoqs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="p-8 text-center text-muted-foreground"
                      >
                        <div className="max-w-sm mx-auto space-y-2">
                          <FileSpreadsheet className="w-8 h-8 text-muted-foreground/50 mx-auto" />
                          <p className="font-semibold text-foreground text-xs">
                            Belum ada BOQ Umum Kantor.
                          </p>
                          <p className="text-[11px]">
                            Klik tombol <strong>+ Buat BOQ Umum</strong> untuk
                            mendata estimasi kebutuhan barang kantor.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedBoqs.map((boq, idx) => (
                      <tr
                        key={boq.id}
                        className="hover:bg-muted/15 transition-colors group"
                      >
                        <td className="p-3 text-center text-muted-foreground font-mono">
                          {(boqPage - 1) * boqPageSize + idx + 1}
                        </td>
                        <td className="p-3 font-semibold font-mono text-primary">
                          {boq.boqNumber}
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-foreground block">
                            {boq.title}
                          </span>
                          {boq.notes && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-64 block">
                              {boq.notes}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-medium text-foreground">
                          {boq.makerName || "Admin Kantor"}
                        </td>
                        <td className="p-3 text-center font-bold">
                          {boq.items?.length || 0}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-foreground">
                          {formatRupiah(boq.totalEstimate || 0)}
                        </td>
                        <td className="p-3 text-center">
                          {boq.spbs && boq.spbs.length > 0 ? (
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-semibold bg-primary/10 text-primary"
                            >
                              {boq.spbs.length} SPB
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">
                              -
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center text-muted-foreground">
                          {formatJakartaDate(boq.createdAt, "date")}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleOpenCreateSpb(boq.id)}
                              className="h-7 px-2.5 rounded-lg text-[11px] font-bold bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 transition-all cursor-pointer gap-1 shadow-2xs"
                              title="Buat pengajuan SPB dari item-item BOQ ini"
                            >
                              <span>Buat SPB</span>
                              <ArrowRight className="w-3 h-3" />
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 cursor-pointer text-muted-foreground"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                }
                              />
                              <DropdownMenuContent
                                align="end"
                                className="w-36 text-xs"
                              >
                                <DropdownMenuItem
                                  onClick={() => handleOpenEditBoq(boq)}
                                  className="cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5 mr-2 text-amber-600" />
                                  Edit BOQ
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleDeleteBoq(boq.id, boq.boqNumber)
                                  }
                                  className="cursor-pointer text-rose-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                                  Hapus BOQ
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB CONTENT 2: DAFTAR SPB UMUM */}
        <TabsContent value="spb" className="mt-0 space-y-2.5">
          {/* Pagination Controls Di Atas Tabel SPB */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground px-1">
            <div className="flex items-center gap-2">
              <span>
                Menampilkan{" "}
                <span className="font-semibold text-foreground">
                  {filteredSpbs.length === 0
                    ? 0
                    : (spbPage - 1) * spbPageSize + 1}
                  -
                  {Math.min(spbPage * spbPageSize, filteredSpbs.length)}
                </span>{" "}
                dari{" "}
                <span className="font-semibold text-foreground">
                  {filteredSpbs.length}
                </span>{" "}
                SPB
              </span>
              <div className="flex items-center gap-1.5 ml-2 border-l pl-2.5">
                <span className="text-[11px]">Tampilkan:</span>
                <select
                  value={spbPageSize}
                  onChange={(e) => {
                    setSpbPageSize(Number(e.target.value));
                    setSpbPage(1);
                  }}
                  className="h-7 rounded-lg border border-border bg-background px-2 text-xs text-foreground cursor-pointer font-medium"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 rounded-lg cursor-pointer"
                disabled={spbPage <= 1}
                onClick={() => setSpbPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="font-medium text-foreground text-xs">
                Halaman {spbPage} dari {spbTotalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 rounded-lg cursor-pointer"
                disabled={spbPage >= spbTotalPages}
                onClick={() => setSpbPage((p) => Math.min(spbTotalPages, p + 1))}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <Card className="rounded-2xl border border-border/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">No. SPB</th>
                    <th className="p-3 min-w-44">Keperluan Pengadaan</th>
                    <th className="p-3">Departemen</th>
                    <th className="p-3">Pemohon</th>
                    <th className="p-3 w-20 text-center">Item</th>
                    <th className="p-3 text-right">Estimasi Biaya</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Tgl Butuh</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredSpbs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="p-8 text-center text-muted-foreground"
                      >
                        <div className="max-w-sm mx-auto space-y-2">
                          <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto" />
                          <p className="font-semibold text-foreground text-xs">
                            Belum ada pengajuan SPB Umum.
                          </p>
                          <p className="text-[11px]">
                            SPB dibuat berdasarkan paket BOQ. Buka tab{" "}
                            <strong>Daftar BOQ Umum</strong> lalu klik tombol{" "}
                            <strong>Buat SPB</strong> pada baris BOQ yang ingin
                            diajukan.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedSpbs.map((spb, idx) => (
                      <tr
                        key={spb.id}
                        className="hover:bg-muted/15 transition-colors group"
                      >
                        <td className="p-3 text-center text-muted-foreground font-mono">
                          {(spbPage - 1) * spbPageSize + idx + 1}
                        </td>
                        <td className="p-3 font-semibold font-mono text-primary">
                          <button
                            type="button"
                            onClick={() => setDetailSpb(spb)}
                            className="hover:underline cursor-pointer text-left"
                          >
                            {spb.spbNumber}
                          </button>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-foreground block">
                            {spb.purpose}
                          </span>
                          {spb.officeBoq && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Layers className="w-3 h-3 text-teal-600" />
                              Rujukan: {spb.officeBoq.boqNumber}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {spb.department || "Umum"}
                        </td>
                        <td className="p-3 font-medium text-foreground">
                          {spb.makerName || "Admin Kantor"}
                        </td>
                        <td className="p-3 text-center font-bold">
                          {spb.items?.length || 0}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-foreground">
                          {formatRupiah(spb.totalEstimate || 0)}
                        </td>
                        <td className="p-3 text-center">
                          {getStatusBadge(spb.status)}
                        </td>
                        <td className="p-3 text-center text-muted-foreground">
                          {spb.requiredDate
                            ? formatJakartaDate(spb.requiredDate, "date")
                            : "-"}
                        </td>
                        <td className="p-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 cursor-pointer text-muted-foreground"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent
                              align="end"
                              className="w-40 text-xs"
                            >
                              <DropdownMenuItem
                                onClick={() => setDetailSpb(spb)}
                                className="cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 mr-2 text-primary" />
                                Detail & Review
                              </DropdownMenuItem>

                              {spb.status === "PENDING_APPROVAL" && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleOpenEditSpb(spb)}
                                    className="cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5 mr-2 text-amber-600" />
                                    Edit Pengajuan
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleDeleteSpb(spb.id, spb.spbNumber)
                                    }
                                    className="cursor-pointer text-rose-600"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                                    Hapus SPB
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOGS */}
      <OfficeBoQDialog
        open={boqDialogOpen}
        onOpenChange={setBoqDialogOpen}
        boqToEdit={editingBoq}
        onSuccess={() => router.refresh()}
      />

      <OfficeSPBDialog
        open={spbDialogOpen}
        onOpenChange={setSpbDialogOpen}
        spbToEdit={editingSpb}
        boqList={boqs}
        initialBoqId={spbFromBoqId}
        onSuccess={() => router.refresh()}
      />

      <OfficeSPBDetailDialog
        spb={detailSpb}
        open={!!detailSpb}
        onOpenChange={(open) => !open && setDetailSpb(null)}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
