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
  ChevronLeft,
  ChevronRight,
  Pencil,
  AlertTriangle,
  Printer,
  X,
  Eye,
  RotateCcw,
  Calendar,
  FileImage,
  Layers,
  UploadCloud,
  CheckCircle,
  FileSpreadsheet,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatRupiah } from "@/lib/utils";
import { formatJakartaDate } from "@/lib/date-utils";
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
  resubmitSpb,
  updateSPBItemStatus,
} from "@/app/actions/spb";
import {
  createSPBImageUploadUrl,
  getSPBImageUrl,
  getSPBImageUrls,
} from "@/app/actions/documents";
import { parseSPBImageUrls } from "@/lib/utils";

interface ImageItem {
  id: string;
  file?: File;
  previewUrl: string;
  path?: string;
  isExisting?: boolean;
}
import { SPBSubstitutionCard } from "@/components/trackers/spb-substitution-card";
import { SPBPDFDocument } from "./spb-pdf-document";
import { BoQPDFDocument } from "./boq-pdf-document";
import { SPBSmartImportDialog } from "./spb-smart-import-dialog";

/**
 * Helper to compress image client-side via Canvas API
 * Resizes max dimension to 1280px and converts to WebP quality 0.8
 */
async function compressImageFile(
  file: File,
  maxDimension = 1280,
  quality = 0.8,
): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.size < 200 * 1024) {
      resolve(file);
      return;
    }
    const img = new window.Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const outputMime = "image/jpeg";
        const fileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const compressedFile = new File([blob], fileName, {
              type: outputMime,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          outputMime,
          quality,
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
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
      <div className="h-125 w-full flex flex-col items-center justify-center text-muted-foreground gap-3 bg-zinc-900 border border-zinc-800 rounded-lg">
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
  const s = (status || "").toUpperCase();
  switch (s) {
    case "PENDING":
      return {
        label: "Menunggu Verifikasi",
        className:
          "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
      };
    case "REJECTED":
    case "DITOLAK":
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
    case "PARTIALLY ISSUED":
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
    case "COMPLETED":
    case "ISSUED":
      return {
        label: "Selesai",
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
  const s = status.toUpperCase();
  switch (s) {
    case "PENDING_APPROVAL":
      return "Menunggu Persetujuan";
    case "APPROVED":
      return "Disetujui";
    case "REJECTED":
      return "Ditolak";
    case "COMPLETED":
    case "ISSUED":
    case "FULFILLED":
      return "Completed";
    case "PARTIALLY_ISSUED":
    case "PARTIALLY ISSUED":
      return "Partially Issued";
    default:
      return status.replace(/_/g, " ");
  }
};

const getSpbStatusColor = (status?: string) => {
  if (!status)
    return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  const s = status.toUpperCase();
  switch (s) {
    case "PENDING_APPROVAL":
      return "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400";
    case "APPROVED":
    case "COMPLETED":
    case "ISSUED":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-450";
    case "PARTIALLY_ISSUED":
    case "PARTIALLY ISSUED":
      return "bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400";
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
  const [isSmartImportOpen, setIsSmartImportOpen] = useState(false);

  // Handler untuk hasil import Excel Smart SPB
  const handleConfirmSmartImport = (importedItems: any[]) => {
    if (!importedItems || importedItems.length === 0) return;

    // Convert imported items ke format inputRows
    const newRows: SPBItem[] = importedItems.map((item) => ({
      id: Math.random().toString(),
      materialName: item.name,
      typeMerk: item.typeMerk || "",
      qty: String(item.qty || "1"),
      unit: item.unit || "pcs",
      source: "WAREHOUSE",
      note: item.note || "",
      materialId: item.materialId || undefined,
    }));

    setInputRows((prev) => {
      // Jika baris pertama kosong, timpa baris pertama
      if (prev.length === 1 && !prev[0].materialName) {
        return newRows;
      }
      return [...prev, ...newRows];
    });
  };

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

  // New SPB Feature States: Deadline, Auto-Split, Image Upload (Multiple)
  const [deadlineDate, setDeadlineDate] = useState<string>("");
  const [autoSplit, setAutoSplit] = useState<boolean>(true);
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [isCompressingImage, setIsCompressingImage] = useState<boolean>(false);

  // Modal Preview Image State
  const [previewModalImages, setPreviewModalImages] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  /**
   * Auto-split logic: Splits requested qty into WAREHOUSE and TRADING rows based on available stock.
   */
  const processAutoSplitRows = (rows: SPBItem[]): SPBItem[] => {
    if (!autoSplit) return rows;
    const processed: SPBItem[] = [];

    for (const row of rows) {
      if (!row.materialId) {
        processed.push(row);
        continue;
      }

      const whItem = warehouseItems.find((w) => w.id === row.materialId);
      const totalQty = parseFloat(row.qty || "0");

      if (!whItem || isNaN(totalQty) || totalQty <= 0) {
        processed.push(row);
        continue;
      }

      const availableStock = Math.max(
        0,
        (whItem.currentStock || 0) - (whItem.reservedStock || 0),
      );

      if (availableStock >= totalQty) {
        processed.push({
          ...row,
          source: "WAREHOUSE",
          currentStock: whItem.currentStock,
          reservedStock: whItem.reservedStock,
        });
      } else if (availableStock > 0) {
        const warehouseQty = availableStock;
        const tradingQty = totalQty - availableStock;

        processed.push({
          ...row,
          id: Math.random().toString(),
          source: "WAREHOUSE",
          qty: String(warehouseQty),
          currentStock: whItem.currentStock,
          reservedStock: whItem.reservedStock,
          note: row.note,
        });

        processed.push({
          ...row,
          id: Math.random().toString(),
          source: "TRADING",
          qty: String(tradingQty),
          currentStock: whItem.currentStock,
          reservedStock: whItem.reservedStock,
          note: row.note,
        });
      } else {
        processed.push({
          ...row,
          source: "TRADING",
          currentStock: whItem.currentStock,
          reservedStock: whItem.reservedStock,
          note: row.note,
        });
      }
    }

    return processed;
  };

  const handleImagesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = files.filter((f) => f.type.startsWith("image/"));
    if (validFiles.length === 0) {
      toast.error("File harus berupa gambar (JPG, PNG, WEBP)");
      return;
    }

    try {
      setIsCompressingImage(true);
      toast.loading(`Mengompres ${validFiles.length} gambar...`, {
        id: "compress-spb-img",
      });

      const newItems: ImageItem[] = [];
      for (const file of validFiles) {
        const compressed = await compressImageFile(file, 1280, 0.8);
        newItems.push({
          id: Math.random().toString(),
          file: compressed,
          previewUrl: URL.createObjectURL(compressed),
        });
      }

      setImageItems((prev) => [...prev, ...newItems]);
      toast.success(`${newItems.length} foto lampiran berhasil ditambahkan`, {
        id: "compress-spb-img",
      });
    } catch (err) {
      console.error("Gagal mengompresi gambar:", err);
      toast.error("Gagal mengompresi gambar", { id: "compress-spb-img" });
    } finally {
      setIsCompressingImage(false);
      e.target.value = "";
    }
  };

  const handleRemoveImageItem = (id: string) => {
    setImageItems((prev) => prev.filter((item) => item.id !== id));
  };

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

    const hasInvalidQty = validRows.some((i) => parseFloat(i.qty) <= 0);
    if (hasInvalidQty) {
      toast.error("Qty harus lebih besar dari 0");
      return;
    }

    // Validate against Project BoQ items & remaining quota
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
          const sameMaterialValidRowsQty = validRows
            .filter((v) => v.materialId === row.materialId)
            .reduce((sum, v) => sum + parseFloat(v.qty || "0"), 0);

          const limit = boqItem.qty - alreadyRequested - pendingQty;
          return sameMaterialValidRowsQty > limit;
        }
      }
      return false;
    });

    if (hasOverBoq) {
      toast.error(
        "Kuantitas barang melebihi sisa batas BoQ!",
      );
      return;
    }

    // Validate available stock for warehouse items
    let finalRowsToAdd: SPBItem[] = [];
    if (autoSplit) {
      finalRowsToAdd = processAutoSplitRows(validRows);
    } else {
      const hasOverStock = validRows.some((row) => {
        if (row.source === "WAREHOUSE" && row.currentStock !== undefined) {
          const available = Math.max(
            0,
            row.currentStock - (row.reservedStock || 0),
          );
          return parseFloat(row.qty) > available;
        }
        return false;
      });

      if (hasOverStock) {
        toast.error(
          "Jumlah permintaan melebihi stok yang tersedia! Aktifkan Auto-Split atau ubah sumber ke TRADING.",
        );
        return;
      }
      finalRowsToAdd = validRows;
    }

    setPendingItems([
      ...pendingItems,
      ...finalRowsToAdd.map((v) => ({ ...v, id: Math.random().toString() })),
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
    toast.success(`${finalRowsToAdd.length} barang masuk antrean`);
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

    if (spb.deadlineDate) {
      try {
        setDeadlineDate(format(new Date(spb.deadlineDate), "yyyy-MM-dd"));
      } catch {
        setDeadlineDate("");
      }
    } else {
      setDeadlineDate("");
    }

    if (spb.imageUrl) {
      const paths = parseSPBImageUrls(spb.imageUrl);
      if (paths.length > 0) {
        getSPBImageUrls(paths).then((res) => {
          if (res.success && res.urls) {
            const existingItems: ImageItem[] = paths.map((p, index) => ({
              id: Math.random().toString(),
              path: p,
              previewUrl: res.urls[index] || p,
              isExisting: true,
            }));
            setImageItems(existingItems);
          }
        });
      } else {
        setImageItems([]);
      }
    } else {
      setImageItems([]);
    }

    toast.info(`Mengedit SPB: ${spb.id}`);
  };

  const handleCancelEdit = () => {
    setEditingSpbId(null);
    setEditingSpbNumber(null);
    setSpbNumberInput("");
    setDeadlineDate("");
    setImageItems([]);
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
      const finalImagePaths: string[] = [];

      for (const item of imageItems) {
        if (item.isExisting && item.path) {
          finalImagePaths.push(item.path);
        } else if (item.file) {
          toast.loading(`Mengupload foto ${item.file.name}...`, {
            id: "spb-image-upload",
          });
          const uploadRes = await createSPBImageUploadUrl(
            project.id,
            item.file.name,
          );
          if (!uploadRes.success || !uploadRes.uploadUrl || !uploadRes.path) {
            toast.error(
              uploadRes.error ||
                `Gagal membuat URL upload foto ${item.file.name}`,
              { id: "spb-image-upload" },
            );
            setIsSubmitting(false);
            return;
          }

          const putRes = await fetch(uploadRes.uploadUrl, {
            method: "PUT",
            body: item.file,
            headers: { "Content-Type": item.file.type },
          });

          if (!putRes.ok) {
            toast.error(
              `Gagal mengirim foto ${item.file.name} ke cloud storage`,
              {
                id: "spb-image-upload",
              },
            );
            setIsSubmitting(false);
            return;
          }

          finalImagePaths.push(uploadRes.path);
        }
      }

      if (imageItems.length > 0) {
        toast.success(
          `${finalImagePaths.length} foto lampiran berhasil diupload!`,
          {
            id: "spb-image-upload",
          },
        );
      }

      const options = {
        deadlineDate: deadlineDate ? new Date(deadlineDate) : null,
        imageUrl:
          finalImagePaths.length > 0 ? JSON.stringify(finalImagePaths) : null,
      };

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
        res = await updateSPB(
          editingSpbId,
          itemsInput,
          spbNumberInput,
          options,
        );
      } else {
        res = await createSPB(project.id, itemsInput, spbNumberInput, options);
      }

      if (res.success) {
        setPendingItems([]);
        setEditingSpbId(null);
        setEditingSpbNumber(null);
        setSpbNumberInput("");
        setDeadlineDate("");
        setImageItems([]);
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
        <DialogContent className="w-[95vw] sm:w-full md:max-w-250! max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-3xl">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <DialogHeader className="p-4 sm:p-6 pb-2 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold">
                    <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    Surat Permintaan Barang (SPB)
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Kelola dan cetak permintaan barang untuk project ini.
                  </DialogDescription>
                </div>
                <TabsList className="grid w-full sm:w-105 grid-cols-3 bg-muted/50 p-1">
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

            <div className="mx-3 sm:mx-6 mb-3 sm:mb-4 p-3 sm:p-4 rounded-xl bg-muted/30 border border-border/50 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 text-xs shrink-0">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground font-semibold">
                  Project Name
                </Label>
                <p className="font-medium truncate text-foreground">
                  {project?.projectName || "-"}
                </p>
              </div>
              <div className="space-y-1 sm:border-l sm:pl-6">
                <Label className="text-xs text-muted-foreground font-semibold">
                  Nomor Project
                </Label>
                <p className="font-medium text-foreground">
                  {project?.projectNumber ||
                    project?.id?.slice(-8).toUpperCase()}
                </p>
              </div>
              <div className="space-y-1 md:border-l md:pl-6">
                <Label className="text-xs text-muted-foreground font-semibold">
                  Client
                </Label>
                <p className="font-medium truncate text-foreground">
                  {project?.customer?.company || project?.customer?.name || "-"}
                </p>
              </div>
              <div className="space-y-1 sm:border-l sm:pl-6">
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
              <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-2">
                <div className="space-y-8 pb-6">
                  {/* SPB Header Inputs: Nomor SPB, Tenggat Waktu, Auto-Split Toggle, Upload Gambar */}
                  {boqItems.length > 0 && (
                    <div className="p-3.5 sm:p-5 rounded-2xl border-2 border-border/40 bg-background space-y-4 shadow-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <Label
                            htmlFor="spbNumberInput"
                            className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5 text-primary" />{" "}
                            Nomor SPB *
                          </Label>
                          <Input
                            id="spbNumberInput"
                            type="text"
                            placeholder="e.g. SPB/PROJECT-2026-07-001/001"
                            value={spbNumberInput}
                            onChange={(e) => setSpbNumberInput(e.target.value)}
                            className="h-10 bg-muted/20 border-2 border-border/60 rounded-xl text-xs font-semibold px-3 focus-visible:ring-primary/20"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Label
                            htmlFor="spbDeadlineInput"
                            className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"
                          >
                            <Calendar className="w-3.5 h-3.5 text-primary" />{" "}
                            Tenggat Waktu / Due Date
                          </Label>
                          <Input
                            id="spbDeadlineInput"
                            type="date"
                            value={deadlineDate}
                            onChange={(e) => setDeadlineDate(e.target.value)}
                            className="h-10 bg-muted/20 border-2 border-border/60 rounded-xl text-xs font-semibold px-3 focus-visible:ring-primary/20"
                          />
                        </div>
                      </div>

                      {/* Row 1: 2 Columns side-by-side (Auto-Split Toggle & Button Upload Gambar) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-2 border-t border-border/30">
                        {/* Left: Auto-Split Stock Toggle */}
                        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-primary/20 bg-primary/5 h-10">
                          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                            <Layers className="w-3.5 h-3.5 text-primary shrink-0" />{" "}
                            Auto-Split Stok Gudang
                          </Label>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={autoSplit}
                              onChange={(e) => setAutoSplit(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-muted peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                          </label>
                        </div>

                        {/* Right: Button Upload File Gambar */}
                        <div>
                          <label className="flex items-center justify-center gap-2 h-10 px-3 border-2 border-dashed border-border/60 hover:border-primary/40 rounded-xl bg-muted/10 hover:bg-muted/20 cursor-pointer transition-colors text-xs font-semibold text-muted-foreground">
                            <UploadCloud className="w-4 h-4 text-primary" />
                            <span>
                              {isCompressingImage
                                ? "Mengompres Gambar..."
                                : "+ Upload Lampiran Gambar (JPG/JPEG/PNG)"}
                            </span>
                            <input
                              type="file"
                              multiple
                              accept="image/jpeg,image/png,image/webp"
                              onChange={handleImagesChange}
                              disabled={isCompressingImage}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Row 2: List Preview Gambar Lampiran yang diupload (2 Kolom) */}
                      {imageItems.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                              <FileImage className="w-3.5 h-3.5 text-primary" />{" "}
                              Lampiran Gambar SPB ({imageItems.length} Foto
                              Terpilih)
                            </Label>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                            {imageItems.map((item, idx) => (
                              <div
                                key={item.id}
                                className="flex items-center gap-2 p-1.5 rounded-xl border border-primary/20 bg-primary/5 relative group"
                              >
                                <div className="w-9 h-9 rounded-lg overflow-hidden border border-border shrink-0 bg-background">
                                  <img
                                    src={item.previewUrl}
                                    alt={`Preview Lampiran ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-semibold truncate text-foreground flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                                    {item.file
                                      ? item.file.name
                                      : `Foto ${idx + 1}`}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveImageItem(item.id)}
                                  className="h-6 w-6 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer shrink-0"
                                  title="Hapus Foto"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
                                {item.materialCode && (
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
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-2">
                        <Label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                          Input Material Baru
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsSmartImportOpen(true)}
                          className="h-8.5 border-2 border-emerald-500/40 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100/60 font-semibold text-xs gap-1.5 transition-all cursor-pointer rounded-xl shrink-0"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          Import Excel (BoQ Match)
                        </Button>
                      </div>
                      <div className="space-y-4">
                        {inputRows.map((row, index) => {
                          const available =
                            row.currentStock !== undefined
                              ? Math.max(
                                  0,
                              row.currentStock - (row.reservedStock || 0),
                                )
                              : Infinity;
                          const isOverStock =
                            row.source === "WAREHOUSE" &&
                            parseFloat(row.qty || "0") > available;
                          const isRowDuplicate = false;

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
                              className="p-3.5 sm:p-5 rounded-2xl border-2 border-border/50 bg-background hover:border-primary/30 transition-all space-y-4 sm:space-y-5 relative group"
                            >
                              <div className="absolute -left-2 sm:-left-3 top-4 sm:top-6 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-background border-2 border-muted flex items-center justify-center text-[11px] sm:text-[12px] font-black text-muted-foreground group-hover:border-primary group-hover:text-primary transition-colors shadow-sm">
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

                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-end ml-1 sm:ml-2 mr-6">
                                {boqItem && (
                                  <div className="col-span-full flex flex-col gap-1 pb-1">
                                    <span className="text-[11px] text-muted-foreground font-semibold">
                                      Batas BoQ: {boqLimit} {row.unit} (Sisa
                                      BoQ:{" "}
                                      <strong
                                        className={cn(
                                          boqRemaining === 0
                                            ? "text-red-500 font-bold"
                                            : "text-primary font-bold",
                                        )}
                                      >
                                        {boqRemaining} {row.unit}
                                      </strong>
                                      )
                                    </span>
                                    {boqRemaining <= 0 && (
                                      <span className="text-[10.5px] font-bold text-red-500 flex items-center gap-1.5 animate-in fade-in leading-relaxed">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        Sisa kuota BoQ untuk barang ini sudah habis.
                                      </span>
                                    )}
                                    {boqRemaining > 0 &&
                                      parseFloat(row.qty || "0") > boqRemaining && (
                                        <span className="text-[10.5px] font-bold text-red-500 flex items-center gap-1.5 animate-in fade-in leading-relaxed">
                                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                          Kuantitas permintaan ({row.qty} {row.unit}) melebihi sisa BoQ ({boqRemaining} {row.unit}).
                                        </span>
                                      )}
                                  </div>
                                )}
                                <div className="col-span-12 sm:col-span-5 space-y-2 relative flex flex-col">
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
                                      className="w-155 max-w-[90vw] p-0 rounded-xl border border-border shadow-2xl bg-background"
                                      align="start"
                                    >
                                      <Command>
                                        <CommandInput
                                          placeholder="Cari nama atau kode barang BoQ..."
                                          onValueChange={setSearchQuery}
                                        />
                                        <CommandList className="max-h-65 overflow-y-auto">
                                          <CommandEmpty className="p-3 text-center text-xs text-muted-foreground">
                                            Barang tidak ditemukan dalam BoQ
                                            Proyek.
                                          </CommandEmpty>

                                          {(() => {
                                            const filteredBoqItems =
                                              boqItems.filter((boqItem) => {
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
                                              });

                                            return (
                                              <CommandGroup
                                                heading={`Daftar Barang BoQ Proyek (${filteredBoqItems.length} dari ${boqItems.length} Data)`}
                                              >
                                                {filteredBoqItems.map(
                                                  (boqItem, itemIdx) => {
                                                    const alreadyRequested =
                                                      getAlreadyRequestedQty(
                                                        boqItem.itemId,
                                                      );
                                                    const pendingQty =
                                                      pendingItems
                                                        .filter(
                                                          (p) =>
                                                            p.materialId ===
                                                            boqItem.itemId,
                                                        )
                                                        .reduce(
                                                          (sum, p) =>
                                                            sum +
                                                            parseFloat(
                                                              p.qty || "0",
                                                            ),
                                                          0,
                                                        );
                                                    const remaining =
                                                      boqItem.qty -
                                                      alreadyRequested -
                                                      pendingQty;
                                                    const whItem =
                                                      warehouseItems.find(
                                                        (w) =>
                                                          w.id ===
                                                          boqItem.itemId,
                                                      );
                                                    const availableStock =
                                                      whItem
                                                        ? Math.max(
                                                            0,
                                                            whItem.currentStock -
                                                              (whItem.reservedStock ||
                                                                0),
                                                          )
                                                        : 0;

                                                    const isFullyAllocated = remaining <= 0;

                                                    return (
                                                      <CommandItem
                                                        key={boqItem.id}
                                                        value={`${boqItem.itemName} ${boqItem.itemCode} ${boqItem.itemTypeMerk || ""}`}
                                                        onSelect={() => {
                                                          if (isFullyAllocated) {
                                                            toast.warning(
                                                              `Kuota BoQ untuk barang "${boqItem.itemName}" sudah habis.`,
                                                            );
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
                                                            reservedStock:
                                                              whItem
                                                                ? whItem.reservedStock ||
                                                                  0
                                                                : undefined,
                                                          });
                                                          setOpenPopoverId(
                                                            null,
                                                          );
                                                          setSearchQuery("");
                                                        }}
                                                        className={cn(
                                                          "flex flex-col items-start gap-1 p-2.5 cursor-pointer border-b border-border/10 last:border-0 hover:bg-muted/50 rounded-lg",
                                                          isFullyAllocated
                                                            ? "opacity-60 bg-red-500/5 cursor-not-allowed"
                                                            : "",
                                                        )}
                                                      >
                                                        <div className="flex w-full items-center justify-between gap-3">
                                                          <span
                                                            className={cn(
                                                              "font-bold text-xs flex items-center gap-1.5",
                                                              isFullyAllocated
                                                                ? "text-red-500 line-through"
                                                                : "text-foreground",
                                                            )}
                                                          >
                                                            <span className="text-muted-foreground text-[11px]">
                                                              {itemIdx + 1}.
                                                            </span>
                                                            <span>
                                                              {boqItem.itemName}
                                                            </span>
                                                          </span>
                                                          {isFullyAllocated ? (
                                                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 uppercase shrink-0">
                                                              Kuota Habis
                                                            </span>
                                                          ) : (
                                                            <span className="text-[10px] font-black text-primary uppercase shrink-0">
                                                              BoQ: {boqItem.qty}{" "}
                                                              {boqItem.unit}{" "}
                                                              (Sisa: {remaining}{" "}
                                                              {boqItem.unit})
                                                            </span>
                                                          )}
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground font-semibold flex w-full justify-between items-center pl-4">
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
                                                  },
                                                )}
                                              </CommandGroup>
                                            );
                                          })()}
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                <div className="col-span-12 sm:col-span-4 space-y-2">
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
                                <div className="col-span-12 sm:col-span-3 space-y-2">
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
                                        "h-11 w-18.75 rounded-r-xl rounded-l-none border-2 border-l-0 border-border/50 bg-muted/30 text-xs font-bold uppercase cursor-pointer px-2 focus-visible:outline-hidden focus-visible:border-primary/50 disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-muted",
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

                              <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4 sm:gap-6 pt-3 border-t border-border/10 ml-0 sm:ml-2 mr-0 sm:mr-6 items-start">
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
                                    className="min-h-20 text-xs bg-muted/5 border-2 focus-visible:ring-primary/30 resize-none"
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 mt-4 px-0 sm:px-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 border-dashed border-2 border-primary/40 text-primary hover:bg-primary/5 font-semibold text-xs transition-all cursor-pointer rounded-xl"
                          onClick={addRow}
                        >
                          <Plus className="w-4 h-4 mr-2" /> Tambah Baris
                        </Button>
                        <Button
                          disabled={hasAnyZeroBoqRemaining}
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
              <DialogFooter className="p-5 sm:p-6 bg-muted/30 border-t border-border/50 shrink-0 flex items-center justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="cursor-pointer font-semibold text-muted-foreground h-10 text-xs px-5 rounded-xl hover:bg-muted"
                >
                  Batal
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || pendingItems.length === 0}
                  className="cursor-pointer font-bold bg-primary hover:bg-primary/90 h-10 text-xs px-5 text-white shadow-md shadow-primary/20 rounded-xl tracking-tight shrink-0"
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
              <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4">
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
                          className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-xs p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-600 border border-orange-500/20 shrink-0">
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

                          <div className="flex items-center gap-2 shrink-0 justify-end w-full sm:w-auto">
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
              <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4">
                <div className="space-y-6">
                  {spbHistory.length > 0 ? (
                    [...spbHistory]
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt || b.date).getTime() -
                          new Date(a.createdAt || a.date).getTime(),
                      )
                      .map((spb) => (
                      <div
                        key={spb.id}
                        className="p-3.5 sm:p-5 rounded-2xl border border-border/50 bg-background hover:border-primary/20 hover:shadow-sm transition-all group space-y-3 sm:space-y-4"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                          <div className="flex items-start gap-3 sm:gap-4 flex-1">
                            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
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
                                      className="text-[10px] text-red-500 font-semibold italic max-w-37.5 truncate shrink-0"
                                      title={spb.rejectedReason}
                                    >
                                      Alasan: {spb.rejectedReason}
                                    </span>
                                  )}
                                {(() => {
                                  const isCompletedSpb = [
                                    "COMPLETED",
                                    "ISSUED",
                                    "FULFILLED",
                                  ].includes((spb.status || "").toUpperCase());
                                  const processed = isCompletedSpb
                                    ? spb.items.length
                                    : spb.items.filter((it: any) => {
                                        const st = (
                                          it.status || ""
                                        ).toUpperCase();
                                        return (
                                          st === "FULFILLED" ||
                                          st === "RECEIVED" ||
                                          st === "ISSUED" ||
                                          st === "COMPLETED" ||
                                          st === "PARTIALLY_ISSUED" ||
                                          st === "PARTIALLY ISSUED" ||
                                          (it.issuedQty &&
                                            Number(it.issuedQty) > 0) ||
                                          (it.fulfilledQty &&
                                            Number(it.fulfilledQty) > 0)
                                        );
                                      }).length;
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
                              <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground font-semibold">
                                <span>Diterbitkan {spb.date}</span>
                                {spb.deadlineDate && (
                                  <span className="text-red-600 font-bold">
                                    • Tenggat:{" "}
                                    {formatJakartaDate(
                                      spb.deadlineDate,
                                      "date",
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-start sm:items-end gap-1 shrink-0 w-full sm:w-auto">
                            {/* Top Row: Lihat Foto, Detail, Cetak */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {spb.imageUrl &&
                                (() => {
                                  const parsedUrls = parseSPBImageUrls(
                                    spb.imageUrl,
                                  );
                                  const count = parsedUrls.length;
                                  return (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={async () => {
                                        const res = await getSPBImageUrls(
                                          spb.imageUrl,
                                        );
                                        if (
                                          res.success &&
                                          res.urls &&
                                          res.urls.length > 0
                                        ) {
                                          setPreviewModalImages(res.urls);
                                          setActiveImageIndex(0);
                                        } else {
                                          toast.error(
                                            res.error ||
                                              "Gagal memuat foto lampiran",
                                          );
                                        }
                                      }}
                                      className="h-6 text-[10px] font-bold px-2 gap-1 border-primary/30 text-primary hover:bg-primary/10 rounded-md shadow-none cursor-pointer"
                                    >
                                      <FileImage className="w-3 h-3" /> Lihat
                                      Foto {count > 1 ? `(${count})` : ""}
                                    </Button>
                                  );
                                })()}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedHistoryDetailSpb(spb)}
                                className="h-6 text-[10px] font-bold px-2 gap-1 border-border/80 hover:bg-orange-500/10 hover:text-orange-600 rounded-md shadow-none cursor-pointer"
                              >
                                <Eye className="w-3 h-3" /> Detail
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPreviewSPB(spb)}
                                className="h-6 text-[10px] font-bold px-2 gap-1 border-border/80 hover:bg-primary/10 hover:text-primary rounded-md shadow-none cursor-pointer"
                              >
                                <Printer className="w-3 h-3" /> Cetak
                              </Button>
                            </div>

                            {/* Bottom Row: Edit, Hapus, (Ajukan Kembali) */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {(spb.status === "REJECTED" ||
                                spb.items?.some(
                                  (it: any) =>
                                    (it.status || "").toUpperCase() ===
                                      "REJECTED" ||
                                    (it.status || "").toUpperCase() ===
                                      "DITOLAK",
                                )) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const res = await resubmitSpb(
                                        spb.dbId || spb.id,
                                      );
                                      if (res.success) {
                                        toast.success(
                                          "SPB berhasil diajukan kembali",
                                        );
                                        fetchSPBHistory();
                                        router.refresh();
                                      } else {
                                        toast.error(
                                          res.error ||
                                            "Gagal mengajukan kembali SPB",
                                        );
                                      }
                                    } catch (err) {
                                      toast.error(
                                        "Terjadi kesalahan saat mengajukan kembali",
                                      );
                                    }
                                  }}
                                  className="h-6 text-[10px] font-bold px-2 gap-1 border-amber-500/30 text-amber-700 hover:bg-amber-500/10 rounded-md shadow-none cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" /> Ajukan
                                  Kembali
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditSPB(spb)}
                                className="h-6 text-[10px] font-bold px-2 gap-1 border-border/80 hover:bg-blue-500/10 hover:text-blue-600 rounded-md shadow-none cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" /> Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteConfirmSpb(spb)}
                                className="h-6 text-[10px] font-bold px-2 gap-1 border-border/80 text-red-500 hover:bg-red-500/10 rounded-md shadow-none cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" /> Hapus
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-50 flex flex-col items-center justify-center text-muted-foreground gap-3">
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
        <DialogContent className="max-w-112.5! p-6 bg-background rounded-2xl border shadow-xl flex flex-col gap-4">
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
        <DialogContent className="w-[95vw] sm:w-full sm:max-w-225! max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-border shadow-2xl">
          <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 shrink-0 border-b border-border/50">
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
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <DialogDescription className="text-xs text-muted-foreground font-medium">
                      Tanggal Dibuat: {selectedHistoryDetailSpb?.date}
                    </DialogDescription>
                    {selectedHistoryDetailSpb?.deadlineDate && (
                      <span className="text-[11px] text-red-500 font-bold">
                        • Tenggat:{" "}
                        {formatJakartaDate(
                          selectedHistoryDetailSpb.deadlineDate,
                          "date",
                        )}
                      </span>
                    )}
                    {selectedHistoryDetailSpb?.imageUrl &&
                      (() => {
                        const parsedUrls = parseSPBImageUrls(
                          selectedHistoryDetailSpb.imageUrl,
                        );
                        const count = parsedUrls.length;
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const res = await getSPBImageUrls(
                                selectedHistoryDetailSpb.imageUrl,
                              );
                              if (
                                res.success &&
                                res.urls &&
                                res.urls.length > 0
                              ) {
                                setPreviewModalImages(res.urls);
                                setActiveImageIndex(0);
                              } else {
                                toast.error(
                                  res.error || "Gagal memuat foto lampiran",
                                );
                              }
                            }}
                            className="h-7 text-xs font-semibold px-2.5 gap-1 border-primary/30 text-primary hover:bg-primary/10 rounded-lg shadow-none cursor-pointer"
                          >
                            <FileImage className="w-3 h-3" /> Lihat Foto{" "}
                            {count > 1 ? `(${count})` : ""}
                          </Button>
                        );
                      })()}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewSPB(selectedHistoryDetailSpb)}
                      className="h-7 text-xs font-semibold px-2.5 gap-1 border-primary/30 text-primary hover:bg-primary hover:text-white rounded-lg shadow-none cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> Cetak PDF
                    </Button>
                  </div>
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
                    <th className="px-5 py-3 w-30">Kode Barang</th>
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
                              <SPBSubstitutionCard
                                item={it}
                                onUpdated={fetchSPBHistory}
                              />
                            </div>
                          </td>
                          <td className="px-5 py-3 text-center font-bold text-primary">
                            {it.qty} {it.unit}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-semibold px-2.5 py-0.5 rounded-full border",
                                  className,
                                )}
                              >
                                {label}
                              </Badge>
                              {((it.status || "").toUpperCase() ===
                                "REJECTED" ||
                                (it.status || "").toUpperCase() ===
                                  "DITOLAK") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      const res = await updateSPBItemStatus(
                                        it.id,
                                        "PENDING",
                                      );
                                      if (res.success) {
                                        toast.success(
                                          `Barang ${it.name} berhasil diajukan kembali`,
                                        );
                                        fetchSPBHistory();
                                        setSelectedHistoryDetailSpb(
                                          (prev: any) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  status:
                                                    prev.status === "REJECTED"
                                                      ? "PENDING_APPROVAL"
                                                      : prev.status,
                                                  items: prev.items.map(
                                                    (item: any) =>
                                                      item.id === it.id
                                                        ? {
                                                            ...item,
                                                            status: "PENDING",
                                                          }
                                                        : item,
                                                  ),
                                                }
                                              : null,
                                        );
                                        router.refresh();
                                      } else {
                                        toast.error(
                                          res.error ||
                                            "Gagal mengajukan kembali barang",
                                        );
                                      }
                                    } catch (err) {
                                      toast.error("Terjadi kesalahan");
                                    }
                                  }}
                                  className="h-6 px-2 text-[10px] font-bold text-amber-700 border-amber-300 hover:bg-amber-500 hover:text-white rounded-lg cursor-pointer flex items-center gap-1 mt-0.5"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  Ajukan Kembali
                                </Button>
                              )}
                            </div>
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
        <DialogContent className="sm:max-w-112.5 p-6 rounded-2xl bg-background border border-border shadow-xl">
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
        <DialogContent className="w-[95vw] sm:w-full max-w-4xl! max-h-[90vh] flex flex-col p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-background border border-border shadow-2xl">
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

      {/* IMAGE PREVIEW DIALOG */}
      <Dialog
        open={previewModalImages.length > 0}
        onOpenChange={(open) => !open && setPreviewModalImages([])}
      >
        <DialogContent className="w-[95vw] sm:max-w-3xl rounded-2xl p-4 sm:p-6 flex flex-col items-center">
          <DialogHeader className="w-full flex flex-row items-center justify-between">
            <DialogTitle className="text-sm sm:text-base font-bold text-primary flex items-center gap-2">
              <FileImage className="w-5 h-5 text-primary" /> Lampiran Foto SPB{" "}
              {previewModalImages.length > 1
                ? `(${activeImageIndex + 1}/${previewModalImages.length})`
                : ""}
            </DialogTitle>
          </DialogHeader>
          {previewModalImages.length > 0 && (
            <div className="w-full flex flex-col items-center my-2 space-y-3">
              <div className="w-full max-h-[65vh] flex items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-black/5 p-2 relative group">
                <img
                  src={previewModalImages[activeImageIndex]}
                  alt={`Lampiran SPB ${activeImageIndex + 1}`}
                  className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-md"
                />

                {previewModalImages.length > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() =>
                        setActiveImageIndex((prev) =>
                          prev > 0 ? prev - 1 : previewModalImages.length - 1,
                        )
                      }
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100 shadow-md h-9 w-9 cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>

                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() =>
                        setActiveImageIndex((prev) =>
                          prev < previewModalImages.length - 1 ? prev + 1 : 0,
                        )
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100 shadow-md h-9 w-9 cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </>
                )}
              </div>

              {/* Thumbnail Selector */}
              {previewModalImages.length > 1 && (
                <div className="flex items-center gap-2 max-w-full overflow-x-auto p-1">
                  {previewModalImages.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                        activeImageIndex === idx
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Thumb ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Smart Import Excel SPB (BoQ Match) */}
      <SPBSmartImportDialog
        open={isSmartImportOpen}
        onOpenChange={setIsSmartImportOpen}
        project={project}
        boqItems={boqItems}
        onConfirmImport={handleConfirmSmartImport}
      />
    </>
  );
}
