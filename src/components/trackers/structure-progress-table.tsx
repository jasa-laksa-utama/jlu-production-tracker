"use client";

import React, { useTransition, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Hammer,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Loader2,
  GripVertical,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { QCRevisionDetailDialog } from "@/components/trackers/qc-revision-detail-dialog";
import {
  updateStructureItemChecklist,
  updateStructureItemDetails,
  addStructureItemsToUnit,
  deleteStructureItem,
  reorderStructureItems,
} from "@/app/actions/conveyor-progress";

// Custom simple Progress bar to avoid dependency on progress.tsx
function CustomProgress({ value }: { value: number }) {
  return (
    <div className="w-full bg-muted dark:bg-muted/40 rounded-full h-2 overflow-hidden">
      <div
        className="bg-primary h-full transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function StructureProgressTable({ units }: { units: any[] }) {
  const [isPending, startTransition] = useTransition();
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>(
    units.reduce((acc, u) => ({ ...acc, [u.id]: true }), {}),
  );
  const [selectedRevisionData, setSelectedRevisionData] = useState<{
    open: boolean;
    revision: any;
    itemType: "STRUCTURE" | "MECHANICAL";
    itemName: string;
    stageName: string;
    unitName: string;
  } | null>(null);

  // State for Add Component Dialog
  const [addModalUnit, setAddModalUnit] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [itemsList, setItemsList] = useState<
    Array<{ name: string; qty: number; satuan: string }>
  >([{ name: "", qty: 1, satuan: "set" }]);
  const [bulkText, setBulkText] = useState("");
  const [isAddingPending, setIsAddingPending] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // Spreadsheet-style Drag-and-Drop Reordering State
  const [draggedItem, setDraggedItem] = useState<{
    unitId: string;
    fromIndex: number;
  } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<{
    unitId: string;
    toIndex: number;
  } | null>(null);

  const handleDragStart = (
    e: React.DragEvent,
    unitId: string,
    fromIndex: number,
  ) => {
    setDraggedItem({ unitId, fromIndex });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${unitId}:${fromIndex}`);
  };

  const handleDragOver = (
    e: React.DragEvent,
    unitId: string,
    overIndex: number,
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (
      !dragOverIndex ||
      dragOverIndex.unitId !== unitId ||
      dragOverIndex.toIndex !== overIndex
    ) {
      setDragOverIndex({ unitId, toIndex: overIndex });
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const handleDrop = (unit: any, toIndex: number) => {
    if (!draggedItem || draggedItem.unitId !== unit.id) {
      handleDragEnd();
      return;
    }

    const { fromIndex } = draggedItem;
    handleDragEnd();

    if (fromIndex === toIndex) return;

    const items = [...unit.structureItems];
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);

    const orderedIds = items.map((it) => it.id);

    startTransition(async () => {
      const res = await reorderStructureItems(unit.id, orderedIds);
      if (res.success) {
        toast.success(
          `Urutan "${moved.name}" berhasil dipindahkan ke posisi #${toIndex + 1}!`,
        );
      } else {
        toast.error(res.error || "Gagal mengubah urutan");
      }
    });
  };

  const toggleExpand = (unitId: string) => {
    setExpandedUnits((prev) => ({ ...prev, [unitId]: !prev[unitId] }));
  };

  const handleRowChange = (index: number, field: string, value: any) => {
    const updated = [...itemsList];
    updated[index] = { ...updated[index], [field]: value };
    setItemsList(updated);
  };

  const handleAddRow = () => {
    setItemsList([...itemsList, { name: "", qty: 1, satuan: "set" }]);
  };

  const handleRemoveRow = (index: number) => {
    if (itemsList.length === 1) {
      setItemsList([{ name: "", qty: 1, satuan: "set" }]);
      return;
    }
    setItemsList(itemsList.filter((_, i) => i !== index));
  };

  const handleStageQtyChange = (
    itemId: string,
    field: string,
    newQty: number,
  ) => {
    startTransition(async () => {
      const res = await updateStructureItemChecklist(itemId, {
        [field]: newQty,
      });

      if (res.success) {
        toast.success("Progress komponen diperbarui!");
      } else {
        toast.error(res.error || "Gagal memperbarui progress");
      }
    });
  };

  const handleDetailChange = (
    itemId: string,
    details: { name?: string; qty?: number; satuan?: string },
  ) => {
    startTransition(async () => {
      const res = await updateStructureItemDetails(itemId, details);
      if (res.success) {
        toast.success("Rincian komponen diperbarui!");
      } else {
        toast.error(res.error || "Gagal memperbarui rincian");
      }
    });
  };

  const handleAddItemsSubmit = async () => {
    if (!addModalUnit) return;

    // Combine dynamic rows and bulk text if present
    const validRows = itemsList
      .filter((r) => r.name.trim().length > 0)
      .map((r) => ({
        name: r.name.trim(),
        qty: Number(r.qty) || 1,
        satuan: r.satuan.trim() || "set",
      }));

    const bulkRows = bulkText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => ({ name: s, qty: 1, satuan: "set" }));

    const payload = [...validRows, ...bulkRows];

    if (payload.length === 0) {
      toast.error("Masukkan minimal 1 nama komponen.");
      return;
    }

    setIsAddingPending(true);
    try {
      const res = await addStructureItemsToUnit(addModalUnit.id, payload);
      if (res.success) {
        toast.success(
          `${payload.length} komponen struktur berhasil ditambahkan!`,
        );
        setAddModalUnit(null);
        setItemsList([{ name: "", qty: 1, satuan: "set" }]);
        setBulkText("");
      } else {
        toast.error(res.error || "Gagal menambahkan komponen");
      }
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan");
    } finally {
      setIsAddingPending(false);
    }
  };

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleDeleteItem = async () => {
    if (!deleteConfirmItem) return;
    const { id, name } = deleteConfirmItem;
    setDeletingItemId(id);
    try {
      const res = await deleteStructureItem(id);
      if (res.success) {
        toast.success(`Komponen "${name}" berhasil dihapus!`);
        setDeleteConfirmItem(null);
      } else {
        toast.error(res.error || "Gagal menghapus komponen");
      }
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan");
    } finally {
      setDeletingItemId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50 shadow-xl bg-card/60 backdrop-blur-md overflow-hidden rounded-2xl pt-0">
        <CardHeader className="bg-linear-to-r from-primary/5 via-transparent to-primary/5 pt-4 px-6 pb-4 border-b border-border/20">
          <CardTitle className="text-lg font-bold gap-1.5 flex items-center">
            <Hammer className="w-5 h-5 text-primary" /> Fabrikasi Struktur
            (Structure Progress)
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground/80">
            Perbarui checklist status pabrikasi rangka utama conveyor. Bobot
            langkah: C/D (15%), Setting (35%), Welding (40%), Finishing (5%),
            Painting (3.5%), Packaging (1.5%).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {units.map((unit, unitIdx) => {
            if (unit.unitType === "MECHANICAL") return null;

            const isExpanded = !!expandedUnits[unit.id];
            const totalItems = unit.structureItems.length;
            const avgProgress =
              totalItems > 0
                ? unit.structureItems.reduce(
                    (sum: number, item: any) =>
                      sum + Number(item.progressPercent || 0),
                    0,
                  ) / totalItems
                : 0;

            return (
              <div
                key={unit.id}
                className="border border-border/50 rounded-xl overflow-hidden bg-background/20 backdrop-blur-sm"
              >
                {/* Header Collapsible */}
                <div
                  onClick={() => toggleExpand(unit.id)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/10 transition-colors select-none border-b border-border/40"
                >
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-accent/80 text-primary border border-border/60">
                        {unitIdx + 1}
                      </span>
                      <span>{unit.name}</span>
                    </h4>
                    <span className="text-xs text-muted-foreground/80">
                      Total item struktur: {totalItems}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-36 hidden sm:block">
                      <CustomProgress value={avgProgress} />
                    </div>
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none font-bold">
                      {avgProgress.toFixed(1)}%
                    </Badge>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Collapsible Content */}
                {isExpanded && (
                  <div className="p-4 bg-background/40 space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Komponen Rangka Conveyor
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddModalUnit({ id: unit.id, name: unit.name });
                          setItemsList([{ name: "", qty: 1, satuan: "set" }]);
                          setBulkText("");
                        }}
                        className="h-8 px-3 text-xs border-dashed border-primary/40 text-primary hover:bg-primary/10 rounded-xl gap-1.5 cursor-pointer font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Komponen
                        Struktur
                      </Button>
                    </div>

                    <div className="rounded-xl border border-border/40 overflow-hidden">
                      {totalItems > 0 ? (
                        <Table>
                          <TableHeader className="bg-muted/40">
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="font-semibold text-xs text-center w-12 py-3">
                                No.
                              </TableHead>
                              <TableHead className="font-semibold text-xs py-3">
                                Nama Item Rangka
                              </TableHead>
                              <TableHead className="font-semibold text-xs text-center w-20">
                                C/D (15%)
                              </TableHead>
                              <TableHead className="font-semibold text-xs text-center w-20">
                                Sett (35%)
                              </TableHead>
                              <TableHead className="font-semibold text-xs text-center w-20">
                                Weld (40%)
                              </TableHead>
                              <TableHead className="font-semibold text-xs text-center w-16">
                                Fin (5%)
                              </TableHead>
                              <TableHead className="font-semibold text-xs text-center w-20">
                                Paint (3.5%)
                              </TableHead>
                              <TableHead className="font-semibold text-xs text-center w-20">
                                Pack (1.5%)
                              </TableHead>
                              <TableHead className="font-semibold text-xs text-right w-24">
                                Progress
                              </TableHead>
                              <TableHead className="font-semibold text-xs text-center w-12">
                                Hapus
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {unit.structureItems.map(
                              (item: any, itemIdx: number) => (
                                <TableRow
                                  key={item.id}
                                  id={`item-${item.id}`}
                                  draggable
                                  onDragStart={(e) =>
                                    handleDragStart(e, unit.id, itemIdx)
                                  }
                                  onDragOver={(e) =>
                                    handleDragOver(e, unit.id, itemIdx)
                                  }
                                  onDragEnd={handleDragEnd}
                                  onDrop={() => handleDrop(unit, itemIdx)}
                                  className={cn(
                                    "hover:bg-muted/5 transition-all select-none",
                                    draggedItem?.unitId === unit.id &&
                                      draggedItem?.fromIndex === itemIdx
                                      ? "opacity-30 bg-primary/10 border-2 border-dashed border-primary"
                                      : "",
                                    dragOverIndex?.unitId === unit.id &&
                                      dragOverIndex?.toIndex === itemIdx &&
                                      draggedItem?.fromIndex !== itemIdx
                                      ? "border-b-2 border-b-primary bg-primary/10 font-bold"
                                      : "",
                                  )}
                                >
                                  <td
                                    className="text-center text-xs font-semibold py-2.5 w-12 cursor-grab active:cursor-grabbing hover:bg-muted/40 transition-colors rounded-l-md"
                                    title="Geser/drag untuk mengubah urutan komponen"
                                  >
                                    <div className="flex items-center justify-center gap-1 text-muted-foreground/70 hover:text-primary transition-colors">
                                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                                      <span className="text-xs font-bold text-foreground">
                                        {itemIdx + 1}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="font-medium text-xs py-2">
                                    <div className="flex items-center gap-2">
                                      <Input
                                        key={`name-${item.id}-${item.name}`}
                                        defaultValue={item.name}
                                        disabled={isPending}
                                        onBlur={(e) => {
                                          const val = e.target.value.trim();
                                          if (val && val !== item.name) {
                                            handleDetailChange(item.id, {
                                              name: val,
                                            });
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            (
                                              e.target as HTMLInputElement
                                            ).blur();
                                          }
                                        }}
                                        className="h-7 text-xs font-semibold bg-transparent hover:bg-muted/30 focus:bg-background border-transparent hover:border-border/60 focus:border-primary transition-all px-2 rounded-lg"
                                        title="Klik untuk ubah nama komponen"
                                      />
                                      {(() => {
                                        const problematicCp =
                                          unit.qcCheckpoints?.find(
                                            (cp: any) =>
                                              cp.itemId === item.id &&
                                              (cp.status === "FAIL" ||
                                                cp.status === "ON_HOLD"),
                                          );
                                        const activeRev =
                                          problematicCp?.revisions?.find(
                                            (r: any) => r.status !== "CLOSED",
                                          ) ||
                                          unit.qcRevisions?.find(
                                            (rev: any) =>
                                              (rev.checkpointId ===
                                                problematicCp?.id ||
                                                rev.checkpoint?.itemId ===
                                                  item.id) &&
                                              rev.status !== "CLOSED",
                                          );

                                        if (problematicCp || activeRev) {
                                          const isDR =
                                            activeRev?.revisionType ===
                                              "DRAWING_REVISION" ||
                                            problematicCp?.status ===
                                              "ON_HOLD" ||
                                            !!activeRev?.drNumber;

                                          return (
                                            <Badge
                                              variant="outline"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedRevisionData({
                                                  open: true,
                                                  revision: activeRev || {
                                                    id: problematicCp?.id,
                                                    ncrNumber: isDR
                                                      ? activeRev?.drNumber ||
                                                        "Request Drawing Revision"
                                                      : "Laporan Revisi QC",
                                                    ncrDescription:
                                                      activeRev?.ncrDescription ||
                                                      activeRev?.fieldCondition ||
                                                      problematicCp?.notes ||
                                                      (isDR
                                                        ? "Item di-hold menunggu revisi drawing"
                                                        : "Ditolak oleh QC"),
                                                    status:
                                                      activeRev?.status ||
                                                      (problematicCp?.status ===
                                                      "ON_HOLD"
                                                        ? "ON_HOLD"
                                                        : "OPEN"),
                                                    raisedBy:
                                                      activeRev?.raisedBy ||
                                                      problematicCp?.inspectedBy ||
                                                      "QC Inspector",
                                                    raisedAt:
                                                      activeRev?.createdAt ||
                                                      problematicCp?.inspectedAt,
                                                  },
                                                  itemType: "STRUCTURE",
                                                  itemName: item.name,
                                                  stageName:
                                                    problematicCp?.stage ||
                                                    "QC",
                                                  unitName: unit.name,
                                                });
                                              }}
                                              className={cn(
                                                "font-bold text-[10px] px-2 py-0.5 animate-pulse cursor-pointer shrink-0 gap-1 transition-all",
                                                isDR
                                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 hover:bg-amber-500/25"
                                                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 hover:bg-rose-500/25",
                                              )}
                                            >
                                              <ShieldAlert
                                                className={cn(
                                                  "w-3 h-3",
                                                  isDR
                                                    ? "text-amber-600"
                                                    : "text-rose-600",
                                                )}
                                              />
                                              <span>
                                                {isDR
                                                  ? "Revisi Drawing"
                                                  : "Perlu Produksi"}
                                              </span>
                                            </Badge>
                                          );
                                        }
                                        return null;
                                      })()}
                                      <div className="flex items-center gap-1 border border-border/70 rounded-lg bg-muted/30 px-1.5 py-0.5 shrink-0">
                                        <input
                                          type="number"
                                          min={1}
                                          key={`qty-${item.id}-${item.qty}`}
                                          defaultValue={item.qty || 1}
                                          disabled={isPending}
                                          onBlur={(e) => {
                                            const val = Math.max(
                                              1,
                                              Number(e.target.value) || 1,
                                            );
                                            if (val !== item.qty) {
                                              handleDetailChange(item.id, {
                                                qty: val,
                                              });
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              (
                                                e.target as HTMLInputElement
                                              ).blur();
                                            }
                                          }}
                                          className="w-12 h-5 text-xs font-bold text-center bg-transparent border-none outline-none focus:ring-0"
                                          title="Ubah total jumlah unit/pcs"
                                        />
                                        <select
                                          key={`satuan-${item.id}-${item.satuan}`}
                                          value={item.satuan || "set"}
                                          disabled={isPending}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val !== item.satuan) {
                                              handleDetailChange(item.id, {
                                                satuan: val,
                                              });
                                            }
                                          }}
                                          className="h-5 text-xs font-semibold text-muted-foreground bg-transparent border-none outline-none focus:ring-0 cursor-pointer p-0 pr-1"
                                          title="Pilih satuan komponen"
                                        >
                                          <option value="set">set</option>
                                          <option value="unit">unit</option>
                                          <option value="pcs">pcs</option>
                                          <option value="mtr">mtr</option>
                                          <option value="lot">lot</option>
                                          <option value="batang">batang</option>
                                          <option value="lembar">lembar</option>
                                          <option value="kg">kg</option>
                                        </select>
                                      </div>
                                    </div>
                                  </td>
                                  {[
                                    {
                                      key: "cuttingQty",
                                      val:
                                        item.cuttingQty ??
                                        (item.cuttingDone ? item.qty || 1 : 0),
                                    },
                                    {
                                      key: "assemblyQty",
                                      val:
                                        item.assemblyQty ??
                                        (item.assemblyDone
                                          ? item.qty || 1
                                          : 0),
                                    },
                                    {
                                      key: "weldingQty",
                                      val:
                                        item.weldingQty ??
                                        (item.weldingDone ? item.qty || 1 : 0),
                                    },
                                    {
                                      key: "paintingQty",
                                      val:
                                        item.paintingQty ??
                                        (item.paintingDone ? item.qty || 1 : 0),
                                    },
                                    {
                                      key: "packagingQty",
                                      val:
                                        item.packagingQty ??
                                        (item.packagingDone
                                          ? item.qty || 1
                                          : 0),
                                    },
                                  ].map((stg) => {
                                    const maxQty = Math.max(1, item.qty || 1);
                                    const isStageDone =
                                      stg.val >= maxQty && maxQty > 0;

                                    const stageMapName: Record<string, string> =
                                      {
                                        cuttingQty: "CUTTING",
                                        assemblyQty: "ASSEMBLY",
                                        weldingQty: "WELDING",
                                        paintingQty: "PAINTING",
                                        packagingQty: "PACKAGING",
                                      };
                                    const stgStageName = stageMapName[stg.key];
                                    const stgCp = (
                                      unit.qcCheckpoints || []
                                    ).find(
                                      (cp: any) =>
                                        cp.itemId === item.id &&
                                        cp.stage?.toUpperCase() ===
                                          stgStageName &&
                                        (cp.status === "FAIL" ||
                                          cp.status === "ON_HOLD"),
                                    );
                                    const isStgHold =
                                      stgCp?.status === "ON_HOLD";
                                    const isStgFail = stgCp?.status === "FAIL";

                                    return (
                                      <td
                                        key={stg.key}
                                        className="text-center py-2"
                                      >
                                        <div className="flex items-center justify-center gap-1">
                                          <Input
                                            type="number"
                                            min={0}
                                            max={maxQty}
                                            key={`${item.id}-${stg.key}-${stg.val}`}
                                            defaultValue={stg.val}
                                            disabled={isPending}
                                            onBlur={(e) => {
                                              const newV = Math.min(
                                                maxQty,
                                                Math.max(
                                                  0,
                                                  Number(e.target.value) || 0,
                                                ),
                                              );
                                              if (newV !== stg.val) {
                                                handleStageQtyChange(
                                                  item.id,
                                                  stg.key,
                                                  newV,
                                                );
                                              }
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") {
                                                (
                                                  e.target as HTMLInputElement
                                                ).blur();
                                              }
                                            }}
                                            className={cn(
                                              "w-14 h-7 text-xs font-semibold text-center rounded-lg border transition-all p-0",
                                              isStgHold
                                                ? "border-amber-500/90 bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold shadow-xs ring-1 ring-amber-500/50"
                                                : isStgFail
                                                  ? "border-rose-500/90 bg-rose-500/20 text-rose-800 dark:text-rose-300 font-bold shadow-xs ring-1 ring-rose-500/50 animate-pulse"
                                                  : isStageDone
                                                    ? "border-emerald-500/80 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs ring-1 ring-emerald-500/30"
                                                    : "border-border/80 bg-background/80 focus:border-primary focus:ring-1 focus:ring-primary",
                                            )}
                                            title={
                                              isStgHold
                                                ? `⏸️ ON HOLD / Revisi Drawing (Tahap ${stgStageName})`
                                                : isStgFail
                                                  ? `🛑 Ditolak QC / Perlu Revisi (Tahap ${stgStageName})`
                                                  : `Jumlah selesai tahap ini (Max: ${maxQty})`
                                            }
                                          />
                                          <span
                                            className={cn(
                                              "text-sm font-semibold select-none transition-colors",
                                              isStageDone
                                                ? "text-emerald-700 dark:text-emerald-300 font-semibold"
                                                : "text-muted-foreground/80",
                                            )}
                                          >
                                            /{maxQty}
                                          </span>
                                        </div>
                                      </td>
                                    );
                                  })}
                                  <td className="text-right">
                                    <span
                                      className={cn(
                                        "text-sm font-semibold",
                                        Number(item.progressPercent) >= 100
                                          ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                          : "text-primary",
                                      )}
                                    >
                                      {Number(item.progressPercent).toFixed(1)}%
                                    </span>
                                  </td>
                                  <td className="text-center">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      disabled={deletingItemId === item.id}
                                      onClick={() =>
                                        setDeleteConfirmItem({
                                          id: item.id,
                                          name: item.name,
                                        })
                                      }
                                      className="h-7 w-7 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                                      title="Hapus komponen ini"
                                    >
                                      {deletingItemId === item.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin text-destructive" />
                                      ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                      )}
                                    </Button>
                                  </td>
                                </TableRow>
                              ),
                            )}
                          </TableBody>
                          {(() => {
                            const sItems = unit.structureItems || [];
                            const totalUnitQty = sItems.reduce(
                              (acc: number, item: any) =>
                                acc + Math.max(1, Number(item.qty || 1)),
                              0,
                            );

                            const sumCutting = sItems.reduce(
                              (acc: number, item: any) =>
                                acc +
                                Number(
                                  item.cuttingQty ??
                                    (item.cuttingDone ? item.qty || 1 : 0),
                                ),
                              0,
                            );
                            const sumSetting = sItems.reduce(
                              (acc: number, item: any) =>
                                acc +
                                Number(
                                  item.settingQty ??
                                    (item.settingDone ? item.qty || 1 : 0),
                                ),
                              0,
                            );
                            const sumWelding = sItems.reduce(
                              (acc: number, item: any) =>
                                acc +
                                Number(
                                  item.weldingQty ??
                                    (item.weldingDone ? item.qty || 1 : 0),
                                ),
                              0,
                            );
                            const sumFinishing = sItems.reduce(
                              (acc: number, item: any) =>
                                acc +
                                Number(
                                  item.finishingQty ??
                                    (item.finishingDone ? item.qty || 1 : 0),
                                ),
                              0,
                            );
                            const sumPainting = sItems.reduce(
                              (acc: number, item: any) =>
                                acc +
                                Number(
                                  item.paintingQty ??
                                    (item.paintingDone ? item.qty || 1 : 0),
                                ),
                              0,
                            );
                            const sumPackaging = sItems.reduce(
                              (acc: number, item: any) =>
                                acc +
                                Number(
                                  item.packagingQty ??
                                    (item.packagingDone ? item.qty || 1 : 0),
                                ),
                              0,
                            );

                            const cuttingPct =
                              totalUnitQty > 0
                                ? (sumCutting / totalUnitQty) * 15
                                : 0;
                            const settingPct =
                              totalUnitQty > 0
                                ? (sumSetting / totalUnitQty) * 35
                                : 0;
                            const weldingPct =
                              totalUnitQty > 0
                                ? (sumWelding / totalUnitQty) * 40
                                : 0;
                            const finishingPct =
                              totalUnitQty > 0
                                ? (sumFinishing / totalUnitQty) * 5
                                : 0;
                            const paintingPct =
                              totalUnitQty > 0
                                ? (sumPainting / totalUnitQty) * 3.5
                                : 0;
                            const packagingPct =
                              totalUnitQty > 0
                                ? (sumPackaging / totalUnitQty) * 1.5
                                : 0;

                            const totalUnitPercent =
                              cuttingPct +
                              settingPct +
                              weldingPct +
                              finishingPct +
                              paintingPct +
                              packagingPct;

                            return (
                              <TableFooter className="bg-muted/30 border-t-2 border-border/70">
                                {/* Row 1: Total */}
                                <TableRow className="hover:bg-transparent font-bold text-xs">
                                  <TableCell className="text-center py-2.5 w-12"></TableCell>
                                  <TableCell className="py-2.5">
                                    <div className="flex items-center justify-between gap-2 px-1">
                                      <span className="font-semibold text-sm text-foreground">
                                        Total
                                      </span>
                                      <div className="flex items-center justify-center border border-border/70 rounded-full bg-muted/60 px-2.5 py-0.5 shrink-0 min-w-14">
                                        <span className="text-sm font-semibold text-foreground">
                                          {totalUnitQty}
                                        </span>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-center font-semibold text-sm py-2.5",
                                      sumCutting >= totalUnitQty &&
                                        totalUnitQty > 0
                                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                        : "text-foreground",
                                    )}
                                  >
                                    {sumCutting}
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-center font-semibold text-sm py-2.5",
                                      sumSetting >= totalUnitQty &&
                                        totalUnitQty > 0
                                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                        : "text-foreground",
                                    )}
                                  >
                                    {sumSetting}
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-center font-semibold text-sm py-2.5",
                                      sumWelding >= totalUnitQty &&
                                        totalUnitQty > 0
                                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                        : "text-foreground",
                                    )}
                                  >
                                    {sumWelding}
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-center font-semibold text-sm py-2.5",
                                      sumFinishing >= totalUnitQty &&
                                        totalUnitQty > 0
                                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                        : "text-foreground",
                                    )}
                                  >
                                    {sumFinishing}
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-center font-semibold text-sm py-2.5",
                                      sumPainting >= totalUnitQty &&
                                        totalUnitQty > 0
                                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                        : "text-foreground",
                                    )}
                                  >
                                    {sumPainting}
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-center font-semibold text-sm py-2.5",
                                      sumPackaging >= totalUnitQty &&
                                        totalUnitQty > 0
                                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                        : "text-foreground",
                                    )}
                                  >
                                    {sumPackaging}
                                  </TableCell>
                                  <TableCell className="text-right py-2.5 w-24"></TableCell>
                                  <TableCell className="text-center py-2.5 w-12"></TableCell>
                                </TableRow>

                                {/* Row 2: PROSENTASE */}
                                <TableRow className="hover:bg-transparent font-semibold text-sm bg-muted/50 border-t border-border/40">
                                  <TableCell className="text-center py-2.5 w-12"></TableCell>
                                  <TableCell className="py-2.5 font-semibold text-sm pl-3 text-primary">
                                    Prosentase (%)
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-center font-semibold text-sm py-2.5",
                                      cuttingPct >= 15 && totalUnitQty > 0
                                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                        : "text-foreground",
                                    )}
                                  >
                                    {cuttingPct.toFixed(2)}%
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-center font-semibold text-sm py-2.5",
                                      settingPct >= 35 && totalUnitQty > 0
                                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                        : "text-foreground",
                                    )}
                                  >
                                    {settingPct.toFixed(2)}%
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-center font-semibold text-sm py-2.5",
                                      weldingPct >= 40 && totalUnitQty > 0
                                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                        : "text-foreground",
                                    )}
                                  >
                                    {weldingPct.toFixed(2)}%
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-center font-semibold text-sm py-2.5",
                                      finishingPct >= 5 && totalUnitQty > 0
                                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                        : "text-foreground",
                                    )}
                                  >
                                    {finishingPct.toFixed(2)}%
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-center font-semibold text-sm py-2.5",
                                      paintingPct >= 3.5 && totalUnitQty > 0
                                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                        : "text-foreground",
                                    )}
                                  >
                                    {paintingPct.toFixed(2)}%
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-center font-semibold text-sm py-2.5",
                                      packagingPct >= 1.5 && totalUnitQty > 0
                                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                        : "text-foreground",
                                    )}
                                  >
                                    {packagingPct.toFixed(2)}%
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-right font-semibold text-sm py-2.5 pr-0",
                                      totalUnitPercent >= 100
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-primary",
                                    )}
                                  >
                                    {totalUnitPercent.toFixed(2)}%
                                  </TableCell>
                                  <TableCell className="text-center py-2.5 w-12"></TableCell>
                                </TableRow>
                              </TableFooter>
                            );
                          })()}
                        </Table>
                      ) : (
                        <div className="p-6 text-center text-xs text-muted-foreground">
                          Belum ada komponen struktur untuk unit{" "}
                          <strong>{unit.name}</strong>.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Dialog Quick Add Components with Dynamic Fields */}
      <Dialog
        open={!!addModalUnit}
        onOpenChange={(open) => {
          if (!open) {
            setAddModalUnit(null);
            setItemsList([{ name: "", qty: 1, satuan: "set" }]);
            setBulkText("");
          }
        }}
      >
        <DialogContent className="sm:max-w-200! rounded-2xl border-border/80">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary font-bold text-base">
              <Plus className="w-5 h-5 text-primary" />
              Tambah Komponen Struktur
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tambahkan komponen rangka ke <strong>{addModalUnit?.name}</strong>{" "}
              lengkap dengan jumlah dan satuan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-87.5 overflow-y-auto pr-1">
            {/* Field Header */}
            <div className="flex items-center gap-2 px-1 text-xs font-bold text-muted-foreground">
              <span className="flex-1">Nama Komponen Rangka</span>
              <span className="w-20 text-center">Jumlah</span>
              <span className="w-24 text-center">Satuan</span>
              <span className="w-8"></span>
            </div>

            {itemsList.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder={`Komponen ${idx + 1} (mis: Room Hopper)`}
                  value={row.name}
                  onChange={(e) => handleRowChange(idx, "name", e.target.value)}
                  className="flex-1 h-9 rounded-xl text-xs bg-background/50 focus:bg-background"
                />
                <Input
                  type="number"
                  min={1}
                  value={row.qty}
                  onChange={(e) =>
                    handleRowChange(idx, "qty", Number(e.target.value))
                  }
                  className="w-20 h-9 rounded-xl text-xs text-center bg-background/50 focus:bg-background"
                />
                <select
                  value={row.satuan || "set"}
                  onChange={(e) =>
                    handleRowChange(idx, "satuan", e.target.value)
                  }
                  className="w-24 h-9 rounded-xl text-xs font-semibold bg-background/50 focus:bg-background border border-input px-2 cursor-pointer text-foreground"
                >
                  <option value="set">set</option>
                  <option value="unit">unit</option>
                  <option value="pcs">pcs</option>
                  <option value="mtr">mtr</option>
                  <option value="lot">lot</option>
                  <option value="batang">batang</option>
                  <option value="lembar">lembar</option>
                  <option value="kg">kg</option>
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveRow(idx)}
                  className="h-9 w-9 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-xl shrink-0 cursor-pointer"
                  title="Hapus baris ini"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRow}
              className="w-full h-9 border-dashed border-primary/40 text-primary hover:bg-primary/10 rounded-xl gap-1.5 font-semibold text-xs cursor-pointer shadow-none mt-2"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Baris Komponen Baru
            </Button>

            <details className="text-xs text-muted-foreground pt-2">
              <summary className="cursor-pointer font-medium hover:text-foreground text-[11px] select-none">
                + Atau paste banyak nama komponen sekaligus (Multi-baris)
              </summary>
              <Textarea
                placeholder="Contoh:&#10;Room Hopper&#10;Extra Hopper&#10;Structure Hopper"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="min-h-20 rounded-xl text-xs bg-background/50 focus:bg-background resize-y mt-2"
              />
            </details>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setAddModalUnit(null);
                setItemsList([{ name: "", qty: 1, satuan: "set" }]);
                setBulkText("");
              }}
              disabled={isAddingPending}
              className="text-xs h-9 px-4 rounded-xl cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddItemsSubmit}
              disabled={
                isAddingPending ||
                (itemsList.every((r) => !r.name.trim()) && !bulkText.trim())
              }
              className="text-xs h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xs cursor-pointer"
            >
              {isAddingPending && (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              )}
              Simpan Komponen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Deleting Structure Item */}
      <Dialog
        open={!!deleteConfirmItem}
        onOpenChange={(open) => {
          if (!open && !deletingItemId) setDeleteConfirmItem(null);
        }}
      >
        <DialogContent className="sm:max-w-105 rounded-2xl border-border/80">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-bold text-base">
              <Trash2 className="w-5 h-5 text-destructive" />
              Hapus Komponen Struktur
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Apakah Anda yakin ingin menghapus komponen{" "}
              <strong className="text-foreground">
                "{deleteConfirmItem?.name}"
              </strong>
              ? Tindakan ini akan memperbarui kalkulasi progress & S-Curve
              secara otomatis.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmItem(null)}
              disabled={!!deletingItemId}
              className="text-xs h-9 px-4 rounded-xl cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleDeleteItem}
              disabled={!!deletingItemId}
              className="text-xs h-9 px-4 rounded-xl font-bold cursor-pointer"
            >
              {deletingItemId ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Menghapus...
                </>
              ) : (
                "Ya, Hapus Komponen"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QC Revision Detail Dialog */}
      {selectedRevisionData && (
        <QCRevisionDetailDialog
          open={selectedRevisionData.open}
          onOpenChange={(open) => {
            if (!open) setSelectedRevisionData(null);
          }}
          revision={selectedRevisionData.revision}
          projectId={
            units[0]?.projectId || selectedRevisionData.revision?.projectId
          }
          itemType={selectedRevisionData.itemType}
          itemName={selectedRevisionData.itemName}
          stageName={selectedRevisionData.stageName}
          unitName={selectedRevisionData.unitName}
        />
      )}
    </div>
  );
}
