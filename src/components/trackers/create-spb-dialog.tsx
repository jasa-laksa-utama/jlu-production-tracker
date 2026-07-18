"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Package,
  ShoppingCart,
  Search,
  FileText,
  Loader2,
  PlusCircle,
  Download,
  ChevronDown,
  ChevronUp,
  Pencil,
  AlertTriangle,
  Printer,
  X,
  Eye,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatRupiah } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { getWarehouseItems, getUnits } from "@/app/actions/inventory";
import { getProjectBoQ, getProjectBoQs } from "@/app/actions/boq";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  createSPB,
  getSPBHistory,
  deleteSPB,
  updateSPB,
} from "@/app/actions/spb";
import { SPBPDFDocument } from "./spb-pdf-document";
import { BoQPDFDocument } from "./boq-pdf-document";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] w-full flex flex-col items-center justify-center text-muted-foreground gap-3 bg-zinc-900 border border-zinc-800 rounded-lg">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-semibold">Memuat PDF Viewer...</span>
      </div>
    ),
  },
);

interface SPBItem {
  id: string;
  materialId?: string; // ID from database if source is WAREHOUSE
  materialCode?: string; // Code of material if source is WAREHOUSE
  materialName: string;
  typeMerk?: string;
  qty: string;
  source: "WAREHOUSE" | "TRADING";
  note: string;
  unit: string;
  currentStock?: number; // Optional for display
  reservedStock?: number; // Optional reserved stock
}

interface CreateSPBDialogProps {
  project: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const getItemStatusDetails = (status: string, source: string) => {
  switch (status) {
    case "PENDING":
      return {
        label: "Menunggu Verifikasi",
        className:
          "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
      };
    case "REJECTED":
      return {
        label: "Ditolak",
        className:
          "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50",
      };
    case "APPROVED_WAREHOUSE":
      return {
        label: "Disetujui Gudang",
        className:
          "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/50",
      };
    case "PREPARING":
      return {
        label: "Sedang Disiapkan",
        className:
          "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50",
      };
    case "PARTIALLY_ISSUED":
      return {
        label: "Diproses Sebagian",
        className:
          "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/50",
      };
    case "FULFILLED":
      return {
        label: "Sudah Dikeluarkan",
        className:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
      };
    case "PO_PENDING":
      return {
        label: "Menunggu PO",
        className:
          "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
      };
    case "PO_CREATED":
      return {
        label: "PO Dibuat",
        className:
          "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
      };
    case "RECEIVED":
      return {
        label: "Barang Diterima",
        className:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
      };
    default:
      return {
        label: status,
        className:
          "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
      };
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

export function CreateSPBDialog({
  project,
  open,
  onOpenChange,
  onSuccess,
}: CreateSPBDialogProps) {
  const [activeTab, setActiveTab] = useState("create");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inventory state
  const [warehouseItems, setWarehouseItems] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [boqItems, setBoqItems] = useState<any[]>([]);
  const [approvedBoqs, setApprovedBoqs] = useState<any[]>([]);
  const [activeDetailBoq, setActiveDetailBoq] = useState<any | null>(null);
  const [selectedBoqForPdf, setSelectedBoqForPdf] = useState<any | null>(null);
  const [isLoadingBoq, setIsLoadingBoq] = useState(false);
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [boqSearchQuery, setBoqSearchQuery] = useState("");
  const [selectedBoqItemDetail, setSelectedBoqItemDetail] = useState<
    any | null
  >(null);
  const [isBoqDetailOpen, setIsBoqDetailOpen] = useState(false);
  const [isPreviewBoqPdfOpen, setIsPreviewBoqPdfOpen] = useState(false);

  // State untuk item yang sedang diinput (Bisa multiple baris)
  const [inputRows, setInputRows] = useState<SPBItem[]>([
    {
      id: Math.random().toString(),
      materialName: "",
      typeMerk: "",
      qty: "",
      source: "WAREHOUSE",
      note: "",
      unit: "PCS",
    },
  ]);

  // State untuk antrean barang (preview atas)
  const [pendingItems, setPendingItems] = useState<SPBItem[]>([]);

  // History state (fetch in real app)
  const [spbHistory, setSpbHistory] = useState<any[]>([]);
  const [previewSPB, setPreviewSPB] = useState<any | null>(null);
  const [expandedSpbs, setExpandedSpbs] = useState<Record<string, boolean>>({});
  const router = useRouter();

  // State untuk Edit/Hapus SPB
  const [editingSpbId, setEditingSpbId] = useState<string | null>(null);
  const [editingSpbNumber, setEditingSpbNumber] = useState<string | null>(null);
  const [spbNumberInput, setSpbNumberInput] = useState("");
  const [deleteConfirmSpb, setDeleteConfirmSpb] = useState<any | null>(null);
  const [selectedHistoryDetailSpb, setSelectedHistoryDetailSpb] = useState<
    any | null
  >(null);
  const [historySpbSearchQuery, setHistorySpbSearchQuery] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleSpb = (id: string) => {
    setExpandedSpbs((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const fetchSPBHistory = async () => {
    if (!project?.id) return;
    try {
      const history = await getSPBHistory(project.id);
      setSpbHistory(history);
    } catch (err) {
      console.error("Gagal memuat riwayat SPB:", err);
    }
  };

  // Fetch items from warehouse and load history on mount or when open
  useEffect(() => {
    if (open && project?.id) {
      fetchInventory();
      fetchSPBHistory();
      fetchUnits();
      fetchBoQ();
      setSpbNumberInput("");
    }
  }, [open, project?.id]);

  useEffect(() => {
    if (activeTab === "history" && project?.id) {
      fetchSPBHistory();
    }
  }, [activeTab, project?.id]);

  const fetchInventory = async () => {
    setIsLoadingItems(true);
    try {
      const items = await getWarehouseItems();
      setWarehouseItems(items);
    } catch (error) {
      console.error("Failed to fetch inventory:", error);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const fetchBoQ = async () => {
    if (!project?.id) return;
    setIsLoadingBoq(true);
    try {
      const list = await getProjectBoQs(project.id);
      const approvedList = list.filter((b: any) => b.boqStatus === "APPROVED");

      const detailedBoqs = [];
      const aggregatedItemsMap = new Map<string, any>();
      for (const boq of approvedList) {
        const details = await getProjectBoQ(boq.id);
        if (details) {
          detailedBoqs.push(details);
          if (details.items) {
            for (const item of details.items) {
              const existing = aggregatedItemsMap.get(item.itemId);
              if (existing) {
                existing.qty += item.qty;
              } else {
                aggregatedItemsMap.set(item.itemId, { ...item });
              }
            }
          }
        }
      }

      setApprovedBoqs(detailedBoqs);
      setBoqItems(Array.from(aggregatedItemsMap.values()));
    } catch (error) {
      console.error("Failed to fetch BoQ:", error);
    } finally {
      setIsLoadingBoq(false);
    }
  };

  const getAlreadyRequestedQty = (materialId: string) => {
    let total = 0;
    for (const spb of spbHistory) {
      if (editingSpbId && spb.dbId === editingSpbId) {
        continue;
      }
      for (const item of spb.items) {
        if (item.materialId === materialId && item.status !== "REJECTED") {
          total += item.qty;
        }
      }
    }
    return total;
  };

  const fetchUnits = async () => {
    try {
      const allUnits = await getUnits();
      setUnits(allUnits);
    } catch (error) {
      console.error("Failed to fetch units:", error);
    }
  };

  const addRow = () => {
    setInputRows([
      ...inputRows,
      {
        id: Math.random().toString(),
        materialName: "",
        typeMerk: "",
        qty: "",
        source: "WAREHOUSE",
        note: "",
        unit: "PCS",
      },
    ]);
  };

  const removeRow = (id: string) => {
    if (inputRows.length === 1) {
      setInputRows([
        {
          id: Math.random().toString(),
          materialName: "",
          typeMerk: "",
          qty: "",
          source: "WAREHOUSE",
          note: "",
          unit: "PCS",
        },
      ]);
      return;
    }
    setInputRows(inputRows.filter((item) => item.id !== id));
  };

  const updateRow = (id: string, updates: Partial<SPBItem>) => {
    setInputRows(
      inputRows.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      ),
    );
  };

  const handleSelectWarehouseItem = (rowId: string, item: any) => {
    updateRow(rowId, {
      materialId: item.id,
      materialCode: item.code || "",
      materialName: item.name || "",
      typeMerk: item.typeMerk || "",
      unit: item.unit?.name || "PCS",
      currentStock: item.currentStock,
      reservedStock: item.reservedStock || 0,
      source: "WAREHOUSE",
    });
  };

  const handleAddToQueue = () => {
    const validRows = inputRows.filter((i) => i.materialName && i.qty);
    if (validRows.length === 0) {
      toast.error("Isi minimal satu barang dengan lengkap");
      return;
    }

    // Check duplicates
    const duplicateCheck = new Set<string>();
    for (const item of pendingItems) {
      if (item.materialId) {
        duplicateCheck.add(item.materialId);
      } else {
        duplicateCheck.add(item.materialName.toLowerCase().trim());
      }
    }

    for (const row of validRows) {
      const key = row.materialId
        ? row.materialId
        : row.materialName.toLowerCase().trim();
      if (duplicateCheck.has(key)) {
        toast.error(
          `Barang "${row.materialName}" sudah diinput ke dalam SPB ini!`,
        );
        return;
      }
      duplicateCheck.add(key);
    }

    const hasInvalidQty = validRows.some((i) => parseFloat(i.qty) <= 0);
    if (hasInvalidQty) {
      toast.error("Qty harus lebih besar dari 0");
      return;
    }

    // Validate against Project BoQ items
    if (boqItems.length === 0) {
      toast.error(
        "Proyek ini belum memiliki BoQ. SPB tidak dapat diterbitkan.",
      );
      return;
    }

    const hasOverBoq = validRows.some((row) => {
      if (row.materialId) {
        const boqItem = boqItems.find((b) => b.itemId === row.materialId);
        if (boqItem) {
          const alreadyRequested = getAlreadyRequestedQty(row.materialId);
          const pendingQty = pendingItems
            .filter((p) => p.materialId === row.materialId)
            .reduce((sum, p) => sum + parseFloat(p.qty || "0"), 0);
          const limit = boqItem.qty - alreadyRequested - pendingQty;
          return parseFloat(row.qty) > limit;
        }
      }
      return true; // If materialId is not found in BoQItems, fail validation!
    });

    if (hasOverBoq) {
      toast.error(
        "Kuantitas barang melebihi batas BoQ (atau barang tidak terdaftar di BoQ)!",
      );
      return;
    }

    // Validate available stock for warehouse items
    const hasOverStock = validRows.some((row) => {
      if (row.source === "WAREHOUSE" && row.currentStock !== undefined) {
        const available = row.currentStock - (row.reservedStock || 0);
        return parseFloat(row.qty) > available;
      }
      return false;
    });

    if (hasOverStock) {
      toast.error("Jumlah permintaan melebihi stok yang tersedia!");
      return;
    }

    setPendingItems([
      ...pendingItems,
      ...validRows.map((v) => ({ ...v, id: Math.random().toString() })),
    ]);

    // Reset input form
    setInputRows([
      {
        id: Math.random().toString(),
        materialName: "",
        typeMerk: "",
        qty: "",
        source: "WAREHOUSE",
        note: "",
        unit: "PCS",
      },
    ]);
    toast.success(`${validRows.length} barang masuk antrean`);
  };

  const removeFromQueue = (id: string) => {
    setPendingItems(pendingItems.filter((item) => item.id !== id));
  };

  const handleEditQueueItem = (item: SPBItem) => {
    // Populate form with this item's details
    setInputRows([
      {
        id: Math.random().toString(),
        materialId: item.materialId,
        materialCode: item.materialCode,
        materialName: item.materialName,
        typeMerk: item.typeMerk,
        qty: item.qty,
        source: item.source,
        note: item.note,
        unit: item.unit,
        currentStock: item.currentStock,
        reservedStock: item.reservedStock,
      },
    ]);
    // Remove from queue
    setPendingItems((prev) => prev.filter((i) => i.id !== item.id));
    toast.info(`Material "${item.materialName}" dimuat ke input untuk diedit.`);
  };

  const handleEditSPB = (spb: any) => {
    // Switch to create tab
    setActiveTab("create");
    // Load items into pendingItems
    const loadedItems = spb.items.map((it: any) => {
      // Find latest stock in warehouseItems
      const whItem = warehouseItems.find((w) => w.id === it.materialId);
      return {
        id: Math.random().toString(),
        materialId: it.materialId,
        materialCode: it.materialCode || whItem?.code,
        materialName: it.name,
        typeMerk: it.typeMerk || "",
        qty: String(it.qty),
        source: it.source as "WAREHOUSE" | "TRADING",
        note: it.note || "",
        unit: it.unit || "PCS",
        currentStock: whItem ? whItem.currentStock : undefined,
        reservedStock: whItem ? whItem.reservedStock || 0 : undefined,
      };
    });
    setPendingItems(loadedItems);
    setEditingSpbId(spb.dbId);
    setEditingSpbNumber(spb.id);
    setSpbNumberInput(spb.id);
    toast.info(`Mengedit SPB: ${spb.id}`);
  };

  const handleCancelEdit = () => {
    setEditingSpbId(null);
    setEditingSpbNumber(null);
    setSpbNumberInput("");
    setPendingItems([]);
    toast.info("Edit SPB dibatalkan.");
  };

  const handleDeleteSPB = async () => {
    if (!deleteConfirmSpb) return;
    setIsDeleting(true);
    try {
      const res = await deleteSPB(deleteConfirmSpb.dbId);
      if (res.success) {
        toast.success(`SPB ${deleteConfirmSpb.id} berhasil dihapus!`);
        setDeleteConfirmSpb(null);
        await fetchSPBHistory();
        router.refresh();
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || "Gagal menghapus SPB");
      }
    } catch (err) {
      console.error("Gagal menghapus SPB:", err);
      toast.error("Gagal menghapus SPB");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async () => {
    if (!spbNumberInput || spbNumberInput.trim() === "") {
      toast.error("Nomor SPB wajib diisi.");
      return;
    }

    if (pendingItems.length === 0) {
      toast.error("Belum ada barang dalam antrean SPB.");
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsInput = pendingItems.map((p) => ({
        name: p.materialName,
        typeMerk: p.typeMerk || undefined,
        qty: parseFloat(p.qty),
        source: p.source,
        unit: p.unit,
        note: p.note || undefined,
        materialId: p.materialId || undefined,
      }));

      let res;
      if (editingSpbId) {
        res = await updateSPB(editingSpbId, itemsInput, spbNumberInput);
      } else {
        res = await createSPB(project.id, itemsInput, spbNumberInput);
      }

      if (res.success) {
        setPendingItems([]);
        setEditingSpbId(null);
        setEditingSpbNumber(null);
        setSpbNumberInput("");
        toast.success(
          editingSpbId
            ? "SPB berhasil diperbarui!"
            : "SPB berhasil diterbitkan!",
        );

        // Show warnings if any (e.g. low stock alerts)
        if (res.warnings && res.warnings.length > 0) {
          res.warnings.forEach((warn: string) => {
            toast.warning(warn, { duration: 8000 });
          });
        }

        await fetchSPBHistory();
        setActiveTab("history");
        router.refresh();
        if (onSuccess) onSuccess();
      } else {
        toast.error(
          res.error ||
            (editingSpbId ? "Gagal memperbarui SPB" : "Gagal menerbitkan SPB"),
        );
      }
    } catch (err) {
      console.error(
        editingSpbId ? "Gagal memperbarui SPB:" : "Gagal menerbitkan SPB:",
        err,
      );
      toast.error(
        editingSpbId ? "Gagal memperbarui SPB" : "Gagal menerbitkan SPB",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if any row in inputRows is a duplicate of pendingItems or other inputRows
  const duplicateMap = new Set<string>();
  for (const item of pendingItems) {
    if (item.materialId) {
      duplicateMap.add(item.materialId);
    } else {
      duplicateMap.add(item.materialName.toLowerCase().trim());
    }
  }

  const inputRowOccurrences = new Map<string, number>();
  for (const ir of inputRows) {
    if (ir.materialName) {
      const key = ir.materialId
        ? ir.materialId
        : ir.materialName.toLowerCase().trim();
      inputRowOccurrences.set(key, (inputRowOccurrences.get(key) || 0) + 1);
    }
  }

  const hasAnyInputRowDuplicate = inputRows.some((ir) => {
    if (!ir.materialName) return false;
    const key = ir.materialId
      ? ir.materialId
      : ir.materialName.toLowerCase().trim();
    return duplicateMap.has(key) || (inputRowOccurrences.get(key) || 0) > 1;
  });

  const hasAnyZeroBoqRemaining = inputRows.some((ir) => {
    if (!ir.materialId) return false;
    const boqItem = boqItems.find((b) => b.itemId === ir.materialId);
    if (!boqItem) return false;
    const alreadyRequested = getAlreadyRequestedQty(ir.materialId);
    const pendingQtyInQueue = pendingItems
      .filter((p) => p.materialId === ir.materialId)
      .reduce((sum, p) => sum + parseFloat(p.qty || "0"), 0);
    const boqRemaining = boqItem.qty - alreadyRequested - pendingQtyInQueue;
    return boqRemaining <= 0;
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="md:max-w-[1000px]! max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <DialogHeader className="p-6 pb-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                    <FileText className="w-6 h-6 text-primary" />
                    Surat Permintaan Barang (SPB)
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Kelola dan cetak permintaan barang untuk project ini.
                  </DialogDescription>
                </div>
                <TabsList className="grid w-[420px] grid-cols-3 bg-muted/50 p-1">
                  <TabsTrigger
                    value="create"
                    className="text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-white transition-all cursor-pointer"
                  >
                    Buat SPB
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-white transition-all cursor-pointer"
                  >
                    Riwayat SPB
                  </TabsTrigger>
                  <TabsTrigger
                    value="boq"
                    className="text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-white transition-all cursor-pointer"
                  >
                    Daftar BoQ
                  </TabsTrigger>
                </TabsList>
              </div>
            </DialogHeader>

            <div className="mx-6 mb-4 p-4 rounded-xl bg-muted/30 border border-border/50 grid grid-cols-4 gap-6 text-xs shrink-0">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground font-semibold">
                  Project Name
                </Label>
                <p className="font-medium truncate text-foreground">
                  {project?.projectName || "-"}
                </p>
              </div>
              <div className="space-y-1 border-l pl-6">
                <Label className="text-xs text-muted-foreground font-semibold">
                  Nomor Project
                </Label>
                <p className="font-medium text-foreground">
                  {project?.projectNumber ||
                    project?.id?.slice(-8).toUpperCase()}
                </p>
              </div>
              <div className="space-y-1 border-l pl-6">
                <Label className="text-xs text-muted-foreground font-semibold">
                  Client
                </Label>
                <p className="font-medium truncate text-foreground">
                  {project?.customer?.company || project?.customer?.name || "-"}
                </p>
              </div>
              <div className="space-y-1 border-l pl-6">
                <Label className="text-xs text-muted-foreground font-semibold">
                  Status
                </Label>
                <p className="font-medium text-primary">
                  {spbHistory.length} Dokumen Terbit
                </p>
              </div>
            </div>

            <TabsContent
              value="create"
              className="flex-1 overflow-hidden flex flex-col m-0 p-0 border-0 outline-none"
            >
              <div className="flex-1 overflow-y-auto px-6 py-2">
                <div className="space-y-8 pb-6">
                  {/* SPB Document Number Input */}
                  {boqItems.length > 0 && (
                    <div className="p-5 rounded-2xl border-2 border-border/40 bg-background space-y-3 shadow-xs">
                      <div className="flex flex-col gap-1.5">
                        <Label
                          htmlFor="spbNumberInput"
                          className="text-xs font-semibold text-muted-foreground"
                        >
                          Nomor SPB *
                        </Label>
                        <Input
                          id="spbNumberInput"
                          type="text"
                          placeholder="e.g. SPB/JLU/2026/001"
                          value={spbNumberInput}
                          onChange={(e) => setSpbNumberInput(e.target.value)}
                          className="h-10 bg-muted/20 border-2 border-border/60 rounded-xl text-xs font-semibold px-3 focus-visible:ring-primary/20"
                        />
                      </div>
                    </div>
                  )}

                  {boqItems.length === 0 && !isLoadingBoq && (
                    <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 flex items-center gap-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-400">
                      <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                      <div className="space-y-1">
                        <p className="font-bold text-rose-900 dark:text-rose-400">
                          Proyek belum memiliki Bill of Quantities (BoQ)
                        </p>
                        <p className="text-muted-foreground">
                          Surat Permintaan Barang (SPB) tidak dapat diterbitkan
                          atau diperbarui karena tidak ada daftar barang BoQ
                          yang didefinisikan oleh divisi Engineering. Silakan
                          minta divisi Engineering untuk mengelola BoQ terlebih
                          dahulu.
                        </p>
                      </div>
                    </div>
                  )}

                  {editingSpbId && (
                    <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-400">
                      <div className="flex items-center gap-2">
                        <Pencil className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="font-semibold">
                          Mode Edit SPB Aktif: Anda sedang mengubah dokumen{" "}
                          <span className="underline font-bold">
                            {editingSpbNumber}
                          </span>
                          .
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEdit}
                        className="h-8 px-3 text-[11px] font-bold text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/50 cursor-pointer"
                      >
                        Batal Edit
                      </Button>
                    </div>
                  )}

                  {pendingItems.length > 0 && (
                    <div className="space-y-3">
                      <Label className="text-sm font-bold text-primary flex items-center gap-2 px-2">
                        <PlusCircle className="w-4 h-4" /> Antrean Material
                        (Belum Diterbitkan)
                      </Label>
                      <div className="grid grid-cols-1 gap-2">
                        {pendingItems.map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-4 p-3 rounded-xl border bg-primary/5 border-primary/20 relative group"
                          >
                            <div className="h-8 w-8 rounded-lg border flex items-center justify-center text-xs font-semibold text-white bg-primary shrink-0 shadow-sm">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate flex items-center gap-1.5">
                                {item.source === "WAREHOUSE" &&
                                  item.materialCode && (
                                    <span className="text-xs font-bold text-primary shrink-0">
                                      {item.materialCode}
                                    </span>
                                  )}
                                <span>{item.materialName}</span>
                                {item.typeMerk && (
                                  <span className="text-xs text-muted-foreground font-semibold">
                                    ({item.typeMerk})
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground font-semibold">
                                {item.source} • {item.qty} {item.unit}
                              </p>
                              {item.note && (
                                <p className="text-xs text-muted-foreground italic mt-0.5">
                                  Catatan: {item.note}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/5 cursor-pointer rounded-lg"
                                onClick={() => handleEditQueueItem(item)}
                                title="Edit Item"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 cursor-pointer rounded-lg"
                                onClick={() => removeFromQueue(item.id)}
                                title="Hapus Item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-b-2 border-dashed border-border/50 my-6" />
                    </div>
                  )}

                  {boqItems.length > 0 ? (
                    <div className="space-y-4">
                      <Label className="text-sm font-bold text-muted-foreground flex items-center gap-2 px-2">
                        Input Material Baru
                      </Label>
                      <div className="space-y-4">
                        {inputRows.map((row, index) => {
                          const available =
                            row.currentStock !== undefined
                              ? row.currentStock - (row.reservedStock || 0)
                              : Infinity;
                          const isOverStock =
                            row.source === "WAREHOUSE" &&
                            parseFloat(row.qty || "0") > available;
                          const key = row.materialId
                            ? row.materialId
                            : row.materialName.toLowerCase().trim();
                          const isRowDuplicate = row.materialName
                            ? duplicateMap.has(key) ||
                              (inputRowOccurrences.get(key) || 0) > 1
                            : false;

                          const boqItem = row.materialId
                            ? boqItems.find((b) => b.itemId === row.materialId)
                            : null;
                          const alreadyRequested = row.materialId
                            ? getAlreadyRequestedQty(row.materialId)
                            : 0;
                          const pendingQtyInQueue = row.materialId
                            ? pendingItems
                                .filter((p) => p.materialId === row.materialId)
                                .reduce(
                                  (sum, p) => sum + parseFloat(p.qty || "0"),
                                  0,
                                )
                            : 0;
                          const boqLimit = boqItem ? boqItem.qty : 0;
                          const boqRemaining = boqItem
                            ? Math.max(
                                0,
                                boqLimit - alreadyRequested - pendingQtyInQueue,
                              )
                            : 0;
                          const isBoqFullyAllocated = boqItem
                            ? boqRemaining <= 0
                            : false;
                          return (
                            <div
                              key={row.id}
                              className="p-5 rounded-2xl border-2 border-border/50 bg-background hover:border-primary/30 transition-all space-y-5 relative group"
                            >
                              <div className="absolute -left-3 top-6 w-7 h-7 rounded-full bg-background border-2 border-muted flex items-center justify-center text-[12px] font-black text-muted-foreground group-hover:border-primary group-hover:text-primary transition-colors shadow-sm">
                                {index + 1}
                              </div>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2.5 right-2.5 h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 cursor-pointer border border-border/10 rounded-lg bg-background shadow-xs hover:border-red-200"
                                onClick={() => removeRow(row.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>

                              <div className="grid grid-cols-[1.5fr_1fr_160px] gap-4 items-end ml-2 mr-6">
                                {(boqItem ||
                                  isRowDuplicate ||
                                  isBoqFullyAllocated) && (
                                  <div className="col-span-full flex flex-col gap-1 pb-1">
                                    {boqItem && (
                                      <span className="text-[11px] text-muted-foreground font-semibold">
                                        Batas BoQ: {boqLimit} {row.unit} (Sisa
                                        BoQ:{" "}
                                        <strong
                                          className={cn(
                                            boqRemaining === 0
                                              ? "text-red-500"
                                              : "text-primary",
                                          )}
                                        >
                                          {boqRemaining} {row.unit}
                                        </strong>
                                        )
                                      </span>
                                    )}
                                    {isRowDuplicate && (
                                      <span className="text-[10px] font-bold text-red-500 flex items-center gap-1.5 animate-in fade-in">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        Barang ini sudah dimasukkan ke SPB.
                                      </span>
                                    )}
                                    {isBoqFullyAllocated && (
                                      <span className="text-[10.5px] font-bold text-red-500 flex items-center gap-1.5 animate-in fade-in leading-relaxed">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        Barang ini sudah semua diinput ke SPB
                                        sesuai BoQ.
                                      </span>
                                    )}
                                  </div>
                                )}
                                <div className="space-y-2 relative flex flex-col">
                                  <Label className="text-xs font-semibold text-muted-foreground">
                                    Nama Item / Material
                                  </Label>
                                  <Popover
                                    open={openPopoverId === row.id}
                                    onOpenChange={(open) => {
                                      setOpenPopoverId(open ? row.id : null);
                                      if (open) setSearchQuery("");
                                    }}
                                  >
                                    <PopoverTrigger
                                      role="combobox"
                                      aria-expanded={openPopoverId === row.id}
                                      className="w-full h-11 flex items-center justify-between bg-muted/20 border-2 border-border/50 text-left font-normal rounded-xl px-3.5 hover:bg-muted/30 focus-visible:ring-primary/30 cursor-pointer outline-hidden"
                                    >
                                      <span className="truncate text-xs font-semibold text-muted-foreground">
                                        {row.materialName ||
                                          "Cari barang di BoQ..."}
                                      </span>
                                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-muted-foreground" />
                                    </PopoverTrigger>
                                    <PopoverContent
                                      className="w-[450px] p-0 rounded-xl border border-border shadow-xl bg-background"
                                      align="start"
                                    >
                                      <Command>
                                        <CommandInput
                                          placeholder="Cari nama atau kode barang BoQ..."
                                          onValueChange={setSearchQuery}
                                        />
                                        <CommandList className="max-h-[220px] overflow-y-auto">
                                          <CommandEmpty className="p-3 text-center text-xs text-muted-foreground">
                                            Barang tidak ditemukan dalam BoQ
                                            Proyek.
                                          </CommandEmpty>

                                          <CommandGroup heading="Daftar Barang BoQ Proyek">
                                            {boqItems
                                              .filter((boqItem) => {
                                                if (!searchQuery) return true;
                                                const q =
                                                  searchQuery.toLowerCase();
                                                return (
                                                  boqItem.itemName
                                                    ?.toLowerCase()
                                                    .includes(q) ||
                                                  boqItem.itemCode
                                                    ?.toLowerCase()
                                                    .includes(q) ||
                                                  boqItem.itemTypeMerk
                                                    ?.toLowerCase()
                                                    .includes(q)
                                                );
                                              })
                                              .map((boqItem) => {
                                                const alreadyRequested =
                                                  getAlreadyRequestedQty(
                                                    boqItem.itemId,
                                                  );
                                                const pendingQty = pendingItems
                                                  .filter(
                                                    (p) =>
                                                      p.materialId ===
                                                      boqItem.itemId,
                                                  )
                                                  .reduce(
                                                    (sum, p) =>
                                                      sum +
                                                      parseFloat(p.qty || "0"),
                                                    0,
                                                  );
                                                const remaining =
                                                  boqItem.qty -
                                                  alreadyRequested -
                                                  pendingQty;
                                                const whItem =
                                                  warehouseItems.find(
                                                    (w) =>
                                                      w.id === boqItem.itemId,
                                                  );
                                                const availableStock = whItem
                                                  ? whItem.currentStock -
                                                    (whItem.reservedStock || 0)
                                                  : 0;

                                                const isAlreadyAdded =
                                                  pendingItems.some(
                                                    (p) =>
                                                      p.materialId ===
                                                      boqItem.itemId,
                                                  ) ||
                                                  inputRows.some(
                                                    (ir) =>
                                                      ir.id !== row.id &&
                                                      ir.materialId ===
                                                        boqItem.itemId,
                                                  ) ||
                                                  remaining <= 0;

                                                return (
                                                  <CommandItem
                                                    key={boqItem.id}
                                                    value={`${boqItem.itemName} ${boqItem.itemCode} ${boqItem.itemTypeMerk || ""}`}
                                                    onSelect={() => {
                                                      if (isAlreadyAdded) {
                                                        if (remaining <= 0) {
                                                          toast.warning(
                                                            `Kuota BoQ untuk barang "${boqItem.itemName}" sudah habis.`,
                                                          );
                                                        } else {
                                                          toast.warning(
                                                            `Barang "${boqItem.itemName}" sudah dimasukkan ke SPB.`,
                                                          );
                                                        }
                                                        return;
                                                      }
                                                      updateRow(row.id, {
                                                        materialId:
                                                          boqItem.itemId,
                                                        materialCode:
                                                          boqItem.itemCode,
                                                        materialName:
                                                          boqItem.itemName,
                                                        typeMerk:
                                                          boqItem.itemTypeMerk ||
                                                          "",
                                                        unit: boqItem.unit,
                                                        currentStock: whItem
                                                          ? whItem.currentStock
                                                          : undefined,
                                                        reservedStock: whItem
                                                          ? whItem.reservedStock ||
                                                            0
                                                          : undefined,
                                                      });
                                                      setOpenPopoverId(null);
                                                      setSearchQuery("");
                                                    }}
                                                    className={cn(
                                                      "flex flex-col items-start gap-1 p-2.5 cursor-pointer border-b border-border/10 last:border-0 hover:bg-muted/50 rounded-lg",
                                                      isAlreadyAdded
                                                        ? "opacity-60 bg-red-500/5 cursor-not-allowed"
                                                        : "",
                                                    )}
                                                  >
                                                    <div className="flex w-full items-center justify-between">
                                                      <span
                                                        className={cn(
                                                          "font-bold text-xs",
                                                          isAlreadyAdded
                                                            ? "text-red-500 line-through"
                                                            : "text-foreground",
                                                        )}
                                                      >
                                                        {boqItem.itemName}
                                                      </span>
                                                      {isAlreadyAdded ? (
                                                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 uppercase">
                                                          Sudah Diinput
                                                        </span>
                                                      ) : (
                                                        <span className="text-[10px] font-black text-primary uppercase">
                                                          BoQ: {boqItem.qty}{" "}
                                                          {boqItem.unit} (Sisa:{" "}
                                                          {remaining}{" "}
                                                          {boqItem.unit})
                                                        </span>
                                                      )}
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground font-semibold flex w-full justify-between items-center">
                                                      <span>
                                                        Kode:{" "}
                                                        <span className="text-foreground">
                                                          {boqItem.itemCode}
                                                        </span>
                                                        {boqItem.itemTypeMerk &&
                                                          ` • Tipe: ${boqItem.itemTypeMerk}`}
                                                      </span>
                                                      <span>
                                                        Stok Gudang:{" "}
                                                        <span className="text-foreground">
                                                          {availableStock}{" "}
                                                          {boqItem.unit}
                                                        </span>
                                                      </span>
                                                    </span>
                                                  </CommandItem>
                                                );
                                              })}
                                          </CommandGroup>
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs font-semibold text-muted-foreground">
                                    Tipe / Merk
                                  </Label>
                                  <Input
                                    placeholder="e.g Siku, Sekrup..."
                                    value={row.typeMerk || ""}
                                    onChange={(e) =>
                                      updateRow(row.id, {
                                        typeMerk: e.target.value,
                                      })
                                    }
                                    className="h-11 bg-muted/20 border-2 focus-visible:ring-primary/30"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <Label className="text-xs font-semibold text-muted-foreground">
                                      Qty Permintaan
                                    </Label>
                                  </div>
                                  <div className="flex items-center">
                                    <Input
                                      type="number"
                                      placeholder="0"
                                      min="1"
                                      step="any"
                                      value={row.qty}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === "" || parseFloat(val) > 0)
                                          updateRow(row.id, { qty: val });
                                      }}
                                      className={cn(
                                        "h-11! rounded-r-none border-2 text-center font-medium bg-muted/20 focus-visible:ring-primary/30 flex-1 min-w-0",
                                        isOverStock
                                          ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                                          : "",
                                      )}
                                    />
                                    <select
                                      value={
                                        row.unit
                                          ? row.unit.toUpperCase()
                                          : "PCS"
                                      }
                                      disabled={row.source === "WAREHOUSE"}
                                      onChange={(e) =>
                                        updateRow(row.id, {
                                          unit: e.target.value,
                                        })
                                      }
                                      className={cn(
                                        "h-11 w-[75px] rounded-r-xl rounded-l-none border-2 border-l-0 border-border/50 bg-muted/30 text-xs font-bold uppercase cursor-pointer px-2 focus-visible:outline-hidden focus-visible:border-primary/50 disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-muted",
                                        isOverStock
                                          ? "border-red-500 border-l-0! focus-visible:border-red-500"
                                          : "",
                                      )}
                                    >
                                      {units.map((u) => (
                                        <option
                                          key={u.id}
                                          value={u.name.toUpperCase()}
                                          className="uppercase bg-background text-foreground"
                                        >
                                          {u.name}
                                        </option>
                                      ))}
                                      {units.length === 0 && (
                                        <>
                                          <option
                                            value="PCS"
                                            className="uppercase bg-background text-foreground"
                                          >
                                            PCS
                                          </option>
                                          <option
                                            value="MTR"
                                            className="uppercase bg-background text-foreground"
                                          >
                                            MTR
                                          </option>
                                          <option
                                            value="KG"
                                            className="uppercase bg-background text-foreground"
                                          >
                                            KG
                                          </option>
                                          <option
                                            value="SET"
                                            className="uppercase bg-background text-foreground"
                                          >
                                            SET
                                          </option>
                                          <option
                                            value="LSN"
                                            className="uppercase bg-background text-foreground"
                                          >
                                            LSN
                                          </option>
                                          <option
                                            value="SAK"
                                            className="uppercase bg-background text-foreground"
                                          >
                                            SAK
                                          </option>
                                        </>
                                      )}
                                    </select>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-[1fr_200px] gap-6 pt-3 border-t border-border/10 ml-2 mr-6 items-start">
                                <div className="space-y-2">
                                  <Label className="text-xs font-semibold text-muted-foreground">
                                    Catatan
                                  </Label>
                                  <Textarea
                                    placeholder="Tambahkan catatan khusus..."
                                    value={row.note}
                                    onChange={(e) =>
                                      updateRow(row.id, {
                                        note: e.target.value,
                                      })
                                    }
                                    className="min-h-[80px] text-xs bg-muted/5 border-2 focus-visible:ring-primary/30 resize-none"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs font-semibold text-muted-foreground">
                                    Sumber
                                  </Label>
                                  <div className="flex bg-muted/50 p-1 rounded-xl h-11 border border-border/20">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const whItem = warehouseItems.find(
                                          (w) => w.id === row.materialId,
                                        );
                                        updateRow(row.id, {
                                          source: "WAREHOUSE",
                                          currentStock: whItem
                                            ? whItem.currentStock
                                            : undefined,
                                          reservedStock: whItem
                                            ? whItem.reservedStock || 0
                                            : undefined,
                                        });
                                      }}
                                      className={cn(
                                        "flex-1 flex items-center justify-center gap-2 text-[10px] font-bold rounded-lg transition-all cursor-pointer",
                                        row.source === "WAREHOUSE"
                                          ? "bg-background text-primary shadow-sm"
                                          : "text-muted-foreground hover:text-foreground",
                                      )}
                                    >
                                      <Package className="w-4 h-4" /> Gudang
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateRow(row.id, {
                                          source: "TRADING",
                                          currentStock: undefined,
                                          reservedStock: undefined,
                                        })
                                      }
                                      className={cn(
                                        "flex-1 flex items-center justify-center gap-2 text-[10px] font-bold rounded-lg transition-all cursor-pointer",
                                        row.source === "TRADING"
                                          ? "bg-background text-orange-600 shadow-sm"
                                          : "text-muted-foreground hover:text-foreground",
                                      )}
                                    >
                                      <ShoppingCart className="w-4 h-4" />{" "}
                                      Trading
                                    </button>
                                  </div>
                                  {row.currentStock !== undefined &&
                                    row.source === "WAREHOUSE" && (
                                      <div
                                        className={cn(
                                          "text-[10px] font-bold mt-1 px-1",
                                          isOverStock
                                            ? "text-red-500"
                                            : "text-primary",
                                        )}
                                      >
                                        {isOverStock
                                          ? "⚠ Stok Kurang: "
                                          : "Tersedia: "}
                                        {Math.max(
                                          0,
                                          available -
                                            parseFloat(row.qty || "0"),
                                        )}{" "}
                                        {row.unit || "PCS"} (Total: {available})
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4 px-2">
                        <Button
                          variant="outline"
                          className="h-12 border-dashed border-2 text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 cursor-pointer rounded-xl font-semibold text-xs"
                          onClick={addRow}
                        >
                          <Plus className="w-4 h-4 mr-2" /> Tambah Baris
                        </Button>
                        <Button
                          disabled={
                            hasAnyInputRowDuplicate || hasAnyZeroBoqRemaining
                          }
                          className="h-12 bg-primary text-white hover:bg-primary/90 font-semibold text-xs gap-2 cursor-pointer transition-all rounded-xl shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={handleAddToQueue}
                        >
                          <PlusCircle className="w-4 h-4" /> Simpan ke Antrean
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-center gap-2">
                      <AlertTriangle className="w-8 h-8 text-rose-500 opacity-50" />
                      <p className="text-sm font-bold text-muted-foreground">
                        BoQ Belum Didefinisikan
                      </p>
                      <p className="text-xs text-muted-foreground max-w-md">
                        Input material dinonaktifkan karena proyek ini belum
                        memiliki Bill of Quantities (BoQ) yang valid. Silakan
                        hubungi divisi Engineering.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="p-8 bg-muted/20 border-t border-border/50 shrink-0">
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="cursor-pointer font-semibold text-muted-foreground h-11 px-6"
                >
                  Batal
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || pendingItems.length === 0}
                  className="cursor-pointer font-semibold bg-primary hover:bg-primary/90 min-w-[280px] h-11 text-white shadow-xl shadow-primary/30 tracking-tight"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  {editingSpbId
                    ? `Simpan Perubahan SPB (${pendingItems.length} Item)`
                    : `Terbitkan Dokumen SPB (${pendingItems.length} Item)`}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent
              value="boq"
              className="flex-1 overflow-hidden flex flex-col m-0 p-0 border-0 outline-none"
            >
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {isLoadingBoq ? (
                  <div className="h-48 w-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-xs font-semibold">
                      Memuat data BoQ...
                    </span>
                  </div>
                ) : approvedBoqs.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-center gap-2">
                    <FileText className="w-8 h-8 opacity-40 mb-1" />
                    <p className="text-sm font-bold text-muted-foreground">
                      BoQ Belum Didefinisikan
                    </p>
                    <p className="text-xs text-muted-foreground max-w-md">
                      Proyek ini belum memiliki daftar Bill of Quantities (BoQ)
                      yang dikelola oleh divisi Engineering.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {approvedBoqs.map((boq, index) => {
                      const totalVal = (boq.items || []).reduce(
                        (acc: number, item: any) => acc + item.qty * item.price,
                        0,
                      );
                      return (
                        <div
                          key={boq.id}
                          className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-xs p-5 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-600 border border-orange-500/20 shrink-0">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div className="space-y-1 min-w-0">
                              <h4 className="font-bold text-sm text-foreground truncate">
                                {index + 1}. {boq.boqNumber || "DOKUMEN BOQ"}
                              </h4>
                              <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                                <div className="flex items-center gap-2 font-medium">
                                  <span>
                                    Total:{" "}
                                    <strong className="text-muted-foreground">
                                      {(boq.items || []).length} Item
                                    </strong>
                                  </span>
                                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                                  <span>
                                    Nilai:{" "}
                                    <strong className="text-emerald-600 dark:text-emerald-400">
                                      {formatRupiah(totalVal)}
                                    </strong>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setBoqSearchQuery("");
                                setActiveDetailBoq(boq);
                                setIsBoqDetailOpen(true);
                              }}
                              className="h-10 px-4 text-xs font-bold gap-1.5 border-border/80 hover:bg-muted cursor-pointer rounded-xl transition-all shadow-xs"
                            >
                              <Search className="w-3.5 h-3.5" /> Detail
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedBoqForPdf(boq);
                                setIsPreviewBoqPdfOpen(true);
                              }}
                              className="h-10 px-4 text-xs font-bold gap-1.5 border-border/80 hover:bg-orange-500/5 hover:text-orange-600 hover:border-orange-500/20 cursor-pointer rounded-xl transition-all shadow-xs"
                            >
                              <Printer className="w-3.5 h-3.5" /> Cetak PDF
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent
              value="history"
              className="flex-1 overflow-hidden flex flex-col m-0 p-0 border-0 outline-none"
            >
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-6">
                  {spbHistory.length > 0 ? (
                    spbHistory.map((spb) => (
                      <div
                        key={spb.id}
                        className="p-5 rounded-2xl border border-border/50 bg-background hover:border-primary/20 hover:shadow-sm transition-all group space-y-4"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <p className="text-sm font-bold text-foreground truncate">
                                {spb.id}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold shrink-0">
                                  {spb.totalItems || spb.items.length} Item
                                </span>
                                <Badge
                                  className={cn(
                                    "text-[10px] font-bold rounded-lg border-none shadow-none px-2 py-0.5 shrink-0",
                                    getSpbStatusColor(spb.status),
                                  )}
                                >
                                  {getSpbStatusLabel(spb.status)}
                                </Badge>
                                {spb.status === "REJECTED" &&
                                  spb.rejectedReason && (
                                    <span
                                      className="text-[10px] text-red-500 font-semibold italic max-w-[150px] truncate shrink-0"
                                      title={spb.rejectedReason}
                                    >
                                      Alasan: {spb.rejectedReason}
                                    </span>
                                  )}
                                {(() => {
                                  const processed = spb.items.filter(
                                    (it: any) =>
                                      it.status === "FULFILLED" ||
                                      it.status === "RECEIVED",
                                  ).length;
                                  const total = spb.items.length;
                                  const isAll = processed === total;
                                  const isNone = processed === 0;
                                  return (
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0",
                                        isAll
                                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50"
                                          : isNone
                                            ? "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                                            : "bg-blue-500/10 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
                                      )}
                                    >
                                      {processed}/{total} barang sudah diproses
                                    </Badge>
                                  );
                                })()}
                              </div>
                              <p className="text-[11px] text-muted-foreground font-semibold">
                                Diterbitkan {spb.date}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0 md:justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedHistoryDetailSpb(spb)}
                              className="h-9 px-3 text-xs font-semibold gap-1.5 border-muted-foreground/20 hover:border-orange-500 hover:bg-orange-500 hover:text-white active:scale-95 transition-all cursor-pointer rounded-xl"
                            >
                              <Eye className="w-3.5 h-3.5" /> Detail
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPreviewSPB(spb)}
                              className="h-9 px-3 text-xs font-semibold gap-1.5 border-muted-foreground/20 hover:border-primary hover:bg-primary hover:text-white active:scale-95 transition-all cursor-pointer rounded-xl"
                            >
                              <Download className="w-3.5 h-3.5" /> Cetak
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditSPB(spb)}
                              className="h-9 px-3 text-xs font-semibold gap-1.5 border-muted-foreground/20 hover:border-blue-500 hover:bg-blue-500 hover:text-white active:scale-95 transition-all cursor-pointer rounded-xl"
                            >
                              <Pencil className="w-3.5 h-3.5" /> Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteConfirmSpb(spb)}
                              className="h-9 px-3 text-xs font-semibold gap-1.5 border-muted-foreground/20 hover:border-red-500 hover:bg-red-500 hover:text-white active:scale-95 transition-all cursor-pointer text-red-500 rounded-xl"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Hapus
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground gap-3">
                      <FileText className="w-12 h-12 opacity-20" />
                      <p className="text-xs font-bold">
                        Belum ada riwayat SPB untuk project ini.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewSPB}
        onOpenChange={(open) => !open && setPreviewSPB(null)}
      >
        <DialogContent className="max-w-4xl! h-[90vh] flex flex-col p-6 rounded-2xl bg-zinc-950 border border-zinc-800 text-white">
          <DialogHeader className="flex-none">
            <DialogTitle className="text-base font-bold text-white">
              Pratinjau Cetak SPB
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Pratinjau dokumen PDF Surat Permintaan Barang (
              {previewSPB?.spbNumber || previewSPB?.id || "-"}).
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 w-full overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 mt-4 relative">
            {previewSPB && typeof window !== "undefined" && (
              <PDFViewer
                width="100%"
                height="100%"
                showToolbar={true}
                className="border-0"
              >
                <SPBPDFDocument spb={previewSPB} project={project} />
              </PDFViewer>
            )}
          </div>
          <DialogFooter className="mt-4 flex-none">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewSPB(null)}
              className="cursor-pointer font-semibold rounded-lg bg-transparent text-white border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleteConfirmSpb}
        onOpenChange={(open) => !open && setDeleteConfirmSpb(null)}
      >
        <DialogContent className="max-w-[450px]! p-6 bg-background rounded-2xl border shadow-xl flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Hapus Surat Permintaan Barang
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-2">
              Apakah Anda yakin ingin menghapus dokumen{" "}
              <span className="font-semibold text-foreground">
                {deleteConfirmSpb?.id}
              </span>
              ? Tindakan ini akan menghapus semua barang terkait dan
              mengembalikan stock yang sudah dipesan.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="ghost"
              disabled={isDeleting}
              onClick={() => setDeleteConfirmSpb(null)}
              className="cursor-pointer font-semibold"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteSPB}
              className="cursor-pointer font-semibold bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
            >
              {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Hapus SPB
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Detail Barang SPB Riwayat */}
      <Dialog
        open={!!selectedHistoryDetailSpb}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedHistoryDetailSpb(null);
            setHistorySpbSearchQuery("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[900px]! max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-border shadow-2xl">
          <DialogHeader className="p-6 pb-4 shrink-0 border-b border-border/50">
            <div className="flex items-center justify-between w-full pr-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600 border border-orange-500/20 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    {selectedHistoryDetailSpb?.spbNumber ||
                      selectedHistoryDetailSpb?.id}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground font-medium mt-0.5">
                    Tanggal Dibuat: {selectedHistoryDetailSpb?.date}
                  </DialogDescription>
                  {selectedHistoryDetailSpb?.status === "REJECTED" &&
                    selectedHistoryDetailSpb.rejectedReason && (
                      <div className="text-xs text-red-500 font-semibold mt-1">
                        Alasan Ditolak:{" "}
                        {selectedHistoryDetailSpb.rejectedReason}
                      </div>
                    )}
                </div>
              </div>
              {selectedHistoryDetailSpb?.status && (
                <Badge
                  className={cn(
                    "text-[10px] font-bold rounded-lg border-none shadow-none px-2.5 py-1",
                    getSpbStatusColor(selectedHistoryDetailSpb.status),
                  )}
                >
                  {getSpbStatusLabel(selectedHistoryDetailSpb.status)}
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
                value={historySpbSearchQuery}
                onChange={(e) => setHistorySpbSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-9 text-xs rounded-xl bg-background border-border"
              />
              {historySpbSearchQuery && (
                <button
                  type="button"
                  onClick={() => setHistorySpbSearchQuery("")}
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
                    <th className="px-5 py-3">No</th>
                    <th className="px-5 py-3 w-[120px]">Kode Barang</th>
                    <th className="px-5 py-3">Material</th>
                    <th className="px-5 py-3 text-center">Qty</th>
                    <th className="px-5 py-3 text-center">Status</th>
                    <th className="px-5 py-3 text-right">Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered =
                      selectedHistoryDetailSpb?.items.filter((it: any) => {
                        const q = historySpbSearchQuery.toLowerCase();
                        return (
                          it.name.toLowerCase().includes(q) ||
                          (it.materialCode &&
                            it.materialCode.toLowerCase().includes(q)) ||
                          (it.typeMerk && it.typeMerk.toLowerCase().includes(q))
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
                      const { label, className } = getItemStatusDetails(
                        it.status,
                        it.source,
                      );
                      return (
                        <tr
                          key={idx}
                          className="border-t border-border/20 hover:bg-muted/5 transition-colors"
                        >
                          <td className="px-5 py-3 font-bold text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="px-5 py-3 font-semibold text-primary">
                            {it.materialCode || "-"}
                          </td>
                          <td className="px-5 py-3 font-black text-foreground/80">
                            <div>
                              <p className="flex items-center gap-1.5 font-bold">
                                <span>{it.name}</span>
                              </p>
                              {it.typeMerk && (
                                <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                                  {it.typeMerk}
                                </p>
                              )}
                              {it.note && (
                                <p className="text-xs text-muted-foreground mt-0.5 font-normal">
                                  Catatan:{" "}
                                  <span className="italic">{it.note}</span>
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-center font-bold text-primary">
                            {it.qty} {it.unit}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-semibold px-2.5 py-0.5 rounded-full border",
                                className,
                              )}
                            >
                              {label}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-bold px-3 py-0.5 rounded-full border-none",
                                it.source === "WAREHOUSE"
                                  ? "bg-blue-500/10 text-blue-600"
                                  : "bg-orange-500/10 text-orange-600",
                              )}
                            >
                              {it.source === "WAREHOUSE" ? "GUDANG" : "TRADING"}
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

          <DialogFooter className="p-4 bg-muted/10 border-t border-border/10 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedHistoryDetailSpb(null)}
              className="cursor-pointer font-semibold"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BoQ Item Detail Dialog */}
      <Dialog
        open={!!selectedBoqItemDetail}
        onOpenChange={(open) => !open && setSelectedBoqItemDetail(null)}
      >
        <DialogContent className="sm:max-w-[450px] p-6 rounded-2xl bg-background border border-border shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Detail Material BoQ
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Rincian lengkap item barang dalam Bill of Quantities (BoQ) proyek.
            </DialogDescription>
          </DialogHeader>
          {selectedBoqItemDetail && (
            <div className="space-y-3 pt-3 text-xs">
              <div className="grid grid-cols-3 py-2 border-b border-border/40">
                <span className="font-semibold text-muted-foreground col-span-1">
                  Kode Material
                </span>
                <span className="font-bold text-foreground font-mono col-span-2 uppercase">
                  {selectedBoqItemDetail.itemCode || "-"}
                </span>
              </div>
              <div className="grid grid-cols-3 py-2 border-b border-border/40">
                <span className="font-semibold text-muted-foreground col-span-1">
                  Nama Barang
                </span>
                <span className="font-bold text-foreground col-span-2">
                  {selectedBoqItemDetail.itemName || "-"}
                </span>
              </div>
              <div className="grid grid-cols-3 py-2 border-b border-border/40">
                <span className="font-semibold text-muted-foreground col-span-1">
                  Merk / Tipe
                </span>
                <span className="font-bold text-foreground col-span-2">
                  {selectedBoqItemDetail.itemTypeMerk || "-"}
                </span>
              </div>
              <div className="grid grid-cols-3 py-2 border-b border-border/40">
                <span className="font-semibold text-muted-foreground col-span-1">
                  Batas Qty BoQ
                </span>
                <span className="font-bold text-primary font-mono col-span-2">
                  {selectedBoqItemDetail.qty} {selectedBoqItemDetail.unit}
                </span>
              </div>
              <div className="grid grid-cols-3 py-2 border-b border-border/40">
                <span className="font-semibold text-muted-foreground col-span-1">
                  Estimasi Harga
                </span>
                <span className="font-bold text-foreground font-mono col-span-2">
                  {new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    maximumFractionDigits: 0,
                  }).format(selectedBoqItemDetail.price)}
                </span>
              </div>
              <div className="grid grid-cols-3 py-2 border-b border-border/40">
                <span className="font-semibold text-muted-foreground col-span-1">
                  Total Anggaran
                </span>
                <span className="font-bold text-emerald-600 font-mono col-span-2">
                  {new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    maximumFractionDigits: 0,
                  }).format(
                    selectedBoqItemDetail.price * selectedBoqItemDetail.qty,
                  )}
                </span>
              </div>
              {selectedBoqItemDetail.note && (
                <div className="space-y-1.5 pt-2">
                  <span className="font-semibold text-muted-foreground block">
                    Catatan / Deskripsi
                  </span>
                  <p className="p-3 rounded-xl bg-muted/30 border border-border/40 text-[11px] font-medium text-foreground leading-relaxed italic">
                    "{selectedBoqItemDetail.note}"
                  </p>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedBoqItemDetail(null)}
              className="cursor-pointer font-semibold rounded-lg"
            >
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detailed Bill of Quantities List Modal */}
      <Dialog open={isBoqDetailOpen} onOpenChange={setIsBoqDetailOpen}>
        <DialogContent className="max-w-4xl! max-h-[85vh] flex flex-col p-6 rounded-3xl bg-background border border-border shadow-2xl">
          <DialogHeader className="flex-none border-b border-border/10 pb-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-orange-600 border border-rose-500/20 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Detail Bill of Quantities (BoQ)
                </DialogTitle>
                <div className="flex flex-col gap-0.5 mt-1 text-xs text-muted-foreground font-semibold">
                  <p>
                    Proyek:{" "}
                    <span className="text-foreground font-bold">
                      {project?.projectName || "-"}
                    </span>
                  </p>
                  <p>
                    Nomor BoQ:{" "}
                    <span className="text-orange-600 font-extrabold">
                      {activeDetailBoq?.boqNumber || "-"}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Search bar and Total value */}
          <div className="flex items-center justify-between gap-4 py-2 flex-none">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari nama atau kode barang..."
                className="pl-10 pr-9 w-full shadow-none bg-background border-border h-11 text-xs rounded-xl focus-visible:ring-primary/20 border-2"
                value={boqSearchQuery}
                onChange={(e) => setBoqSearchQuery(e.target.value)}
              />
              {boqSearchQuery && (
                <button
                  type="button"
                  onClick={() => setBoqSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-muted-foreground/60 hover:text-foreground cursor-pointer rounded-full hover:bg-muted/80 active:scale-95 transition-all"
                  title="Bersihkan pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-semibold text-muted-foreground">
                Total Nilai:{" "}
              </span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                {formatRupiah(
                  (activeDetailBoq?.items || []).reduce(
                    (acc: number, item: any) => acc + item.qty * item.price,
                    0,
                  ),
                )}
              </span>
            </div>
          </div>

          {/* Table container */}
          <div className="flex-1 overflow-y-auto border border-border/50 rounded-2xl bg-muted/5 mt-2">
            {(() => {
              const filtered = (activeDetailBoq?.items || []).filter(
                (item: any) => {
                  const q = boqSearchQuery.toLowerCase();
                  return (
                    item.itemName.toLowerCase().includes(q) ||
                    item.itemCode.toLowerCase().includes(q) ||
                    (item.itemTypeMerk || "").toLowerCase().includes(q)
                  );
                },
              );

              if (filtered.length === 0) {
                return (
                  <div className="h-48 w-full flex flex-col items-center justify-center text-muted-foreground">
                    <Search className="w-8 h-8 opacity-30 mb-2" />
                    <p className="text-xs font-semibold">
                      Barang tidak ditemukan
                    </p>
                  </div>
                );
              }

              return (
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground sticky top-0 border-b border-border/40 z-10">
                    <tr className="font-bold text-xs text-muted-foreground/85">
                      <th className="px-5 py-3.5 text-center w-12">No</th>
                      <th className="px-5 py-3.5 w-32">Kode Barang</th>
                      <th className="px-5 py-3.5">Nama Barang</th>
                      <th className="px-5 py-3.5 text-center w-24">
                        Kuantitas
                      </th>
                      <th className="px-5 py-3.5 text-center w-20">Satuan</th>
                      <th className="px-5 py-3.5 text-right w-36">
                        Harga Satuan
                      </th>
                      <th className="px-5 py-3.5 text-right w-36">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {filtered.map((item: any, idx: number) => (
                      <tr
                        key={item.id}
                        className="hover:bg-muted/10 transition-colors"
                      >
                        <td className="px-5 py-3.5 text-center font-medium text-foreground">
                          {idx + 1}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-orange-600 uppercase">
                          {item.itemCode || "-"}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-foreground">
                          <div className="flex flex-col gap-0.5">
                            <span>{item.itemName}</span>
                            {item.itemTypeMerk && (
                              <span className="text-[10px] font-medium">
                                ({item.itemTypeMerk})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center font-semibold text-foreground">
                          {item.qty}
                        </td>
                        <td className="px-5 py-3.5 text-center font-semibold text-foreground uppercase">
                          {item.unit}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatRupiah(item.price)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-foreground">
                          {formatRupiah(item.qty * item.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-2 border-t border-border/10 flex-none">
            <Button
              onClick={() => setIsBoqDetailOpen(false)}
              className="cursor-pointer font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-xl px-6 h-10 shadow-lg shadow-orange-500/20"
            >
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* BoQ PDF Preview Dialog */}
      <Dialog open={isPreviewBoqPdfOpen} onOpenChange={setIsPreviewBoqPdfOpen}>
        <DialogContent className="max-w-4xl! h-[90vh] flex flex-col p-6 rounded-2xl bg-zinc-950 border border-zinc-800 text-white">
          <DialogHeader className="flex-none">
            <DialogTitle className="text-base font-bold text-white">
              Pratinjau Cetak BoQ
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Pratinjau dokumen PDF Bill of Quantities (
              {selectedBoqForPdf?.boqNumber || "-"}).
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 w-full overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 mt-4 relative">
            <PDFViewer
              width="100%"
              height="100%"
              showToolbar={true}
              className="border-0"
            >
              <BoQPDFDocument
                project={{
                  ...project,
                  boqNumber: selectedBoqForPdf?.boqNumber,
                  boqStatus: selectedBoqForPdf?.boqStatus,
                  boqMakerName: selectedBoqForPdf?.boqMakerName,
                  boqApprovedByPpic: selectedBoqForPdf?.boqApprovedByPpic,
                  boqApprovedByPpicAt: selectedBoqForPdf?.boqApprovedByPpicAt,
                  boqApprovedByPm: selectedBoqForPdf?.boqApprovedByPm,
                  boqApprovedByPmAt: selectedBoqForPdf?.boqApprovedByPmAt,
                  createdAt: selectedBoqForPdf?.createdAt,
                }}
                items={selectedBoqForPdf?.items || []}
              />
            </PDFViewer>
          </div>
          <DialogFooter className="mt-4 flex-none">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewBoqPdfOpen(false)}
              className="cursor-pointer font-semibold rounded-lg bg-transparent text-white border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
