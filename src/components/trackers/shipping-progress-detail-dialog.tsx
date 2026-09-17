"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Truck,
  PackageCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  Boxes,
  Layers,
  CornerDownRight,
  ListFilter,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { getProjectShippingBreakdownAction } from "@/app/actions/shipping";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function CustomProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const safeVal = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div
      className={cn("w-full bg-muted rounded-full overflow-hidden", className)}
    >
      <div
        className="bg-primary h-full transition-all duration-300 rounded-full"
        style={{ width: `${safeVal}%` }}
      />
    </div>
  );
}

interface ShippingProgressDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  projectNumber?: string;
  clientName?: string;
}

export function ShippingProgressDetailDialog({
  isOpen,
  onClose,
  projectId,
  projectName,
  projectNumber,
  clientName,
}: ShippingProgressDetailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"packages" | "units">("packages");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Expanded states
  const [expandedPackageIds, setExpandedPackageIds] = useState<
    Record<string, boolean>
  >({});
  const [expandedUnitIds, setExpandedUnitIds] = useState<
    Record<string, boolean>
  >({});
  const [showAllComponentsUnitIds, setShowAllComponentsUnitIds] = useState<
    Record<string, boolean>
  >({});

  const fetchData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await getProjectShippingBreakdownAction(projectId);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error || "Gagal memuat rincian shipping.");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengambil data shipping.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, projectId]);

  const togglePackageExpand = (pkgId: string) => {
    setExpandedPackageIds((prev) => ({
      ...prev,
      [pkgId]: !prev[pkgId],
    }));
  };

  const toggleUnitExpand = (unitId: string) => {
    setExpandedUnitIds((prev) => ({
      ...prev,
      [unitId]: !prev[unitId],
    }));
  };

  const toggleShowAllComponents = (unitId: string) => {
    setShowAllComponentsUnitIds((prev) => ({
      ...prev,
      [unitId]: !prev[unitId],
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DELIVERED":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold shrink-0"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" /> Sampai di Site (100%)
          </Badge>
        );
      case "IN_DELIVERY":
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold shrink-0"
          >
            <Truck className="w-3 h-3 mr-1" /> Sedang Dikirim (60%)
          </Badge>
        );
      case "READY_TO_SHIP":
        return (
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] font-bold shrink-0"
          >
            <Clock className="w-3 h-3 mr-1" /> Siap Kirim (25%)
          </Badge>
        );
      case "RETUR":
        return (
          <Badge
            variant="outline"
            className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[10px] font-bold shrink-0"
          >
            <AlertCircle className="w-3 h-3 mr-1" /> Retur / Kendala
          </Badge>
        );
      case "NOT_SHIPPED":
        return (
          <Badge
            variant="outline"
            className="bg-muted text-muted-foreground border-border/80 text-[10px] font-medium shrink-0"
          >
            Belum Dikirim (0%)
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="bg-muted text-muted-foreground text-[10px] shrink-0"
          >
            {status || "Draft"}
          </Badge>
        );
    }
  };

  // Filter Koli / Packages
  const filteredPackages = useMemo(() => {
    if (!data || !data.allPackages) return [];

    let list = [...data.allPackages];

    // Filter status
    if (statusFilter !== "ALL") {
      list = list.filter((p) => p.status === statusFilter);
    }

    // Filter query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((pkg) => {
        const matchCode = (pkg.packageCode || "").toLowerCase().includes(q);
        const matchLot = (pkg.lotNo || "").toLowerCase().includes(q);
        const matchSJ = (pkg.suratJalanNo || "").toLowerCase().includes(q);
        const matchDriver = (pkg.driverName || "").toLowerCase().includes(q);
        const matchPlate = (pkg.vehiclePlate || "").toLowerCase().includes(q);
        const matchUnit = (pkg.unitName || "").toLowerCase().includes(q);
        const matchUnitMark = (pkg.unitMarkingCode || "")
          .toLowerCase()
          .includes(q);

        // Cari di dalam komponen dan sub-komponen
        const matchComp = (pkg.components || []).some((c: any) => {
          const cName = (c.name || "").toLowerCase().includes(q);
          const cMark = (c.markingCode || "").toLowerCase().includes(q);
          const cMat = (c.material || "").toLowerCase().includes(q);
          const subMatch = (c.subComponents || []).some((s: any) => {
            return (
              (s.name || "").toLowerCase().includes(q) ||
              (s.markingCode || "").toLowerCase().includes(q) ||
              (s.dimensionOrSpec || "").toLowerCase().includes(q)
            );
          });
          return cName || cMark || cMat || subMatch;
        });

        return (
          matchCode ||
          matchLot ||
          matchSJ ||
          matchDriver ||
          matchPlate ||
          matchUnit ||
          matchUnitMark ||
          matchComp
        );
      });
    }

    return list;
  }, [data, statusFilter, searchQuery]);

  // Filter Unit Conveyor
  const filteredUnits = useMemo(() => {
    if (!data || !data.units) return [];
    if (!searchQuery.trim()) return data.units;

    const q = searchQuery.toLowerCase().trim();
    return data.units.filter((u: any) => {
      const nameMatch = (u.unitName || "").toLowerCase().includes(q);
      const markMatch = (u.markingCode || "").toLowerCase().includes(q);
      const tagMatch = (u.bundleTag || "").toLowerCase().includes(q);
      const pkgMatch = (u.packages || []).some((p: any) => {
        return (
          (p.packageCode || "").toLowerCase().includes(q) ||
          (p.suratJalanNo || "").toLowerCase().includes(q) ||
          (p.components || []).some(
            (c: any) =>
              (c.name || "").toLowerCase().includes(q) ||
              (c.markingCode || "").toLowerCase().includes(q),
          )
        );
      });
      const compMatch = (u.components || []).some((c: any) => {
        return (
          (c.name || "").toLowerCase().includes(q) ||
          (c.markingCode || "").toLowerCase().includes(q)
        );
      });
      return nameMatch || markMatch || tagMatch || pkgMatch || compMatch;
    });
  }, [data, searchQuery]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl! max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl">
        {/* DIALOG HEADER */}
        <DialogHeader className="p-5 border-b bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                  Monitoring Pengiriman & Packing List
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>
                    No. Proyek:{" "}
                    <span className="font-semibold text-foreground font-mono">
                      {projectNumber && projectNumber !== "-"
                        ? projectNumber
                        : data?.projectNumber || "-"}
                    </span>
                  </span>
                  <span>•</span>
                  <span>
                    Proyek:{" "}
                    <span className="font-semibold text-foreground">
                      {projectName || data?.projectName || "-"}
                    </span>
                  </span>
                  <span>•</span>
                  <span>
                    Client:{" "}
                    <span className="font-semibold text-foreground">
                      {clientName && clientName !== "-"
                        ? clientName
                        : data?.clientName || "-"}
                    </span>
                  </span>
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="h-8 gap-1.5 text-xs font-semibold rounded-lg"
            >
              <RefreshCw
                className={cn("w-3.5 h-3.5", loading && "animate-spin")}
              />
              Refresh
            </Button>
          </div>

          {/* S-CURVE & METRICS SUMMARY */}
          {data && (
            <div className="mt-4 space-y-3">
              <div className="p-3.5 bg-background rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="w-full sm:w-1/2 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <PackageCheck className="w-4 h-4 text-primary" />
                      Progres Total Shipment Proyek (Masterplan)
                    </span>
                    <span className="font-extrabold text-primary text-sm">
                      {data.phaseActualProgress}%
                    </span>
                  </div>
                  <CustomProgressBar
                    value={data.phaseActualProgress}
                    className="h-2"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    *100% tercapai jika seluruh koli & komponen berstatus{" "}
                    <b>DELIVERED</b>.
                  </p>
                </div>

                {/* 4 Metrics Box Koli */}
                <div className="grid grid-cols-4 gap-2 w-full sm:w-1/2 border-t sm:border-t-0 sm:border-l pt-2 sm:pt-0 sm:pl-4 text-center">
                  <div className="bg-muted/30 p-2 rounded-lg">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">
                      Total Koli
                    </p>
                    <p className="text-base font-extrabold text-foreground mt-0.5">
                      {data.totalPackagesCount || 0}
                    </p>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg">
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold">
                      Sampai Site
                    </p>
                    <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {data.deliveredPackagesCount || 0}
                    </p>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold">
                      Sedang Dikirim
                    </p>
                    <p className="text-base font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
                      {data.inDeliveryPackagesCount || 0}
                    </p>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 p-2 rounded-lg">
                    <p className="text-[10px] text-blue-700 dark:text-blue-400 uppercase font-bold">
                      Siap Kirim
                    </p>
                    <p className="text-base font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
                      {data.readyToShipPackagesCount || 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* TAB SWITCHER & FILTER BAR */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                {/* View Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/60 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setActiveTab("packages")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                      activeTab === "packages"
                        ? "bg-background text-primary shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    View per Koli / Packing List
                    <Badge
                      variant="secondary"
                      className="ml-1 text-[10px] py-0 px-1.5 h-4.5 font-bold"
                    >
                      {data.totalPackagesCount || 0}
                    </Badge>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("units")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                      activeTab === "units"
                        ? "bg-background text-primary shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    View per Unit Conveyor
                    <Badge
                      variant="secondary"
                      className="ml-1 text-[10px] py-0 px-1.5 h-4.5 font-bold"
                    >
                      {data.totalUnits || 0}
                    </Badge>
                  </button>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 flex-1 sm:justify-end">
                  {/* Search Input */}
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder={
                        activeTab === "packages"
                          ? "Cari koli, marking, komponen..."
                          : "Cari nama unit, marking..."
                      }
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 pr-2.5 text-xs bg-background rounded-lg border-border/70"
                    />
                  </div>

                  {/* Status Filter for Packages View */}
                  {activeTab === "packages" && (
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="h-8 px-2 text-xs bg-background border border-border/70 rounded-lg text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shrink-0"
                    >
                      <option value="ALL">Semua Status</option>
                      <option value="DELIVERED">Sampai di Site (100%)</option>
                      <option value="IN_DELIVERY">Sedang Dikirim (60%)</option>
                      <option value="READY_TO_SHIP">Siap Kirim (25%)</option>
                      <option value="RETUR">Retur / Kendala</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* DIALOG BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
          {loading && !data ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <RefreshCw className="w-7 h-7 animate-spin text-primary" />
              <p className="text-xs font-medium">
                Mengambil data koli, packing list, dan marking komponen...
              </p>
            </div>
          ) : !data ? (
            <div className="py-16 text-center text-muted-foreground text-xs">
              Gagal memuat data pengiriman proyek.
            </div>
          ) : activeTab === "packages" ? (
            /* ======================================================== */
            /* TAB 1: VIEW PER KOLI / PACKING LIST                      */
            /* ======================================================== */
            filteredPackages.length === 0 ? (
              <div className="py-14 text-center text-muted-foreground text-xs border rounded-xl bg-muted/10">
                {searchQuery || statusFilter !== "ALL"
                  ? "Tidak ada koli / packing list yang sesuai dengan kriteria pencarian atau filter."
                  : "Belum ada koli / packing list yang terdaftar pada proyek ini."}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPackages.map((pkg: any) => {
                  const isExpanded = !!expandedPackageIds[pkg.packageId];
                  const components = pkg.components || [];

                  return (
                    <div
                      key={pkg.packageId}
                      className={cn(
                        "rounded-xl border transition-all overflow-hidden bg-card shadow-xs",
                        pkg.status === "DELIVERED"
                          ? "border-emerald-500/30 hover:border-emerald-500/50"
                          : pkg.status === "IN_DELIVERY"
                            ? "border-amber-500/30 hover:border-amber-500/50"
                            : "border-border hover:border-border/80",
                      )}
                    >
                      {/* CARD HEADER KOLI */}
                      <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card">
                        <div className="flex items-start gap-3">
                          {/* Lot Number Badge */}
                          <div
                            className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-extrabold text-xs shrink-0 mt-0.5"
                            title={`Koli ke-${pkg.lotNo || "1"}`}
                          >
                            #{pkg.lotNo || "1"}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-foreground font-mono">
                                {pkg.packageCode}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-semibold uppercase px-1.5 py-0"
                              >
                                {pkg.packageType || "PALET"}
                              </Badge>
                            </div>

                            {/* Dimensi, Berat, & Muatan */}
                            <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                              {pkg.weight && (
                                <span>
                                  Berat: <b>{pkg.weight} kg</b>
                                </span>
                              )}
                              {pkg.dimensions && (
                                <>
                                  <span>•</span>
                                  <span>
                                    Dimensi: <b>{pkg.dimensions}</b>
                                  </span>
                                </>
                              )}
                              {pkg.cubication && Number(pkg.cubication) > 0 && (
                                <>
                                  <span>•</span>
                                  <span>
                                    Kubikasi:{" "}
                                    <b>
                                      {Number(pkg.cubication).toFixed(2)} m³
                                    </b>
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Ekspedisi & Surat Jalan */}
                            <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-0.5 pt-0.5">
                              {pkg.suratJalanNo ? (
                                <span className="font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded text-[10px]">
                                  📄 SJ: {pkg.suratJalanNo}
                                </span>
                              ) : (
                                <span className="italic text-muted-foreground text-[10px]">
                                  Belum terikat Surat Jalan
                                </span>
                              )}
                              {pkg.driverName && (
                                <span>
                                  Driver: <b>{pkg.driverName}</b>
                                </span>
                              )}
                              {pkg.vehiclePlate && (
                                <span>
                                  Plat: <b>{pkg.vehiclePlate}</b>
                                </span>
                              )}
                              {pkg.deliveryDate && (
                                <span>
                                  Tgl Kirim:{" "}
                                  {new Date(
                                    pkg.deliveryDate,
                                  ).toLocaleDateString("id-ID")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action & Status Right */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0">
                          <div className="flex items-center gap-1.5">
                            {getStatusBadge(pkg.status)}
                            {pkg.deliveryProofUrl && (
                              <a
                                href={pkg.deliveryProofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 text-primary hover:bg-primary/10 rounded-md transition-colors"
                                title="Lihat Bukti Foto Tanda Terima Pengiriman"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>

                          {/* Tombol Expand Komponen & Sub-Komponen */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePackageExpand(pkg.packageId)}
                            className="h-7 px-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                            <span>
                              Rincian Komponen ({components.length} Item)
                            </span>
                          </Button>
                        </div>
                      </div>

                      {/* ACCORDION: RINCIAN BREAKDOWN KOMPONEN & SUB-KOMPONEN */}
                      {isExpanded && (
                        <div className="border-t bg-muted/20 p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                              <Boxes className="w-3.5 h-3.5 text-primary" />
                              Breakdown Komponen & Sub-Komponen di Packing List
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {pkg.packageCode}
                            </span>
                          </div>

                          {components.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic py-2">
                              Belum ada rincian komponen spesifik yang terdaftar
                              di koli ini.
                            </p>
                          ) : (
                            <div className="border border-border/60 rounded-xl overflow-hidden bg-background overflow-x-auto">
                              <table className="w-full text-xs text-left min-w-162.5">
                                <thead className="bg-muted/60 text-muted-foreground text-[11px] font-bold border-b border-border/60 uppercase">
                                  <tr>
                                    <th className="py-2 px-3 text-center w-12">
                                      No
                                    </th>
                                    <th className="py-2 px-3">
                                      Nama Komponen
                                    </th>
                                    <th className="py-2 px-3 w-36">
                                      Kode Marking
                                    </th>
                                    <th className="py-2 px-3 w-48">
                                      Unit Conveyor
                                    </th>
                                    <th className="py-2 px-3 w-36">
                                      Spesifikasi
                                    </th>
                                    <th className="py-2 px-3 text-right w-24">
                                      Jumlah
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                  {components.map((c: any, cIdx: number) => {
                                    const hasSub =
                                      c.subComponents &&
                                      c.subComponents.length > 0;

                                    return (
                                      <React.Fragment key={c.id || cIdx}>
                                        {/* Baris Komponen Utama */}
                                        <tr className="hover:bg-muted/30 transition-colors">
                                          <td className="py-2 px-3 text-center font-bold text-muted-foreground text-xs">
                                            {cIdx + 1}
                                          </td>
                                          <td className="py-2 px-3 font-semibold text-foreground">
                                            <div className="flex items-center gap-1.5">
                                              <span>{c.name}</span>
                                              {c.category && (
                                                <Badge
                                                  variant="outline"
                                                  className="text-[9px] py-0 px-1 font-semibold text-muted-foreground"
                                                >
                                                  {c.category}
                                                </Badge>
                                              )}
                                            </div>
                                          </td>
                                          <td className="py-2 px-3">
                                            <Badge
                                              variant="secondary"
                                              className="font-mono font-bold text-primary bg-primary/10 border border-primary/20 text-[11px] py-0 px-1.5"
                                            >
                                              {c.markingCode || "-"}
                                            </Badge>
                                          </td>
                                          <td className="py-2 px-3">
                                            {c.parentUnitName ? (
                                              <div className="flex flex-col">
                                                <span
                                                  className="font-semibold text-foreground text-[11px] leading-tight line-clamp-1"
                                                  title={c.parentUnitName}
                                                >
                                                  {c.parentUnitName}
                                                </span>
                                                {c.parentUnitMarkingCode && (
                                                  <span className="text-[10px] font-mono text-primary font-bold">
                                                    [{c.parentUnitMarkingCode}]
                                                  </span>
                                                )}
                                              </div>
                                            ) : (
                                              <span className="text-muted-foreground text-[11px] italic">
                                                -
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-muted-foreground text-[11px]">
                                            {c.material || c.dimensions || "-"}
                                          </td>
                                          <td className="py-2 px-3 text-right font-extrabold text-foreground">
                                            {c.qty} {c.unit || "PCS"}
                                          </td>
                                        </tr>

                                        {/* Baris Sub-Komponen (Jika Ada) */}
                                        {hasSub &&
                                          c.subComponents.map(
                                            (sub: any, sIdx: number) => (
                                              <tr
                                                key={sub.id || sIdx}
                                                className="bg-muted/15 hover:bg-muted/25 transition-colors text-[11px]"
                                              >
                                                <td className="py-1.5 px-3 text-center text-muted-foreground">
                                                  {/* bullet or branch */}
                                                </td>
                                                <td className="py-1.5 px-3 text-foreground/90 font-medium pl-6">
                                                  <div className="flex items-center gap-1.5">
                                                    <CornerDownRight className="w-3 h-3 shrink-0 text-muted-foreground/60" />
                                                    <span>{sub.name}</span>
                                                    <span className="text-[9px] text-muted-foreground bg-muted px-1 py-0.2 rounded font-normal">
                                                      Sub-Item
                                                    </span>
                                                  </div>
                                                </td>
                                                <td className="py-1.5 px-3">
                                                  <Badge
                                                    variant="outline"
                                                    className="font-mono font-bold text-[10px] py-0 px-1 border-border/80 bg-background"
                                                  >
                                                    {sub.markingCode || "-"}
                                                  </Badge>
                                                </td>
                                                <td className="py-1.5 px-3 text-muted-foreground/50 text-[10px] italic">
                                                  ↳
                                                </td>
                                                <td className="py-1.5 px-3 text-muted-foreground">
                                                  {sub.dimensionOrSpec || "-"}
                                                </td>
                                                <td className="py-1.5 px-3 text-right font-semibold text-foreground/80">
                                                  {sub.qty} {sub.satuan || "pcs"}
                                                </td>
                                              </tr>
                                            ),
                                          )}
                                      </React.Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : /* ======================================================== */
          /* TAB 2: VIEW PER UNIT CONVEYOR                            */
          /* ======================================================== */
          filteredUnits.length === 0 ? (
            <div className="py-14 text-center text-muted-foreground text-xs border rounded-xl bg-muted/10">
              Tidak ada unit conveyor yang sesuai dengan pencarian.
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredUnits.map((unit: any) => {
                const isUnitExpanded = !!expandedUnitIds[unit.unitId];
                const showAllComps = !!showAllComponentsUnitIds[unit.unitId];
                const unitComponents = unit.components || [];

                return (
                  <div
                    key={unit.unitId}
                    className={cn(
                      "rounded-xl border transition-all overflow-hidden bg-card",
                      unit.isFullyDelivered
                        ? "border-emerald-500/30 bg-emerald-500/[0.02]"
                        : unit.actualProgress > 0
                          ? "border-primary/30 bg-primary/[0.01]"
                          : "border-border hover:border-border/80",
                    )}
                  >
                    {/* UNIT CARD HEADER */}
                    <div
                      onClick={() => toggleUnitExpand(unit.unitId)}
                      className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-muted/40 transition-colors select-none"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground p-0.5"
                        >
                          {isUnitExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground">
                              {unit.unitName}
                            </span>
                            {unit.markingCode && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-mono py-0 px-1.5 font-bold"
                              >
                                {unit.markingCode}
                              </Badge>
                            )}
                            {unit.bundleTag && (
                              <Badge
                                variant="outline"
                                className="text-[9px] py-0 px-1 font-semibold text-muted-foreground"
                              >
                                {unit.bundleTag}
                              </Badge>
                            )}
                          </div>

                          {/* Subtitle Ringkasan Status Komponen Unit */}
                          <p className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2">
                            {unit.totalComponents > 0 ? (
                              <>
                                <span>
                                  Total: <b>{unit.totalComponents} Komponen</b>{" "}
                                  ({unit.totalKoli} koli)
                                </span>
                                <span>•</span>
                                <span>
                                  Sampai:{" "}
                                  <b className="text-emerald-600">
                                    {unit.deliveredComponents || 0}
                                  </b>
                                </span>
                                <span>•</span>
                                <span>
                                  Sedang Dikirim:{" "}
                                  <b className="text-amber-600">
                                    {unit.inDeliveryComponents || 0}
                                  </b>
                                </span>
                                <span>•</span>
                                <span>
                                  Siap:{" "}
                                  <b className="text-blue-600">
                                    {unit.readyToShipComponents || 0}
                                  </b>
                                </span>
                                <span>•</span>
                                <span>
                                  Belum Dikirim:{" "}
                                  <b className="text-muted-foreground font-semibold">
                                    {unit.notShippedComponents || 0}
                                  </b>
                                </span>
                              </>
                            ) : (
                              <span className="italic text-amber-600/80">
                                Belum ada komponen yang terdaftar untuk unit ini
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-xs font-black text-foreground">
                            {unit.actualProgress}%
                          </span>
                          <CustomProgressBar
                            value={unit.actualProgress}
                            className="w-20 h-1.5 mt-1"
                          />
                        </div>
                        {unit.isFullyDelivered ? (
                          <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                            Sampai Penuh
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              unit.actualProgress > 0
                                ? "text-primary border-primary/40 font-semibold"
                                : "text-muted-foreground",
                            )}
                          >
                            Parsial ({unit.actualProgress}%)
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* EXPANDED CONTENT DI BAWAH UNIT */}
                    {isUnitExpanded && (
                      <div className="border-t bg-muted/20 p-3.5 space-y-4">
                        {/* 1. KOLI / PACKING LIST YANG MEMUAT KOMPONEN UNIT INI */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                              <Boxes className="w-3.5 h-3.5 text-primary" />
                              Koli Pengiriman Terkait Unit Ini (
                              {unit.packages.length} Koli):
                            </p>
                            <span className="text-[10px] text-muted-foreground italic">
                              *Menampilkan komponen yang menjadi milik{" "}
                              {unit.unitName}
                            </span>
                          </div>

                          {unit.packages.length === 0 ? (
                            <div className="p-3 rounded-lg border border-dashed bg-background/50 text-center text-xs text-muted-foreground italic">
                              Belum ada komponen dari unit ini yang dikemas ke
                              dalam koli pengiriman.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {unit.packages.map((pkg: any) => {
                                const isPkgExpanded =
                                  !!expandedPackageIds[pkg.packageId];
                                const components = pkg.components || [];

                                return (
                                  <div
                                    key={pkg.packageId}
                                    className="bg-background rounded-lg border p-3 text-xs space-y-2 shadow-xs"
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-primary font-mono">
                                            {pkg.packageCode}
                                          </span>
                                          <span className="text-[11px] text-muted-foreground">
                                            (Lot #{pkg.lotNo})
                                          </span>
                                          {pkg.suratJalanNo && (
                                            <span className="font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded text-[10px]">
                                              📄 SJ: {pkg.suratJalanNo}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-3">
                                          {pkg.driverName && (
                                            <span>
                                              Driver: <b>{pkg.driverName}</b>
                                            </span>
                                          )}
                                          {pkg.vehiclePlate && (
                                            <span>
                                              Plat: <b>{pkg.vehiclePlate}</b>
                                            </span>
                                          )}
                                          {pkg.deliveryDate && (
                                            <span>
                                              Tgl:{" "}
                                              {new Date(
                                                pkg.deliveryDate,
                                              ).toLocaleDateString("id-ID")}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        {getStatusBadge(pkg.status)}
                                        {pkg.deliveryProofUrl && (
                                          <a
                                            href={pkg.deliveryProofUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors"
                                            title="Lihat Bukti Foto Tanda Terima"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                          </a>
                                        )}

                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            togglePackageExpand(pkg.packageId)
                                          }
                                          className="h-6 px-1.5 text-[11px] text-primary hover:bg-primary/10 rounded font-semibold cursor-pointer"
                                        >
                                          {isPkgExpanded ? (
                                            <ChevronDown className="w-3 h-3 mr-1" />
                                          ) : (
                                            <ChevronRight className="w-3 h-3 mr-1" />
                                          )}
                                          Breakdown Komponen (
                                          {components.length})
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Breakdown Komponen Khusus Milik Unit Ini */}
                                    {isPkgExpanded && (
                                      <div className="mt-2 border-t pt-2">
                                        {components.length === 0 ? (
                                          <p className="text-[11px] text-muted-foreground italic">
                                            Belum ada rincian komponen milik
                                            unit ini di koli ini.
                                          </p>
                                        ) : (
                                          <div className="border rounded-lg overflow-hidden bg-muted/10">
                                            <table className="w-full text-[11px] text-left">
                                              <thead className="bg-muted/40 text-muted-foreground font-bold border-b text-[10px] uppercase">
                                                <tr>
                                                  <th className="p-1.5 text-center w-8">
                                                    No
                                                  </th>
                                                  <th className="p-1.5 w-36">
                                                    Kode Marking
                                                  </th>
                                                  <th className="p-1.5">
                                                    Nama Komponen Milik{" "}
                                                    {unit.unitName}
                                                  </th>
                                                  <th className="p-1.5 text-right w-20">
                                                    Qty
                                                  </th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-border/30">
                                                {components.map(
                                                  (c: any, cIdx: number) => (
                                                    <React.Fragment
                                                      key={c.id || cIdx}
                                                    >
                                                      <tr className="hover:bg-background/80">
                                                        <td className="p-1.5 text-center font-bold text-muted-foreground">
                                                          {cIdx + 1}
                                                        </td>
                                                        <td className="p-1.5">
                                                          <Badge
                                                            variant="secondary"
                                                            className="font-mono text-[10px] py-0 px-1 font-bold text-primary"
                                                          >
                                                            {c.markingCode ||
                                                              "-"}
                                                          </Badge>
                                                        </td>
                                                        <td className="p-1.5 font-medium text-foreground">
                                                          {c.name}
                                                        </td>
                                                        <td className="p-1.5 text-right font-bold">
                                                          {c.qty}{" "}
                                                          {c.unit || "PCS"}
                                                        </td>
                                                      </tr>
                                                    </React.Fragment>
                                                  ),
                                                )}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* 2. REKAP SELURUH KOMPONEN UNIT & STATUS PENGIRIMAN */}
                        {unitComponents.length > 0 && (
                          <div className="border-t pt-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  toggleShowAllComponents(unit.unitId)
                                }
                                className="h-7 text-xs font-semibold text-foreground hover:bg-muted gap-1.5"
                              >
                                <ListFilter className="w-3.5 h-3.5 text-primary" />
                                {showAllComps ? "Tutup" : "Lihat"} Status
                                Seluruh Komponen Unit ({unitComponents.length}{" "}
                                Item)
                              </Button>
                              <span className="text-[11px] text-muted-foreground">
                                Tuntas:{" "}
                                <b className="text-emerald-600">
                                  {unit.deliveredComponents}
                                </b>{" "}
                                dari {unit.totalComponents} komponen
                              </span>
                            </div>

                            {showAllComps && (
                              <div className="border border-border/70 rounded-xl overflow-hidden bg-background overflow-x-auto mt-2">
                                <table className="w-full text-xs text-left min-w-[550px]">
                                  <thead className="bg-muted/60 text-muted-foreground text-[10px] font-bold border-b uppercase">
                                    <tr>
                                      <th className="py-2 px-2.5 text-center w-10">
                                        No
                                      </th>
                                      <th className="py-2 px-2.5 w-36">
                                        Kode Marking
                                      </th>
                                      <th className="py-2 px-2.5">
                                        Nama Komponen
                                      </th>
                                      <th className="py-2 px-2.5 w-24 text-center">
                                        Kategori
                                      </th>
                                      <th className="py-2 px-2.5 text-right w-16">
                                        Qty
                                      </th>
                                      <th className="py-2 px-2.5 w-36">
                                        Status Pengiriman
                                      </th>
                                      <th className="py-2 px-2.5 w-32">
                                        No. Koli / SJ
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/40 text-[11px]">
                                    {unitComponents.map(
                                      (comp: any, idx: number) => (
                                        <tr
                                          key={comp.id || idx}
                                          className="hover:bg-muted/25 transition-colors"
                                        >
                                          <td className="py-2 px-2.5 text-center font-bold text-muted-foreground">
                                            {idx + 1}
                                          </td>
                                          <td className="py-2 px-2.5">
                                            <Badge
                                              variant="outline"
                                              className="font-mono text-[10px] py-0 px-1 font-bold text-primary border-primary/30"
                                            >
                                              {comp.markingCode || "-"}
                                            </Badge>
                                          </td>
                                          <td className="py-2 px-2.5 font-medium text-foreground">
                                            {comp.name}
                                          </td>
                                          <td className="py-2 px-2.5 text-center">
                                            <Badge
                                              variant="secondary"
                                              className="text-[9px] py-0 px-1 font-semibold text-muted-foreground uppercase"
                                            >
                                              {comp.category}
                                            </Badge>
                                          </td>
                                          <td className="py-2 px-2.5 text-right font-bold">
                                            {comp.qty} {comp.satuan || "pcs"}
                                          </td>
                                          <td className="py-2 px-2.5">
                                            {getStatusBadge(
                                              comp.shippingStatus,
                                            )}
                                          </td>
                                          <td className="py-2 px-2.5 text-[10px] text-muted-foreground">
                                            {comp.packageCode ? (
                                              <div>
                                                <span className="font-mono font-semibold text-foreground">
                                                  {comp.packageCode}
                                                </span>
                                                {comp.suratJalanNo && (
                                                  <span className="block text-[9px]">
                                                    SJ: {comp.suratJalanNo}
                                                  </span>
                                                )}
                                              </div>
                                            ) : (
                                              <span className="italic text-muted-foreground">
                                                -
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      ),
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
