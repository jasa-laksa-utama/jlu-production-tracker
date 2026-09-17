"use client";

import React, { useState, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Layers,
  Hammer,
  Wrench,
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Scale,
  SlidersHorizontal,
  FileText,
  AlertTriangle,
  Loader2,
  GripVertical,
  Camera,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProgressPhotoDialog } from "@/components/trackers/progress-photo-dialog";
import { SubComponentDialog } from "@/components/trackers/sub-component-dialog";
import { MarkingManagerDialog } from "@/components/trackers/marking-manager-dialog";
import {
  addConveyorUnitAfter,
  updateConveyorUnitDetails,
  updateAllUnitWeights,
  deleteConveyorUnit,
  reorderConveyorUnits,
  addStructureItemsToUnit,
  addMechanicalItemsToUnit,
  updateStructureItemDetails,
  updateMechanicalItemDetails,
  deleteStructureItem,
  deleteMechanicalItem,
  reorderStructureItems,
  reorderMechanicalItems,
} from "@/app/actions/conveyor-progress";

export interface ConveyorManagementTableProps {
  currentProject: any;
  units: any[];
}

export function ConveyorManagementTable({
  currentProject,
  units,
}: ConveyorManagementTableProps) {
  const [isPending, startTransition] = useTransition();

  // Modal States
  const [unitModal, setUnitModal] = useState<{
    isOpen: boolean;
    mode: "CREATE" | "EDIT";
    unitId?: string;
    name: string;
    unitType: "STRUCTURE" | "MECHANICAL" | "BOTH";
    satuan: string;
    volume: number;
    weightPercent: number;
  }>({
    isOpen: false,
    mode: "CREATE",
    name: "",
    unitType: "BOTH",
    satuan: "unit",
    volume: 1,
    weightPercent: 0,
  });

  const [weightsModal, setWeightsModal] = useState<{
    isOpen: boolean;
    weights: Record<string, number>;
  }>({
    isOpen: false,
    weights: {},
  });

  const [componentModal, setComponentModal] = useState<{
    isOpen: boolean;
    mode: "ADD_SINGLE" | "ADD_BULK" | "EDIT";
    unitId: string;
    category: "STRUCTURE" | "MECHANICAL";
    itemId?: string;
    name: string;
    qty: number;
    satuan: string;
    bulkText: string;
  }>({
    isOpen: false,
    mode: "ADD_SINGLE",
    unitId: "",
    category: "STRUCTURE",
    name: "",
    qty: 1,
    satuan: "unit",
    bulkText: "",
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: "UNIT" | "STRUCTURE_ITEM" | "MECHANICAL_ITEM";
    id: string;
    title: string;
    description: string;
  }>({
    isOpen: false,
    type: "UNIT",
    id: "",
    title: "",
    description: "",
  });

  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [selectedPhotoUnit, setSelectedPhotoUnit] = useState<{
    id?: string;
    name?: string;
  }>({});
  const [selectedSubCompData, setSelectedSubCompData] = useState<{
    open: boolean;
    componentId: string;
    componentName: string;
    unitName?: string;
    type: "STRUCTURE" | "MECHANICAL";
  } | null>(null);
  const [markingDialogOpen, setMarkingDialogOpen] = useState(false);

  // Drag-and-Drop State for Components Reordering
  const [dragItem, setDragItem] = useState<{
    unitId: string;
    category: "STRUCTURE" | "MECHANICAL";
    index: number;
  } | null>(null);

  const [dragOverTarget, setDragOverTarget] = useState<{
    unitId: string;
    category: "STRUCTURE" | "MECHANICAL";
    index: number;
  } | null>(null);

  // Calculate Unit Bobot Plan Normalized Sum
  const unitWeights = units.map((u) => {
    const up = u.progresses?.[0];
    return {
      unitId: u.id,
      name: u.name,
      weight: up && Number(up.weightPercent) > 0 ? Number(up.weightPercent) : (100 / Math.max(1, units.length)),
    };
  });
  const totalRawWeight = unitWeights.reduce((s, w) => s + w.weight, 0);

  // 1. Handlers for Unit
  const handleOpenAddUnit = () => {
    setUnitModal({
      isOpen: true,
      mode: "CREATE",
      name: "",
      unitType: "BOTH",
      satuan: "unit",
      volume: 1,
      weightPercent: units.length > 0 ? 0 : 100,
    });
  };

  const handleOpenEditUnit = (unit: any) => {
    const up = unit.progresses?.[0];
    setUnitModal({
      isOpen: true,
      mode: "EDIT",
      unitId: unit.id,
      name: unit.name,
      unitType: unit.unitType || "BOTH",
      satuan: unit.satuan || "unit",
      volume: unit.volume || 1,
      weightPercent: up && Number(up.weightPercent) > 0 ? Number(up.weightPercent) : (100 / Math.max(1, units.length)),
    });
  };

  const handleSaveUnit = () => {
    if (!unitModal.name.trim()) {
      toast.error("Nama unit conveyor wajib diisi.");
      return;
    }

    startTransition(async () => {
      if (unitModal.mode === "CREATE") {
        const res = await addConveyorUnitAfter(currentProject.id, {
          name: unitModal.name.trim(),
          unitType: unitModal.unitType,
          satuan: unitModal.satuan || "unit",
          volume: Number(unitModal.volume) || 1,
        });
        if (res.success) {
          toast.success(`Unit ${unitModal.name} berhasil ditambahkan!`);
          setUnitModal((prev) => ({ ...prev, isOpen: false }));
        } else {
          toast.error(res.error || "Gagal menambahkan unit conveyor.");
        }
      } else if (unitModal.mode === "EDIT" && unitModal.unitId) {
        const res = await updateConveyorUnitDetails(unitModal.unitId, {
          name: unitModal.name,
          unitType: unitModal.unitType,
          satuan: unitModal.satuan,
          volume: unitModal.volume,
        });
        if (res.success) {
          toast.success("Unit conveyor berhasil diperbarui!");
          setUnitModal((prev) => ({ ...prev, isOpen: false }));
        } else {
          toast.error(res.error || "Gagal memperbarui unit conveyor.");
        }
      }
    });
  };

  const handleDeleteUnit = (unitId: string, unitName: string) => {
    setDeleteConfirm({
      isOpen: true,
      type: "UNIT",
      id: unitId,
      title: `Hapus Unit ${unitName}?`,
      description:
        "Tindakan ini akan menghapus seluruh data komponen struktur, mekanikal, dan checklist progres pada unit conveyor ini secara permanen.",
    });
  };

  const handleMoveUnit = (currentIndex: number, direction: "UP" | "DOWN") => {
    const targetIndex = direction === "UP" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= units.length) return;

    const reordered = [...units];
    const temp = reordered[currentIndex];
    reordered[currentIndex] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    const orderedIds = reordered.map((u) => u.id);
    startTransition(async () => {
      const res = await reorderConveyorUnits(currentProject.id, orderedIds);
      if (res.success) {
        toast.success("Urutan unit conveyor diperbarui!");
      } else {
        toast.error("Gagal mengubah urutan unit conveyor.");
      }
    });
  };

  // 2. Handlers for Weights
  const handleOpenWeightsModal = () => {
    const initialWeights: Record<string, number> = {};
    units.forEach((u) => {
      const up = u.progresses?.[0];
      initialWeights[u.id] =
        up && Number(up.weightPercent) > 0
          ? Number(up.weightPercent)
          : Math.round((100 / Math.max(1, units.length)) * 100) / 100;
    });
    setWeightsModal({ isOpen: true, weights: initialWeights });
  };

  const handleEqualizeWeights = () => {
    if (units.length === 0) return;
    const equal = Math.round((100 / units.length) * 100) / 100;
    const updated: Record<string, number> = {};
    units.forEach((u, i) => {
      updated[u.id] =
        i === units.length - 1
          ? Math.round((100 - equal * (units.length - 1)) * 100) / 100
          : equal;
    });
    setWeightsModal((prev) => ({ ...prev, weights: updated }));
    toast.success("Bobot berhasil dibagi rata 100%!");
  };

  const handleNormalizeWeights = () => {
    const total = Object.values(weightsModal.weights).reduce(
      (s, w) => s + (Number(w) || 0),
      0,
    );
    if (total <= 0) {
      handleEqualizeWeights();
      return;
    }
    const updated: Record<string, number> = {};
    units.forEach((u) => {
      const current = weightsModal.weights[u.id] || 0;
      updated[u.id] = Math.round((current / total) * 10000) / 100;
    });
    setWeightsModal((prev) => ({ ...prev, weights: updated }));
    toast.success("Bobot berhasil dinormalisasi menjadi 100%!");
  };

  const handleSaveWeights = () => {
    const weightList = Object.entries(weightsModal.weights).map(
      ([unitId, weightPercent]) => ({
        unitId,
        weightPercent: Number(weightPercent) || 0,
      }),
    );
    const sum = weightList.reduce((s, w) => s + w.weightPercent, 0);

    if (Math.abs(sum - 100) > 0.05) {
      toast.error(`Total bobot harus tepat 100.00% (saat ini: ${sum.toFixed(2)}%)`);
      return;
    }

    startTransition(async () => {
      const res = await updateAllUnitWeights(currentProject.id, weightList);
      if (res.success) {
        toast.success("Bobot plan unit conveyor berhasil disimpan!");
        setWeightsModal((prev) => ({ ...prev, isOpen: false }));
      } else {
        toast.error(res.error || "Gagal menyimpan bobot plan.");
      }
    });
  };

  // 3. Handlers for Components (Structure & Mechanical)
  const handleOpenAddComponent = (
    unitId: string,
    category: "STRUCTURE" | "MECHANICAL",
    mode: "ADD_SINGLE" | "ADD_BULK" = "ADD_SINGLE",
  ) => {
    setComponentModal({
      isOpen: true,
      mode,
      unitId,
      category,
      name: "",
      qty: 1,
      satuan: category === "STRUCTURE" ? "unit" : "set",
      bulkText: "",
    });
  };

  const handleOpenEditComponent = (
    unitId: string,
    category: "STRUCTURE" | "MECHANICAL",
    item: any,
  ) => {
    setComponentModal({
      isOpen: true,
      mode: "EDIT",
      unitId,
      category,
      itemId: item.id,
      name: item.name,
      qty: Number(item.qty) || 1,
      satuan: item.satuan || "unit",
      bulkText: "",
    });
  };

  const handleSaveComponent = () => {
    startTransition(async () => {
      if (componentModal.mode === "EDIT" && componentModal.itemId) {
        if (!componentModal.name.trim()) {
          toast.error("Nama komponen wajib diisi.");
          return;
        }
        if (componentModal.category === "STRUCTURE") {
          const res = await updateStructureItemDetails(componentModal.itemId, {
            name: componentModal.name.trim(),
            qty: componentModal.qty,
            satuan: componentModal.satuan.trim(),
          });
          if (res.success) {
            toast.success("Komponen struktur berhasil diperbarui!");
            setComponentModal((prev) => ({ ...prev, isOpen: false }));
          } else {
            toast.error(res.error || "Gagal memperbarui komponen struktur.");
          }
        } else {
          const res = await updateMechanicalItemDetails(componentModal.itemId, {
            name: componentModal.name.trim(),
            qty: componentModal.qty,
            satuan: componentModal.satuan.trim(),
          });
          if (res.success) {
            toast.success("Komponen mekanikal berhasil diperbarui!");
            setComponentModal((prev) => ({ ...prev, isOpen: false }));
          } else {
            toast.error(res.error || "Gagal memperbarui komponen mekanikal.");
          }
        }
      } else if (componentModal.mode === "ADD_SINGLE") {
        if (!componentModal.name.trim()) {
          toast.error("Nama komponen wajib diisi.");
          return;
        }
        const items = [
          {
            name: componentModal.name.trim(),
            qty: componentModal.qty,
            satuan: componentModal.satuan.trim(),
          },
        ];
        if (componentModal.category === "STRUCTURE") {
          const res = await addStructureItemsToUnit(componentModal.unitId, items);
          if (res.success) {
            toast.success("Komponen struktur berhasil ditambahkan!");
            setComponentModal((prev) => ({ ...prev, isOpen: false }));
          } else {
            toast.error(res.error || "Gagal menambahkan komponen.");
          }
        } else {
          const res = await addMechanicalItemsToUnit(componentModal.unitId, items);
          if (res.success) {
            toast.success("Komponen mekanikal berhasil ditambahkan!");
            setComponentModal((prev) => ({ ...prev, isOpen: false }));
          } else {
            toast.error(res.error || "Gagal menambahkan komponen.");
          }
        }
      } else if (componentModal.mode === "ADD_BULK") {
        const lines = componentModal.bulkText
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (lines.length === 0) {
          toast.error("Silakan masukkan minimal 1 baris nama komponen.");
          return;
        }

        const items = lines.map((line) => {
          const parts = line.split(/[,\t]/);
          if (parts.length >= 2) {
            const name = parts[0].trim();
            const qty = parseInt(parts[1].trim(), 10) || 1;
            const satuan = parts[2]?.trim() || (componentModal.category === "STRUCTURE" ? "unit" : "set");
            return { name, qty, satuan };
          }
          return {
            name: line,
            qty: 1,
            satuan: componentModal.category === "STRUCTURE" ? "unit" : "set",
          };
        });

        if (componentModal.category === "STRUCTURE") {
          const res = await addStructureItemsToUnit(componentModal.unitId, items);
          if (res.success) {
            toast.success(`${items.length} komponen struktur berhasil ditambahkan!`);
            setComponentModal((prev) => ({ ...prev, isOpen: false }));
          } else {
            toast.error(res.error || "Gagal menambahkan bulk komponen.");
          }
        } else {
          const res = await addMechanicalItemsToUnit(componentModal.unitId, items);
          if (res.success) {
            toast.success(`${items.length} komponen mekanikal berhasil ditambahkan!`);
            setComponentModal((prev) => ({ ...prev, isOpen: false }));
          } else {
            toast.error(res.error || "Gagal menambahkan bulk komponen.");
          }
        }
      }
    });
  };

  const handleDeleteComponent = (
    category: "STRUCTURE" | "MECHANICAL",
    itemId: string,
    itemName: string,
  ) => {
    setDeleteConfirm({
      isOpen: true,
      type: category === "STRUCTURE" ? "STRUCTURE_ITEM" : "MECHANICAL_ITEM",
      id: itemId,
      title: `Hapus Komponen ${itemName}?`,
      description:
        "Komponen ini akan dihapus dari daftar master dan progres fabrikasinya akan disesuaikan.",
    });
  };

  // Drag & Drop Handlers for Components
  const handleDragStart = (
    e: React.DragEvent,
    unitId: string,
    category: "STRUCTURE" | "MECHANICAL",
    index: number,
  ) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${unitId}:${category}:${index}`);
    setDragItem({ unitId, category, index });
  };

  const handleDragOver = (
    e: React.DragEvent,
    unitId: string,
    category: "STRUCTURE" | "MECHANICAL",
    index: number,
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (
      dragItem &&
      dragItem.unitId === unitId &&
      dragItem.category === category &&
      dragItem.index !== index
    ) {
      setDragOverTarget({ unitId, category, index });
    }
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDragOverTarget(null);
  };

  const handleDrop = (
    e: React.DragEvent,
    unitId: string,
    category: "STRUCTURE" | "MECHANICAL",
    targetIndex: number,
    items: any[],
  ) => {
    e.preventDefault();
    if (
      !dragItem ||
      dragItem.unitId !== unitId ||
      dragItem.category !== category ||
      dragItem.index === targetIndex
    ) {
      setDragItem(null);
      setDragOverTarget(null);
      return;
    }

    const sourceIndex = dragItem.index;
    const reordered = [...items];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const orderedIds = reordered.map((it) => it.id);

    setDragItem(null);
    setDragOverTarget(null);

    startTransition(async () => {
      if (category === "STRUCTURE") {
        const res = await reorderStructureItems(unitId, orderedIds);
        if (res.success) {
          toast.success("Urutan komponen struktur berhasil diperbarui!");
        } else {
          toast.error("Gagal mengubah urutan komponen struktur.");
        }
      } else {
        const res = await reorderMechanicalItems(unitId, orderedIds);
        if (res.success) {
          toast.success("Urutan komponen mekanikal berhasil diperbarui!");
        } else {
          toast.error("Gagal mengubah urutan komponen mekanikal.");
        }
      }
    });
  };

  const handleExecuteDelete = () => {
    startTransition(async () => {
      if (deleteConfirm.type === "UNIT") {
        const res = await deleteConveyorUnit(deleteConfirm.id);
        if (res.success) {
          toast.success("Unit conveyor berhasil dihapus.");
          setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        } else {
          toast.error(res.error || "Gagal menghapus unit conveyor.");
        }
      } else if (deleteConfirm.type === "STRUCTURE_ITEM") {
        const res = await deleteStructureItem(deleteConfirm.id);
        if (res.success) {
          toast.success("Komponen struktur berhasil dihapus.");
          setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        } else {
          toast.error(res.error || "Gagal menghapus komponen.");
        }
      } else if (deleteConfirm.type === "MECHANICAL_ITEM") {
        const res = await deleteMechanicalItem(deleteConfirm.id);
        if (res.success) {
          toast.success("Komponen mekanikal berhasil dihapus.");
          setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        } else {
          toast.error(res.error || "Gagal menghapus komponen.");
        }
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* 1. TOP HEADER & QUICK STATS */}
      <Card className="rounded-2xl border bg-card/80 backdrop-blur shadow-sm overflow-hidden">
        <CardHeader className="p-5 border-b bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg font-bold text-foreground">
                Kelola Unit & Komponen Conveyor
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Pusat konfigurasi data master conveyor: atur bobot plan, tambah/edit unit, kelola item struktur & mekanikal, kuantitas, dan urutan pengerjaan.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMarkingDialogOpen(true)}
              className="h-9 rounded-xl font-bold text-xs gap-1.5 cursor-pointer shadow-xs hover:bg-muted text-primary border-primary/30"
            >
              <Tag className="w-4 h-4 text-primary" />
              Marking & Bundel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenWeightsModal}
              className="h-9 rounded-xl font-bold text-xs gap-1.5 cursor-pointer shadow-xs hover:bg-muted"
            >
              <Scale className="w-4 h-4 text-primary" />
              Atur Bobot Plan ({units.length} Unit)
            </Button>
            <Button
              size="sm"
              onClick={handleOpenAddUnit}
              className="h-9 rounded-xl font-bold text-xs gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Tambah Unit Conveyor
            </Button>
          </div>
        </CardHeader>

        {/* Overview Summary Bar */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/10 border-b border-border/40 text-xs">
          <div className="p-3 rounded-xl bg-background border border-border/60">
            <span className="text-muted-foreground text-[11px] font-semibold">Total Unit Conveyor</span>
            <p className="text-lg font-black text-foreground mt-0.5">{units.length} Unit</p>
          </div>
          <div className="p-3 rounded-xl bg-background border border-border/60">
            <span className="text-muted-foreground text-[11px] font-semibold">Total Komponen Struktur</span>
            <p className="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">
              {units.reduce((s, u) => s + (u.structureItems?.length || 0), 0)} Item
            </p>
          </div>
          <div className="p-3 rounded-xl bg-background border border-border/60">
            <span className="text-muted-foreground text-[11px] font-semibold">Total Komponen Mekanikal</span>
            <p className="text-lg font-black text-purple-600 dark:text-purple-400 mt-0.5">
              {units.reduce((s, u) => s + (u.mechanicalItems?.length || 0), 0)} Item
            </p>
          </div>
          <div className="p-3 rounded-xl bg-background border border-border/60">
            <span className="text-muted-foreground text-[11px] font-semibold">Total Bobot Plan Terpasang</span>
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {totalRawWeight > 0 ? "100.00%" : "Bagi Rata (100%)"}
            </p>
          </div>
        </div>
      </Card>

      {/* 2. ACCORDION LIST OF UNITS */}
      {units.length === 0 ? (
        <Card className="rounded-2xl border shadow-sm p-12 text-center">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-4 rounded-2xl bg-muted/60 text-muted-foreground">
              <Layers className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-base text-foreground">Belum Ada Unit Conveyor</h3>
            <p className="text-xs text-muted-foreground max-w-md">
              Proyek ini belum memiliki unit conveyor. Klik tombol Tambah Unit Conveyor di atas untuk mulai membuat daftar unit dan komponennya.
            </p>
            <Button size="sm" onClick={handleOpenAddUnit} className="rounded-xl mt-2 font-bold text-xs gap-1.5">
              <Plus className="w-4 h-4" /> Tambah Unit Sekarang
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {units.map((unit, unitIdx) => {
            const up = unit.progresses?.[0];
            const weightPlan =
              totalRawWeight > 0 && up && Number(up.weightPercent) > 0
                ? (Number(up.weightPercent) / totalRawWeight) * 100
                : 100 / units.length;

            const sItems = unit.structureItems || [];
            const mItems = unit.mechanicalItems || [];

            return (
              <Card
                key={unit.id}
                className="rounded-2xl border shadow-sm overflow-hidden bg-card/60 backdrop-blur-md transition-all hover:shadow-md"
              >
                {/* Unit Header Bar */}
                <div className="p-4 sm:p-5 border-b bg-muted/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-black text-sm flex items-center justify-center shrink-0">
                      {unitIdx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-base text-foreground flex items-center gap-1.5">
                          {unit.name}
                        </h4>
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                        >
                          {unit.unitType === "BOTH"
                            ? "Struktur & Mekanikal"
                            : unit.unitType === "STRUCTURE"
                              ? "Hanya Struktur"
                              : "Hanya Mekanikal"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-black px-2 py-0.5 rounded-md text-primary border-primary/40 bg-primary/5"
                        >
                          Bobot Plan: {weightPlan.toFixed(2)}%
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Volume: {unit.volume || 1} {unit.satuan || "unit"} &bull; {sItems.length} Komponen Struktur &bull; {mItems.length} Komponen Mekanikal
                      </p>
                    </div>
                  </div>

                  {/* Unit Action Controls */}
                  <div className="flex items-center gap-1.5 self-end md:self-center flex-wrap">
                    <div className="flex items-center border rounded-xl overflow-hidden bg-background">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={unitIdx === 0 || isPending}
                        onClick={() => handleMoveUnit(unitIdx, "UP")}
                        className="h-8 w-8 rounded-none text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Geser Naik"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={unitIdx === units.length - 1 || isPending}
                        onClick={() => handleMoveUnit(unitIdx, "DOWN")}
                        className="h-8 w-8 rounded-none text-muted-foreground hover:text-foreground cursor-pointer border-l"
                        title="Geser Turun"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditUnit(unit)}
                      className="h-8 px-2.5 rounded-xl text-xs font-semibold gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit Unit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPhotoUnit({
                          id: unit.id,
                          name: unit.name,
                        });
                        setPhotoDialogOpen(true);
                      }}
                      className="h-8 px-2.5 rounded-xl text-xs font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/5 cursor-pointer shadow-xs"
                      title={`Dokumentasi Foto untuk ${unit.name}`}
                    >
                      <Camera className="w-3.5 h-3.5" /> Foto Progres
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteUnit(unit.id, unit.name)}
                      className="h-8 px-2 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Unit Content: Structure & Mechanical Tables */}
                <CardContent className="p-4 sm:p-5 space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Column 1: Structure Components */}
                    {(unit.unitType === "BOTH" || unit.unitType === "STRUCTURE") && (
                      <div className="space-y-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Hammer className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <h5 className="font-bold text-xs text-foreground uppercase tracking-wider">
                              Komponen Struktur ({sItems.length})
                            </h5>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenAddComponent(unit.id, "STRUCTURE", "ADD_BULK")}
                              className="h-7 px-2 text-[11px] font-semibold text-blue-600 hover:bg-blue-500/10 rounded-lg cursor-pointer"
                            >
                              <FileText className="w-3 h-3 mr-1" /> Bulk Tambah
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenAddComponent(unit.id, "STRUCTURE", "ADD_SINGLE")}
                              className="h-7 px-2 text-[11px] font-semibold border-blue-500/30 text-blue-600 hover:bg-blue-500/10 rounded-lg cursor-pointer"
                            >
                              <Plus className="w-3 h-3 mr-1" /> Tambah
                            </Button>
                          </div>
                        </div>

                        {sItems.length === 0 ? (
                          <div className="p-4 text-center text-xs text-muted-foreground bg-background/50 rounded-lg border border-dashed">
                            Belum ada komponen struktur.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border bg-background">
                            <Table>
                              <TableHeader className="bg-muted/40 text-[11px]">
                                <TableRow>
                                  <TableHead className="w-8 text-center p-1.5" title="Drag baris untuk atur urutan">
                                    <GripVertical className="w-3.5 h-3.5 mx-auto text-muted-foreground/50" />
                                  </TableHead>
                                  <TableHead className="w-8 text-center p-1.5">No</TableHead>
                                  <TableHead className="p-1.5">Nama Komponen</TableHead>
                                  <TableHead className="w-14 text-center p-1.5">Qty</TableHead>
                                  <TableHead className="w-14 text-center p-1.5">Satuan</TableHead>
                                  <TableHead className="w-16 text-center p-1.5">Aksi</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className="text-xs">
                                {sItems.map((item: any, itIdx: number) => {
                                  const isDragging =
                                    dragItem?.unitId === unit.id &&
                                    dragItem?.category === "STRUCTURE" &&
                                    dragItem?.index === itIdx;
                                  const isOver =
                                    dragOverTarget?.unitId === unit.id &&
                                    dragOverTarget?.category === "STRUCTURE" &&
                                    dragOverTarget?.index === itIdx;
                                  const hasSubItems =
                                    item.subItems && item.subItems.length > 0;

                                  return (
                                    <React.Fragment key={item.id}>
                                      <TableRow
                                        draggable={!isPending}
                                        onDragStart={(e) =>
                                          handleDragStart(e, unit.id, "STRUCTURE", itIdx)
                                        }
                                        onDragOver={(e) =>
                                          handleDragOver(e, unit.id, "STRUCTURE", itIdx)
                                        }
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) =>
                                          handleDrop(e, unit.id, "STRUCTURE", itIdx, sItems)
                                        }
                                        onDragEnd={handleDragEnd}
                                        className={cn(
                                          "transition-all select-none group",
                                          isDragging && "opacity-40 bg-muted/70 scale-[0.99] border-dashed border-primary",
                                          isOver && "bg-primary/10 border-t-2 border-primary",
                                          !isDragging && !isOver && "hover:bg-muted/20",
                                        )}
                                      >
                                        {/* Drag Handle */}
                                        <TableCell className="text-center p-1.5 cursor-grab active:cursor-grabbing text-muted-foreground/40 group-hover:text-primary transition-colors">
                                          <GripVertical className="w-3.5 h-3.5 mx-auto" />
                                        </TableCell>

                                        {/* No */}
                                        <TableCell className="text-center font-bold text-muted-foreground p-1.5">
                                          {itIdx + 1}
                                        </TableCell>

                                        {/* Name */}
                                        <TableCell className="font-semibold p-1.5">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span>{item.name}</span>
                                            {hasSubItems && (
                                              <Badge
                                                variant="secondary"
                                                className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border border-primary/20 font-bold"
                                              >
                                                {item.subItems.length} Sub-Part
                                              </Badge>
                                            )}
                                          </div>
                                        </TableCell>

                                        {/* Qty */}
                                        <TableCell className="text-center font-bold p-1.5">
                                          {item.qty || 1}
                                        </TableCell>

                                        {/* Satuan */}
                                        <TableCell className="text-center text-muted-foreground p-1.5">
                                          {item.satuan || "unit"}
                                        </TableCell>

                                        {/* Aksi (Edit & Delete only) */}
                                        <TableCell className="p-1.5 text-center">
                                          <div className="flex items-center justify-center gap-1">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() =>
                                                setSelectedSubCompData({
                                                  open: true,
                                                  componentId: item.id,
                                                  componentName: item.name,
                                                  unitName: unit.name,
                                                  type: "STRUCTURE",
                                                })
                                              }
                                              className="h-6 w-6 text-primary hover:bg-primary/10 cursor-pointer"
                                              title="Konfigurasi & Input Sub-Part"
                                            >
                                              <Layers className="w-3 h-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleOpenEditComponent(unit.id, "STRUCTURE", item)}
                                              className="h-6 w-6 text-primary hover:bg-primary/10 cursor-pointer"
                                              title="Edit Komponen"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleDeleteComponent("STRUCTURE", item.id, item.name)}
                                              className="h-6 w-6 text-destructive hover:bg-destructive/10 cursor-pointer"
                                              title="Hapus Komponen"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>

                                      {/* Sub-Components Rows (jika ada sub-part) */}
                                      {hasSubItems &&
                                        item.subItems.map((sub: any, subIdx: number) => (
                                          <TableRow
                                            key={sub.id || `${item.id}-sub-${subIdx}`}
                                            className="bg-muted/15 border-b border-border/30 hover:bg-muted/30 transition-colors text-[11px]"
                                          >
                                            {/* Connector column */}
                                            <TableCell className="text-center p-1.5 text-muted-foreground/40">
                                              <span className="font-mono text-xs select-none">└─</span>
                                            </TableCell>

                                            {/* Sub-Numbering: e.g. 1.1, 1.2 */}
                                            <TableCell className="text-center font-bold text-primary/80 p-1.5 text-[11px]">
                                              {itIdx + 1}.{subIdx + 1}
                                            </TableCell>

                                            {/* Sub-Part Name & Details */}
                                            <TableCell className="p-1.5">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <Badge
                                                  variant="outline"
                                                  className="text-[9px] px-1 py-0 h-3.5 bg-background text-muted-foreground font-semibold border-border/80"
                                                >
                                                  Sub-Part
                                                </Badge>
                                                <span className="font-medium text-foreground">
                                                  {sub.name}
                                                </span>
                                                {sub.dimension && (
                                                  <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded font-mono">
                                                    {sub.dimension}
                                                  </span>
                                                )}
                                                {sub.markingCode && (
                                                  <Badge
                                                    variant="outline"
                                                    className="text-[9px] font-mono px-1 py-0 h-3.5 text-primary border-primary/30 bg-primary/5 font-semibold"
                                                    title={`Kode Marking: ${sub.markingCode}`}
                                                  >
                                                    {sub.markingCode}
                                                  </Badge>
                                                )}
                                              </div>
                                            </TableCell>

                                            {/* Qty */}
                                            <TableCell className="text-center font-medium text-muted-foreground p-1.5">
                                              {sub.qty || 1}
                                            </TableCell>

                                            {/* Satuan */}
                                            <TableCell className="text-center text-muted-foreground/80 p-1.5">
                                              {sub.satuan || "pcs"}
                                            </TableCell>

                                            {/* Kolom Aksi Kosong untuk Sub-Part */}
                                            <TableCell className="p-1.5 text-center text-muted-foreground/30" />
                                          </TableRow>
                                        ))}
                                    </React.Fragment>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Column 2: Mechanical Components */}
                    {(unit.unitType === "BOTH" || unit.unitType === "MECHANICAL") && (
                      <div className="space-y-3 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            <h5 className="font-bold text-xs text-foreground uppercase tracking-wider">
                              Komponen Mekanikal ({mItems.length})
                            </h5>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenAddComponent(unit.id, "MECHANICAL", "ADD_BULK")}
                              className="h-7 px-2 text-[11px] font-semibold text-purple-600 hover:bg-purple-500/10 rounded-lg cursor-pointer"
                            >
                              <FileText className="w-3 h-3 mr-1" /> Bulk Tambah
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenAddComponent(unit.id, "MECHANICAL", "ADD_SINGLE")}
                              className="h-7 px-2 text-[11px] font-semibold border-purple-500/30 text-purple-600 hover:bg-purple-500/10 rounded-lg cursor-pointer"
                            >
                              <Plus className="w-3 h-3 mr-1" /> Tambah
                            </Button>
                          </div>
                        </div>

                        {mItems.length === 0 ? (
                          <div className="p-4 text-center text-xs text-muted-foreground bg-background/50 rounded-lg border border-dashed">
                            Belum ada komponen mekanikal.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border bg-background">
                            <Table>
                              <TableHeader className="bg-muted/40 text-[11px]">
                                <TableRow>
                                  <TableHead className="w-8 text-center p-1.5" title="Drag baris untuk atur urutan">
                                    <GripVertical className="w-3.5 h-3.5 mx-auto text-muted-foreground/50" />
                                  </TableHead>
                                  <TableHead className="w-8 text-center p-1.5">No</TableHead>
                                  <TableHead className="p-1.5">Nama Komponen</TableHead>
                                  <TableHead className="w-14 text-center p-1.5">Qty</TableHead>
                                  <TableHead className="w-14 text-center p-1.5">Satuan</TableHead>
                                  <TableHead className="w-16 text-center p-1.5">Aksi</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className="text-xs">
                                {mItems.map((item: any, itIdx: number) => {
                                  const isDragging =
                                    dragItem?.unitId === unit.id &&
                                    dragItem?.category === "MECHANICAL" &&
                                    dragItem?.index === itIdx;
                                  const isOver =
                                    dragOverTarget?.unitId === unit.id &&
                                    dragOverTarget?.category === "MECHANICAL" &&
                                    dragOverTarget?.index === itIdx;
                                  const hasSubItems =
                                    item.subItems && item.subItems.length > 0;

                                  return (
                                    <React.Fragment key={item.id}>
                                      <TableRow
                                        draggable={!isPending}
                                        onDragStart={(e) =>
                                          handleDragStart(e, unit.id, "MECHANICAL", itIdx)
                                        }
                                        onDragOver={(e) =>
                                          handleDragOver(e, unit.id, "MECHANICAL", itIdx)
                                        }
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) =>
                                          handleDrop(e, unit.id, "MECHANICAL", itIdx, mItems)
                                        }
                                        onDragEnd={handleDragEnd}
                                        className={cn(
                                          "transition-all select-none group",
                                          isDragging && "opacity-40 bg-muted/70 scale-[0.99] border-dashed border-primary",
                                          isOver && "bg-primary/10 border-t-2 border-primary",
                                          !isDragging && !isOver && "hover:bg-muted/20",
                                        )}
                                      >
                                        {/* Drag Handle */}
                                        <TableCell className="text-center p-1.5 cursor-grab active:cursor-grabbing text-muted-foreground/40 group-hover:text-purple-600 transition-colors">
                                          <GripVertical className="w-3.5 h-3.5 mx-auto" />
                                        </TableCell>

                                        {/* No */}
                                        <TableCell className="text-center font-bold text-muted-foreground p-1.5">
                                          {itIdx + 1}
                                        </TableCell>

                                        {/* Name */}
                                        <TableCell className="font-semibold p-1.5">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span>{item.name}</span>
                                            {hasSubItems && (
                                              <Badge
                                                variant="secondary"
                                                className="text-[9px] px-1.5 py-0 h-4 bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-bold"
                                              >
                                                {item.subItems.length} Sub-Part
                                              </Badge>
                                            )}
                                          </div>
                                        </TableCell>

                                        {/* Qty */}
                                        <TableCell className="text-center font-bold p-1.5">
                                          {item.qty || 1}
                                        </TableCell>

                                        {/* Satuan */}
                                        <TableCell className="text-center text-muted-foreground p-1.5">
                                          {item.satuan || "set"}
                                        </TableCell>

                                        {/* Aksi (Edit & Delete only) */}
                                        <TableCell className="p-1.5 text-center">
                                          <div className="flex items-center justify-center gap-1">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() =>
                                                setSelectedSubCompData({
                                                  open: true,
                                                  componentId: item.id,
                                                  componentName: item.name,
                                                  unitName: unit.name,
                                                  type: "MECHANICAL",
                                                })
                                              }
                                              className="h-6 w-6 text-purple-600 hover:bg-purple-50 cursor-pointer"
                                              title="Konfigurasi & Input Sub-Part"
                                            >
                                              <Layers className="w-3 h-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleOpenEditComponent(unit.id, "MECHANICAL", item)}
                                              className="h-6 w-6 text-primary hover:bg-primary/10 cursor-pointer"
                                              title="Edit Komponen"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleDeleteComponent("MECHANICAL", item.id, item.name)}
                                              className="h-6 w-6 text-destructive hover:bg-destructive/10 cursor-pointer"
                                              title="Hapus Komponen"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>

                                      {/* Sub-Components Rows (jika ada sub-part) */}
                                      {hasSubItems &&
                                        item.subItems.map((sub: any, subIdx: number) => (
                                          <TableRow
                                            key={sub.id || `${item.id}-sub-${subIdx}`}
                                            className="bg-muted/15 border-b border-border/30 hover:bg-muted/30 transition-colors text-[11px]"
                                          >
                                            {/* Connector column */}
                                            <TableCell className="text-center p-1.5 text-muted-foreground/40">
                                              <span className="font-mono text-xs select-none">└─</span>
                                            </TableCell>

                                            {/* Sub-Numbering: e.g. 1.1, 1.2 */}
                                            <TableCell className="text-center font-bold text-purple-600/80 p-1.5 text-[11px]">
                                              {itIdx + 1}.{subIdx + 1}
                                            </TableCell>

                                            {/* Sub-Part Name & Details */}
                                            <TableCell className="p-1.5">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <Badge
                                                  variant="outline"
                                                  className="text-[9px] px-1 py-0 h-3.5 bg-background text-muted-foreground font-semibold border-border/80"
                                                >
                                                  Sub-Part
                                                </Badge>
                                                <span className="font-medium text-foreground">
                                                  {sub.name}
                                                </span>
                                                {(sub.spec || sub.dimension) && (
                                                  <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded font-mono">
                                                    {sub.spec || sub.dimension}
                                                  </span>
                                                )}
                                                {sub.markingCode && (
                                                  <Badge
                                                    variant="outline"
                                                    className="text-[9px] font-mono px-1 py-0 h-3.5 text-purple-600 border-purple-400/30 bg-purple-50 font-semibold"
                                                    title={`Kode Marking: ${sub.markingCode}`}
                                                  >
                                                    {sub.markingCode}
                                                  </Badge>
                                                )}
                                              </div>
                                            </TableCell>

                                            {/* Qty */}
                                            <TableCell className="text-center font-medium text-muted-foreground p-1.5">
                                              {sub.qty || 1}
                                            </TableCell>

                                            {/* Satuan */}
                                            <TableCell className="text-center text-muted-foreground/80 p-1.5">
                                              {sub.satuan || "pcs"}
                                            </TableCell>

                                            {/* Kolom Aksi Kosong untuk Sub-Part */}
                                            <TableCell className="p-1.5 text-center text-muted-foreground/30" />
                                          </TableRow>
                                        ))}
                                    </React.Fragment>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* DIALOG 1: ADD / EDIT UNIT */}
      <Dialog
        open={unitModal.isOpen}
        onOpenChange={(open) => setUnitModal((prev) => ({ ...prev, isOpen: open }))}
      >
        <DialogContent className="sm:max-w-120 rounded-2xl border-border/80">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary font-bold text-base">
              <Layers className="w-4 h-4" />
              {unitModal.mode === "CREATE" ? "Tambah Unit Conveyor Baru" : "Edit Unit Conveyor"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Atur detail unit conveyor untuk pengerjaan fabrikasi dan perakitan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nama Unit Conveyor *</Label>
              <Input
                placeholder="Contoh: Belt Conveyor BC 01 - BW 1.2 x L.58 mtr"
                value={unitModal.name}
                onChange={(e) => setUnitModal((prev) => ({ ...prev, name: e.target.value }))}
                className="h-9 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Jenis Progress</Label>
                <select
                  value={unitModal.unitType}
                  onChange={(e) =>
                    setUnitModal((prev) => ({
                      ...prev,
                      unitType: e.target.value as any,
                    }))
                  }
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs shadow-none focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="BOTH">Struktur & Mekanikal</option>
                  <option value="STRUCTURE">Hanya Struktur</option>
                  <option value="MECHANICAL">Hanya Mekanikal</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Satuan</Label>
                <Input
                  placeholder="unit"
                  value={unitModal.satuan}
                  onChange={(e) => setUnitModal((prev) => ({ ...prev, satuan: e.target.value }))}
                  className="h-9 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUnitModal((prev) => ({ ...prev, isOpen: false }))}
              className="rounded-xl text-xs font-semibold"
            >
              Batal
            </Button>
            <Button
              size="sm"
              disabled={isPending}
              onClick={handleSaveUnit}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {unitModal.mode === "CREATE" ? "Simpan Unit" : "Perbarui Unit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: MANAGE WEIGHTS FOR ALL UNITS */}
      <Dialog
        open={weightsModal.isOpen}
        onOpenChange={(open) => setWeightsModal((prev) => ({ ...prev, isOpen: open }))}
      >
        <DialogContent className="sm:max-w-140 rounded-2xl border-border/80">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary font-bold text-base">
              <Scale className="w-4 h-4" />
              Atur Bobot Plan (%) Tiap Unit Conveyor
            </DialogTitle>
            <DialogDescription className="text-xs">
              Sesuaikan bobot plan (%) masing-masing unit conveyor sesuai dengan proporsi tonase/BoQ. Penjumlahan total bobot wajib tepat 100.00%.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/60">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">Total Bobot:</span>
                <span
                  className={cn(
                    "text-sm font-black",
                    Math.abs(
                      Object.values(weightsModal.weights).reduce(
                        (s, w) => s + (Number(w) || 0),
                        0,
                      ) - 100,
                    ) < 0.05
                      ? "text-emerald-600"
                      : "text-amber-600",
                  )}
                >
                  {Object.values(weightsModal.weights)
                    .reduce((s, w) => s + (Number(w) || 0), 0)
                    .toFixed(2)}
                  %
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleEqualizeWeights}
                  className="h-7 text-[11px] font-semibold rounded-lg cursor-pointer"
                >
                  Bagi Rata
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleNormalizeWeights}
                  className="h-7 text-[11px] font-semibold rounded-lg cursor-pointer"
                >
                  Normalisasi
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {units.map((u, idx) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl border bg-background"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 text-center font-bold text-xs text-muted-foreground">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-xs truncate">{u.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      value={weightsModal.weights[u.id] ?? ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setWeightsModal((prev) => ({
                          ...prev,
                          weights: { ...prev.weights, [u.id]: val },
                        }));
                      }}
                      className="w-24 h-8 text-xs font-bold text-right"
                    />
                    <span className="text-xs font-semibold text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeightsModal((prev) => ({ ...prev, isOpen: false }))}
              className="rounded-xl text-xs font-semibold"
            >
              Batal
            </Button>
            <Button
              size="sm"
              disabled={isPending}
              onClick={handleSaveWeights}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Simpan Bobot Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: ADD / EDIT COMPONENT */}
      <Dialog
        open={componentModal.isOpen}
        onOpenChange={(open) => setComponentModal((prev) => ({ ...prev, isOpen: open }))}
      >
        <DialogContent className="sm:max-w-130 rounded-2xl border-border/80">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary font-bold text-base">
              {componentModal.category === "STRUCTURE" ? (
                <Hammer className="w-4 h-4 text-blue-600" />
              ) : (
                <Wrench className="w-4 h-4 text-purple-600" />
              )}
              {componentModal.mode === "EDIT"
                ? `Edit Komponen ${componentModal.category === "STRUCTURE" ? "Struktur" : "Mekanikal"}`
                : componentModal.mode === "ADD_BULK"
                  ? `Bulk Tambah Komponen ${componentModal.category === "STRUCTURE" ? "Struktur" : "Mekanikal"}`
                  : `Tambah Komponen ${componentModal.category === "STRUCTURE" ? "Struktur" : "Mekanikal"}`}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {componentModal.mode === "ADD_BULK"
                ? "Tuliskan nama komponen satu per satu per baris. Anda juga bisa menyertakan format 'Nama, Qty, Satuan'."
                : "Masukkan nama komponen pengerjaan fabrikasi beserta jumlah dan satuannya."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {componentModal.mode === "ADD_BULK" ? (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Daftar Komponen (1 per baris) *</Label>
                <Textarea
                  placeholder={`Contoh:\nStringer Type 1 + Trestle, 20, set\nGallery Type 1, 2, unit\nChute, 1, unit`}
                  rows={8}
                  value={componentModal.bulkText}
                  onChange={(e) =>
                    setComponentModal((prev) => ({ ...prev, bulkText: e.target.value }))
                  }
                  className="font-mono text-xs rounded-xl"
                />
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Nama Komponen *</Label>
                  <Input
                    placeholder="Contoh: Stringer Type 1 + Trestle atau Roller Carry D127"
                    value={componentModal.name}
                    onChange={(e) =>
                      setComponentModal((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="h-9 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Jumlah (Qty) *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={componentModal.qty}
                      onChange={(e) =>
                        setComponentModal((prev) => ({
                          ...prev,
                          qty: Math.max(1, parseInt(e.target.value, 10) || 1),
                        }))
                      }
                      className="h-9 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Satuan</Label>
                    <Input
                      placeholder="unit / set / pcs"
                      value={componentModal.satuan}
                      onChange={(e) =>
                        setComponentModal((prev) => ({ ...prev, satuan: e.target.value }))
                      }
                      className="h-9 rounded-lg"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setComponentModal((prev) => ({ ...prev, isOpen: false }))}
              className="rounded-xl text-xs font-semibold"
            >
              Batal
            </Button>
            <Button
              size="sm"
              disabled={isPending}
              onClick={handleSaveComponent}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {componentModal.mode === "EDIT" ? "Perbarui Komponen" : "Tambahkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: DELETE CONFIRMATION */}
      <Dialog
        open={deleteConfirm.isOpen}
        onOpenChange={(open) => setDeleteConfirm((prev) => ({ ...prev, isOpen: open }))}
      >
        <DialogContent className="sm:max-w-105 rounded-2xl border-border/80">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-bold text-base">
              <AlertTriangle className="w-4 h-4" />
              {deleteConfirm.title}
            </DialogTitle>
            <DialogDescription className="text-xs pt-1 text-muted-foreground">
              {deleteConfirm.description}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
              className="rounded-xl text-xs font-semibold"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={handleExecuteDelete}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Ya, Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progress Photo Dialog */}
      {currentProject && (
        <ProgressPhotoDialog
          isOpen={photoDialogOpen}
          onOpenChange={setPhotoDialogOpen}
          projectId={currentProject.id}
          projectName={currentProject.projectName}
          unitId={selectedPhotoUnit.id}
          unitName={selectedPhotoUnit.name}
          category="FABRICATION"
        />
      )}

      {/* Sub Component Dialog (Mode Konfigurasi Master Data Part) */}
      {selectedSubCompData && (
        <SubComponentDialog
          open={selectedSubCompData.open}
          onOpenChange={(open) => {
            if (!open) setSelectedSubCompData(null);
          }}
          componentId={selectedSubCompData.componentId}
          componentName={selectedSubCompData.componentName}
          unitName={selectedSubCompData.unitName}
          type={selectedSubCompData.type}
          mode="CONFIG"
        />
      )}

      {/* Marking Manager Dialog */}
      {currentProject && (
        <MarkingManagerDialog
          open={markingDialogOpen}
          onOpenChange={setMarkingDialogOpen}
          projectId={currentProject.id}
          projectName={currentProject.projectName}
        />
      )}
    </div>
  );
}
