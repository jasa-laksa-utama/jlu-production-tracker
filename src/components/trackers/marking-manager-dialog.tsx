"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tag,
  Search,
  Printer,
  Edit2,
  Check,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Layers,
  RefreshCw,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getProjectMarkingOverview,
  updateItemMarking,
  assignMarkingCodeBulk,
  MarkingOverviewItem,
  MarkingTargetType,
} from "@/app/actions/marking-management";
import { MarkingPDFPreviewDialog } from "./marking-pdf-preview-dialog";

export interface MarkingManagerPanelProps {
  projectId: string;
  projectName?: string;
  isDialog?: boolean;
  onClose?: () => void;
}

export function MarkingManagerPanel({
  projectId,
  projectName = "Proyek",
  isDialog = false,
  onClose,
}: MarkingManagerPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<MarkingOverviewItem[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>("ALL");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");

  // Selection for Bulk Marking Code
  const [selectedItemIds, setSelectedItemIds] = useState<
    { id: string; type: MarkingTargetType }[]
  >([]);
  const [bulkMarkingInput, setBulkMarkingInput] = useState("");
  const [isBulkPopoverOpen, setIsBulkPopoverOpen] = useState(false);

  // Inline Editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editMarkingCode, setEditMarkingCode] = useState("");

  // PDF Preview Dialog State
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);

  const fetchOverview = async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const res = await getProjectMarkingOverview(projectId);
      if (res.success && res.data) {
        setItems(res.data);
        setUnits(res.units || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchOverview();
      setSelectedItemIds([]);
      setEditingItemId(null);
    }
  }, [projectId]);

  // Filter items
  const filteredItems = items.filter((item) => {
    // Unit Filter
    if (selectedUnitFilter !== "ALL" && item.unitId !== selectedUnitFilter) {
      return false;
    }
    // Type Filter
    if (selectedTypeFilter !== "ALL") {
      if (selectedTypeFilter === "UNIT" && item.type !== "UNIT") return false;
      if (
        selectedTypeFilter === "MAIN" &&
        item.type !== "STRUCTURE" &&
        item.type !== "MECHANICAL"
      )
        return false;
      if (
        selectedTypeFilter === "SUB" &&
        item.type !== "STRUCTURE_SUB" &&
        item.type !== "MECHANICAL_SUB"
      )
        return false;
    }
    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchUnit = item.unitName.toLowerCase().includes(q);
      const matchMarking = item.markingCode?.toLowerCase().includes(q);
      return matchName || matchUnit || matchMarking;
    }
    return true;
  });

  const totalMarked = items.filter((i) => Boolean(i.markingCode)).length;
  const totalItems = items.length;
  const markedPercent =
    totalItems > 0 ? Math.round((totalMarked / totalItems) * 100) : 0;
  const uniqueCodeCount = new Set(
    items.map((i) => i.markingCode).filter((b): b is string => Boolean(b))
  ).size;

  // Frekuensi tiap kode marking (untuk mendeteksi kode yang dipakai bersama/bundel)
  const codeCounts = items.reduce<Record<string, number>>((acc, item) => {
    if (item.markingCode) {
      acc[item.markingCode] = (acc[item.markingCode] || 0) + 1;
    }
    return acc;
  }, {});

  // Toggle Single Selection
  const toggleSelect = (id: string, type: MarkingTargetType) => {
    setSelectedItemIds((prev) => {
      const exists = prev.some((i) => i.id === id);
      if (exists) {
        return prev.filter((i) => i.id !== id);
      } else {
        return [...prev, { id, type }];
      }
    });
  };

  // Select All Filtered
  const toggleSelectAll = () => {
    if (
      selectedItemIds.length === filteredItems.length &&
      filteredItems.length > 0
    ) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(
        filteredItems.map((i) => ({ id: i.id, type: i.type }))
      );
    }
  };

  // Handle Save Inline Edit
  const handleSaveInline = (item: MarkingOverviewItem) => {
    startTransition(async () => {
      const res = await updateItemMarking(
        item.type,
        item.id,
        editMarkingCode.trim() || null
      );

      if (res.success) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  markingCode: editMarkingCode.trim() || null,
                }
              : i
          )
        );
        toast.success("Kode marking diperbarui");
        setEditingItemId(null);
      } else {
        toast.error(res.error || "Gagal memperbarui kode marking");
      }
    });
  };

  // Handle Assign Marking Code Bulk
  const handleAssignBulk = () => {
    if (!bulkMarkingInput.trim()) {
      toast.error("Kode marking tidak boleh kosong");
      return;
    }
    if (selectedItemIds.length === 0) {
      toast.error("Pilih minimal 1 item terlebih dahulu");
      return;
    }

    startTransition(async () => {
      const res = await assignMarkingCodeBulk(
        selectedItemIds,
        bulkMarkingInput.trim()
      );
      if (res.success) {
        toast.success(
          `Kode "${bulkMarkingInput.trim()}" diterapkan ke ${res.count} item`
        );
        setIsBulkPopoverOpen(false);
        setBulkMarkingInput("");
        setSelectedItemIds([]);
        fetchOverview();
      } else {
        toast.error(res.error || "Gagal menerapkan kode marking");
      }
    });
  };

  // Handle Cetak Lembar PDF
  const handlePrint = () => {
    setIsPdfPreviewOpen(true);
  };

  const content = (
    <div className="space-y-4">
      {/* Header & Overview Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs">
          <span className="text-muted-foreground text-[11px] font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-primary" />
            Total Item Part
          </span>
          <p className="text-xl font-bold text-foreground mt-1">
            {totalItems} Part
          </p>
          <span className="text-[10px] text-muted-foreground">
            Unit, Komponen & Sub-Part
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs">
          <span className="text-muted-foreground text-[11px] font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Sudah Ter-Marking
          </span>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {totalMarked} Item
          </p>
          <span className="text-[10px] text-muted-foreground">
            {markedPercent}% Dari Total
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs">
          <span className="text-muted-foreground text-[11px] font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            Belum Di-Marking
          </span>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {totalItems - totalMarked} Item
          </p>
          <span className="text-[10px] text-muted-foreground">
            Perlu Kodifikasi
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs">
          <span className="text-muted-foreground text-[11px] font-semibold flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-blue-600" />
            Kode Terdaftar
          </span>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {uniqueCodeCount} Kode
          </p>
          <span className="text-[10px] text-muted-foreground">
            Sendiri & Bundel/Palet
          </span>
        </div>
      </div>

      {/* Action Toolbar & Search */}
      <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 flex flex-wrap items-center justify-between gap-2.5">
        {/* Search & Filters */}
        <div className="flex items-center gap-2 flex-1 min-w-70 flex-wrap">
          <div className="relative flex-1 min-w-45">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari part atau kode marking..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs pl-8 bg-background rounded-lg font-medium"
            />
          </div>

          {/* Filter Unit */}
          <select
            value={selectedUnitFilter}
            onChange={(e) => setSelectedUnitFilter(e.target.value)}
            className="h-8 text-xs px-2.5 py-1 bg-background border border-border/80 rounded-lg outline-none cursor-pointer text-foreground font-semibold"
          >
            <option value="ALL">Semua Unit ({units.length})</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          {/* Filter Level Tipe */}
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="h-8 text-xs px-2.5 py-1 bg-background border border-border/80 rounded-lg outline-none cursor-pointer text-foreground font-semibold"
          >
            <option value="ALL">Semua Level</option>
            <option value="UNIT">Hanya Unit</option>
            <option value="MAIN">Komponen Utama</option>
            <option value="SUB">Sub-Komponen</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Refresh Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchOverview}
            disabled={isLoading}
            className="h-8 text-xs font-semibold rounded-lg cursor-pointer"
            title="Muat Ulang Data"
          >
            <RefreshCw
              className={cn("w-3.5 h-3.5", isLoading && "animate-spin")}
            />
          </Button>

          {/* Bulk Marking Button */}
          {selectedItemIds.length > 0 && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setIsBulkPopoverOpen(!isBulkPopoverOpen)}
              className="h-8 text-xs font-bold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-xs animate-in fade-in gap-1.5"
            >
              <Tag className="w-3.5 h-3.5" />
              Beri Kode Marking ({selectedItemIds.length} item)
            </Button>
          )}

          {/* Print Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-8 text-xs font-semibold rounded-lg cursor-pointer gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak Lembar
          </Button>
        </div>
      </div>

      {/* Popover Card: Bulk Assign Marking Code */}
      {isBulkPopoverOpen && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-primary" />
              Tetapkan Kode Marking Terpilih ({selectedItemIds.length} Item)
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsBulkPopoverOpen(false)}
              className="h-6 w-6"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Tuliskan kode marking (bisa kode part individual atau kode bundel/palet bersama, misalnya:{" "}
            <code className="bg-background px-1 py-0.5 rounded mx-1 text-primary font-mono text-[10px]">
              BC01-STR-01
            </code>{" "}
            atau{" "}
            <code className="bg-background px-1 py-0.5 rounded mx-1 text-primary font-mono text-[10px]">
              PALET-01
            </code>
            ).
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Input
              placeholder="Contoh: BC01-STR-01 / PALET-01 / TRUK-A"
              value={bulkMarkingInput}
              onChange={(e) => setBulkMarkingInput(e.target.value)}
              className="h-8 text-xs max-w-sm bg-background font-mono font-bold"
              autoFocus
            />
            <Button
              type="button"
              size="sm"
              disabled={isPending || !bulkMarkingInput.trim()}
              onClick={handleAssignBulk}
              className="h-8 text-xs font-bold px-4 cursor-pointer"
            >
              {isPending && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              Terapkan Kode
            </Button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="rounded-xl border border-border/80 bg-background overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            <p className="text-xs font-medium">Memuat data marking proyek...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground space-y-2">
            <Tag className="w-8 h-8 mx-auto opacity-30" />
            <p className="text-sm font-semibold">Tidak ada item ditemukan</p>
            <p className="text-xs max-w-sm mx-auto">
              Coba sesuaikan pencarian atau filter unit di atas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader className="bg-muted/40 sticky top-0 z-10 shadow-2xs">
                <TableRow className="h-9 border-b border-border/60 hover:bg-transparent">
                  <TableHead className="w-10 text-center">
                    <Checkbox
                      checked={
                        selectedItemIds.length === filteredItems.length &&
                        filteredItems.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                      className="cursor-pointer"
                      title="Pilih Semua Baris"
                    />
                  </TableHead>
                  <TableHead className="w-12 text-center text-xs font-semibold">
                    No
                  </TableHead>
                  <TableHead className="w-28 text-xs font-semibold">
                    Unit Conveyor
                  </TableHead>
                  <TableHead className="w-28 text-xs font-semibold">
                    Level Tipe
                  </TableHead>
                  <TableHead className="text-xs font-semibold">
                    Deskripsi Item / Part
                  </TableHead>
                  <TableHead className="w-20 text-center text-xs font-semibold">
                    Qty
                  </TableHead>
                  <TableHead className="w-48 text-xs font-semibold">
                    Kode Marking
                  </TableHead>
                  <TableHead className="w-24 text-center text-xs font-semibold">
                    Status
                  </TableHead>
                  <TableHead className="w-16 text-right text-xs font-semibold pr-3">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item, idx) => {
                  const isSelected = selectedItemIds.some(
                    (i) => i.id === item.id
                  );
                  const isEditing = editingItemId === item.id;
                  const isSharedCode =
                    item.markingCode &&
                    (codeCounts[item.markingCode] || 0) > 1;

                  return (
                    <TableRow
                      key={`${item.type}-${item.id}`}
                      className={cn(
                        "h-10 transition-colors border-b border-border/40 hover:bg-muted/30 text-xs",
                        isSelected && "bg-primary/5",
                        item.type === "UNIT" && "bg-muted/20 font-semibold"
                      )}
                    >
                      {/* Checkbox */}
                      <TableCell className="text-center py-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() =>
                            toggleSelect(item.id, item.type)
                          }
                          className="cursor-pointer"
                        />
                      </TableCell>

                      {/* No */}
                      <TableCell className="text-center py-2 text-muted-foreground font-mono text-[11px]">
                        {idx + 1}
                      </TableCell>

                      {/* Unit Name */}
                      <TableCell className="py-2 font-medium">
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 font-semibold"
                        >
                          {item.unitName}
                        </Badge>
                      </TableCell>

                      {/* Level Type */}
                      <TableCell className="py-2">
                        {item.type === "UNIT" ? (
                          <Badge
                            variant="secondary"
                            className="text-[9px] font-bold uppercase bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                          >
                            Unit
                          </Badge>
                        ) : item.type === "STRUCTURE" ? (
                          <Badge
                            variant="outline"
                            className="text-[9px] font-bold uppercase border-blue-300 text-blue-600 bg-blue-50/50"
                          >
                            Struktur
                          </Badge>
                        ) : item.type === "MECHANICAL" ? (
                          <Badge
                            variant="outline"
                            className="text-[9px] font-bold uppercase border-purple-300 text-purple-600 bg-purple-50/50"
                          >
                            Mekanikal
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-[9px] font-medium uppercase text-muted-foreground bg-muted"
                          >
                            Sub-Part
                          </Badge>
                        )}
                      </TableCell>

                      {/* Item Name */}
                      <TableCell className="py-2">
                        <div className="flex flex-col">
                          <span
                            className={cn(
                              "font-semibold text-foreground",
                              item.type === "UNIT" && "text-primary font-bold"
                            )}
                          >
                            {item.name}
                          </span>
                          {(item.dimensionOrSpec || item.parentName) && (
                            <span className="text-[10px] text-muted-foreground">
                              {item.parentName
                                ? `Bagian dari: ${item.parentName}`
                                : item.dimensionOrSpec}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Qty */}
                      <TableCell className="text-center py-2 text-muted-foreground font-semibold">
                        {item.qty} {item.satuan}
                      </TableCell>

                      {/* Kode Marking */}
                      <TableCell className="py-2">
                        {isEditing ? (
                          <Input
                            value={editMarkingCode}
                            onChange={(e) => setEditMarkingCode(e.target.value)}
                            placeholder="Kode..."
                            className="h-7 text-xs font-mono font-bold"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveInline(item);
                              if (e.key === "Escape") setEditingItemId(null);
                            }}
                          />
                        ) : item.markingCode ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-mono font-bold px-2 py-0.5 shadow-2xs",
                                isSharedCode
                                  ? "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300"
                                  : "bg-background border-primary/40 text-primary"
                              )}
                            >
                              <Tag className="w-2.5 h-2.5 mr-1" />
                              {item.markingCode}
                            </Badge>
                            {isSharedCode && (
                              <span
                                className="text-[9px] font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950 px-1 py-0.2 rounded"
                                title={`Kode ini dipakai bersama (${codeCounts[item.markingCode]} part)`}
                              >
                                Bundel ({codeCounts[item.markingCode]})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/40 italic">
                            Belum Ada
                          </span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center py-2">
                        {item.markingCode ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                            <CheckCircle2 className="w-3 h-3" /> Siap
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                            <AlertCircle className="w-3 h-3 opacity-40" /> Kosong
                          </span>
                        )}
                      </TableCell>

                      {/* Aksi */}
                      <TableCell className="text-right py-2 pr-3">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={isPending}
                              onClick={() => handleSaveInline(item)}
                              className="h-7 w-7 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditingItemId(null)}
                              className="h-7 w-7 text-muted-foreground hover:bg-muted cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingItemId(item.id);
                              setEditMarkingCode(item.markingCode || "");
                            }}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Dialog Preview & Cetak Lembar PDF */}
      <MarkingPDFPreviewDialog
        open={isPdfPreviewOpen}
        onOpenChange={setIsPdfPreviewOpen}
        projectName={projectName}
        items={filteredItems}
        unitFilterName={
          selectedUnitFilter === "ALL"
            ? "Semua Unit"
            : units.find((u) => u.id === selectedUnitFilter)?.name || "Unit Terpilih"
        }
        typeFilterName={
          selectedTypeFilter === "ALL"
            ? "Semua Level"
            : selectedTypeFilter === "UNIT"
            ? "Hanya Unit"
            : selectedTypeFilter === "MAIN"
            ? "Komponen Utama"
            : "Sub-Komponen"
        }
      />
    </div>
  );

  if (isDialog) {
    return content;
  }

  return (
    <Card className="rounded-2xl border shadow-sm overflow-hidden bg-card/60 backdrop-blur-md">
      <CardHeader className="p-4 sm:p-5 border-b bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold shadow-inner">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              Manajemen Kode Marking
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Kodifikasi fisik komponen (kode mandiri per-part maupun kode bundel/palet pengiriman).
            </CardDescription>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-bold px-3 py-1 rounded-lg",
              markedPercent === 100
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                : markedPercent > 0
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-muted text-muted-foreground border-border"
            )}
          >
            🏷️ {totalMarked} / {totalItems} Item Ditandai ({markedPercent}%)
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">{content}</CardContent>
    </Card>
  );
}

export interface MarkingManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

export function MarkingManagerDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: MarkingManagerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl! max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border-border/80 shadow-2xl">
        <DialogHeader className="p-5 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold shadow-inner">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Manajemen Kode Marking
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Proyek:{" "}
                  <span className="font-semibold text-foreground">
                    {projectName}
                  </span>
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 overflow-y-auto max-h-[calc(92vh-130px)]">
          <MarkingManagerPanel
            projectId={projectId}
            projectName={projectName}
            isDialog={true}
            onClose={() => onOpenChange(false)}
          />
        </div>

        <div className="p-4 border-t border-border/60 bg-muted/10 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            💡 <span className="font-semibold">Tips:</span> Centang beberapa item lalu klik <b>"Beri Kode Marking"</b> untuk memberi kode bundel/palet yang sama pada beberapa part sekaligus.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs font-semibold px-4 cursor-pointer"
          >
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
