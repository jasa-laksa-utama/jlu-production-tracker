"use client";

import { useState, useEffect, useRef } from "react";
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
import {
  Plus,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileText,
  DollarSign,
  Printer,
  Pencil,
  AlertTriangle,
  X,
  Send,
  Download,
  Upload,
  FileSpreadsheet,
} from "lucide-react";
import { downloadBoQTemplate, parseBoQExcelFile, SmartExcelRow } from "@/lib/boq-excel-utils";
import { BoQSmartImportDialog } from "@/components/trackers/boq-smart-import-dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { getWarehouseItems, getUnits } from "@/app/actions/inventory";
import {
  getProjectBoQ,
  getProjectBoQs,
  createProjectBoQ,
  updateProjectBoQ,
  deleteProjectBoQ,
  BoQItemInput,
} from "@/app/actions/boq";
import {
  submitBoQForApproval,
  getProjectBoQMetadata,
} from "@/app/actions/boq-approval";
import { formatRupiah, cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { BoQPDFDocument } from "./boq-pdf-document";

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

export interface BoQItemDisplay {
  id: string; // Temp client ID or database ID
  itemId: string;
  itemCode: string;
  itemName: string;
  itemTypeMerk?: string;
  qty: number;
  unit: string;
  price: number;
  note: string;
}

interface BoQManagerDialogProps {
  project: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BoQManagerDialog({
  project,
  open,
  onOpenChange,
  onSuccess,
}: BoQManagerDialogProps) {
  const { data: session } = useSession();
  const roles = (session?.user as any)?.roles || [];
  const isEngineering = roles.includes("Engineering");
  const [activeTab, setActiveTab] = useState("create");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  const [projectBoQs, setProjectBoQs] = useState<any[]>([]);
  const [selectedBoQId, setSelectedBoQId] = useState<string | null>(null);
  const [targetBoQ, setTargetBoQ] = useState<any | null>(null);

  // BoQ Approval status and metadata states
  const [boqStatus, setBoqStatus] = useState(project?.boqStatus || "DRAFT");
  const [boqMakerName, setBoqMakerName] = useState(project?.boqMakerName || "");
  const [boqApprovedByPpic, setBoqApprovedByPpic] = useState(
    project?.boqApprovedByPpic || false,
  );
  const [boqApprovedByPm, setBoqApprovedByPm] = useState(
    project?.boqApprovedByPm || false,
  );
  const [boqRejectedReason, setBoqRejectedReason] = useState(
    project?.boqRejectedReason || null,
  );

  // Master data items
  const [masterItems, setMasterItems] = useState<any[]>([]);
  const [isLoadingMaster, setIsLoadingMaster] = useState(false);

  // Units list
  const [dbUnits, setDbUnits] = useState<any[]>([]);

  // Current project BoQ items in memory (draft)
  const [boqItems, setBoqItems] = useState<BoQItemDisplay[]>([]);
  const [boqNumberInput, setBoqNumberInput] = useState("");

  // Saved BoQ states (from database)
  const [savedBoQItems, setSavedBoQItems] = useState<BoQItemDisplay[]>([]);
  const [savedBoQNumber, setSavedBoQNumber] = useState("");

  // Search popover state
  const [openPopover, setOpenPopover] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Input states for new item
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [inputQty, setInputQty] = useState("");
  const [inputUnit, setInputUnit] = useState("pcs");
  const [inputPrice, setInputPrice] = useState("");
  const [inputNote, setInputNote] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Accordion state under history tab (kept for compatibility, though tab is updated)
  const [isBoqOpen, setIsBoqOpen] = useState(false);

  // PDF Preview State
  const [isPreviewPdfOpen, setIsPreviewPdfOpen] = useState(false);

  // Detail Dialog State
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailSearch, setDetailSearch] = useState("");

  // Delete confirm state
  const [isDeleting, setIsDeleting] = useState(false);
  const isReadOnly =
    boqStatus === "PENDING_APPROVAL" || boqStatus === "APPROVED";
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Excel Template & Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [smartImportOpen, setSmartImportOpen] = useState(false);
  const [parsedExcelRows, setParsedExcelRows] = useState<SmartExcelRow[]>([]);

  const handleDownloadTemplate = () => {
    downloadBoQTemplate(masterItems);
    toast.success("Template Excel berhasil diunduh.");
  };

  const handleConfirmSmartImport = (importedItems: BoQItemDisplay[]) => {
    const existingIds = new Set(boqItems.map((it) => it.itemId));
    const newUniqueItems = importedItems.filter(
      (it) => !existingIds.has(it.itemId),
    );

    setBoqItems((prev) => [...prev, ...newUniqueItems]);
    toast.success(
      `Berhasil mengimpor ${newUniqueItems.length} barang ke daftar BoQ.`,
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const result = await parseBoQExcelFile(file, masterItems);

      if (result.rows.length === 0) {
        toast.warning(
          result.errors.length > 0
            ? result.errors.join("; ")
            : "Tidak ada data barang yang valid ditemukan di file Excel.",
        );
        return;
      }

      // Open Smart Import Dialog for user review & confirmation
      setParsedExcelRows(result.rows);
      setSmartImportOpen(true);

      if (result.errors.length > 0) {
        toast.warning(
          `Ada ${result.errors.length} baris tidak dapat dibaca dari Excel.`,
          {
            description: result.errors.slice(0, 3).join("; "),
            duration: 7000,
          },
        );
      }
    } catch (err: any) {
      toast.error(
        "Gagal mengimpor file Excel: " + (err.message || "Format file tidak valid."),
      );
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = "";
    }
  };

  const formatInputRupiah = (value: string) => {
    const numberString = value.replace(/[^0-9]/g, "");
    if (!numberString) return "";
    const number = parseInt(numberString, 10);
    return "Rp " + number.toLocaleString("id-ID");
  };

  const parseRupiahToNumber = (rupiahStr: string) => {
    const numberString = rupiahStr.replace(/[^0-9]/g, "");
    if (!numberString) return 0;
    return parseInt(numberString, 10);
  };

  const calculateTotalSavedBoq = () => {
    return savedBoQItems.reduce((acc, item) => acc + item.qty * item.price, 0);
  };

  // Load initial list and master data on mount/open
  useEffect(() => {
    if (open && project?.id) {
      setIsLoading(true);
      Promise.all([getProjectBoQs(project.id), getWarehouseItems(), getUnits()])
        .then(([list, items, allUnits]) => {
          setProjectBoQs(list);
          setMasterItems(items);
          setDbUnits(allUnits);

          // If the project already has BoQs, default to the history/list tab
          if (list.length > 0) {
            setActiveTab("history");
          } else {
            setActiveTab("create");
            setSelectedBoQId(null);
          }
        })
        .catch((err) => {
          console.error(err);
          toast.error("Gagal memuat data BoQ.");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, project?.id]);

  // Load details of selected BoQ
  useEffect(() => {
    if (!open || !project?.id) return;

    if (selectedBoQId) {
      setIsLoading(true);
      getProjectBoQ(selectedBoQId)
        .then((details) => {
          if (details) {
            setSavedBoQItems(details.items);
            setBoqStatus(details.boqStatus);
            setBoqMakerName(details.boqMakerName || "");
            setBoqApprovedByPpic(details.boqApprovedByPpic);
            setBoqApprovedByPm(details.boqApprovedByPm);
            setBoqRejectedReason(details.boqRejectedReason);
            setSavedBoQNumber(details.boqNumber || "");
          }
        })
        .catch((err) => {
          console.error(err);
          toast.error("Gagal memuat detail BoQ.");
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setSavedBoQItems([]);
      setBoqStatus("DRAFT");
      setBoqMakerName("");
      setBoqApprovedByPpic(false);
      setBoqApprovedByPm(false);
      setBoqRejectedReason(null);
      setSavedBoQNumber("");

      setBoqItems([]);
      setBoqNumberInput("");
    }
  }, [open, project?.id, selectedBoQId]);

  const fetchProjectBoQ = async () => {
    // Helper to refresh the BoQ list after creation/update/deletion
    try {
      const list = await getProjectBoQs(project.id);
      setProjectBoQs(list);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMasterItems = async () => {
    setIsLoadingMaster(true);
    try {
      const items = await getWarehouseItems();
      setMasterItems(items);
    } catch (err) {
      console.error("Gagal mengambil master data barang:", err);
    } finally {
      setIsLoadingMaster(false);
    }
  };

  const fetchUnits = async () => {
    try {
      const units = await getUnits();
      setDbUnits(units);
    } catch (err) {
      console.error("Gagal mengambil data unit:", err);
    }
  };

  const handleSelectItem = (item: any) => {
    setSelectedItem(item);
    const itemUnit = (item.unit?.name || item.unit || "pcs").toLowerCase();
    setInputUnit(itemUnit);
    setInputPrice("");
    setOpenPopover(false);
    setSearchQuery("");
  };

  const handleAddItem = () => {
    if (!selectedItem) {
      toast.error("Silakan pilih barang dari Master Data terlebih dahulu.");
      return;
    }

    const expectedUnit = (
      selectedItem.unit?.name ||
      selectedItem.unit ||
      "pcs"
    ).toLowerCase();
    if (inputUnit.toLowerCase() !== expectedUnit) {
      toast.error(
        `Satuan barang harus sesuai dengan stok master data (${expectedUnit.toUpperCase()}).`,
      );
      return;
    }

    // Allow float quantity (tetap izinkan kuantitas menggunakan koma)
    const qtyVal = parseFloat(inputQty.replace(",", "."));
    if (isNaN(qtyVal) || qtyVal <= 0) {
      toast.error("Kuantitas (Qty) harus berupa angka positif.");
      return;
    }

    const priceVal = parseRupiahToNumber(inputPrice);
    if (priceVal < 0) {
      toast.error("Harga harus berupa angka dan minimal 0.");
      return;
    }

    if (editingItemId) {
      // UPDATE mode
      const updatedList = boqItems.map((it) => {
        if (it.id === editingItemId) {
          return {
            ...it,
            itemId: selectedItem.id,
            itemCode: selectedItem.code,
            itemName: selectedItem.name,
            itemTypeMerk: selectedItem.typeMerk || undefined,
            qty: qtyVal,
            unit: inputUnit || "pcs",
            price: priceVal,
            note: inputNote,
          };
        }
        return it;
      });

      setBoqItems(updatedList);
      setEditingItemId(null);
      toast.success("Perubahan barang disimpan.");
    } else {
      // ADD mode
      // Check if item is already added to BoQ
      const isExist = boqItems.some((it) => it.itemId === selectedItem.id);
      if (isExist) {
        toast.error(
          "Barang ini sudah ditambahkan ke BoQ. Silakan edit atau hapus terlebih dahulu.",
        );
        return;
      }

      const newItem: BoQItemDisplay = {
        id: Math.random().toString(),
        itemId: selectedItem.id,
        itemCode: selectedItem.code,
        itemName: selectedItem.name,
        itemTypeMerk: selectedItem.typeMerk || undefined,
        qty: qtyVal,
        unit: inputUnit || "pcs",
        price: priceVal,
        note: inputNote,
      };

      setBoqItems([...boqItems, newItem]);
      toast.success("Barang ditambahkan ke daftar BoQ.");
    }

    // Reset inputs
    setSelectedItem(null);
    setInputQty("");
    setInputUnit("pcs");
    setInputPrice("");
    setInputNote("");
  };

  const handleEditItem = (item: BoQItemDisplay) => {
    const masterItem = masterItems.find((it) => it.id === item.itemId) || {
      id: item.itemId,
      code: item.itemCode,
      name: item.itemName,
      typeMerk: item.itemTypeMerk,
    };

    setSelectedItem(masterItem);
    setInputQty(item.qty.toString());
    setInputUnit(item.unit);
    setInputPrice(formatInputRupiah(item.price.toString()));
    setInputNote(item.note || "");

    setEditingItemId(item.id);
    toast.info("Barang dimuat kembali ke form input untuk disunting.");
  };

  const handleRemoveItem = (id: string) => {
    setBoqItems(boqItems.filter((item) => item.id !== id));
  };

  const calculateTotalBoq = () => {
    return boqItems.reduce((acc, item) => acc + item.qty * item.price, 0);
  };

  const handleSubmit = async () => {
    if (!boqNumberInput.trim()) {
      toast.error("Nomor BoQ wajib diisi!");
      return;
    }
    if (boqItems.length === 0) {
      toast.error("Daftar BoQ kosong. Silakan tambahkan minimal satu barang.");
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsPayload: BoQItemInput[] = boqItems.map((it) => ({
        itemId: it.itemId,
        qty: it.qty,
        unit: it.unit,
        price: it.price,
        note: it.note || undefined,
      }));

      const res = selectedBoQId
        ? await updateProjectBoQ(selectedBoQId, boqNumberInput, itemsPayload)
        : await createProjectBoQ(project.id, boqNumberInput, itemsPayload);

      if (res.success) {
        toast.success(
          selectedBoQId
            ? "Bill of Quantities (BoQ) berhasil diperbarui!"
            : "Bill of Quantities (BoQ) baru berhasil dibuat!",
        );

        setSelectedBoQId(null);
        await fetchProjectBoQ();

        setBoqItems([]);
        setBoqNumberInput("");

        setActiveTab("history");
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || "Gagal menyimpan BoQ.");
      }
    } catch (err: any) {
      console.error("Error saving BoQ:", err);
      toast.error(err.message || "Terjadi kesalahan saat menyimpan BoQ.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBoQ = async () => {
    if (!targetBoQ) return;
    setIsDeleting(true);
    try {
      const res = await deleteProjectBoQ(targetBoQ.id);
      if (res.success) {
        toast.success("BoQ berhasil dihapus.");
        setSelectedBoQId(null);
        await fetchProjectBoQ();
        setShowDeleteConfirm(false);
        setTargetBoQ(null);
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || "Gagal menghapus BoQ.");
      }
    } catch (err: any) {
      console.error("Error deleting BoQ:", err);
      toast.error(err.message || "Terjadi kesalahan saat menghapus BoQ.");
    } finally {
      setIsDeleting(false);
    }
  };

  const loadSavedBoqForEdit = async (boq: any) => {
    setIsLoading(true);
    try {
      const details = await getProjectBoQ(boq.id);
      if (details) {
        setSelectedBoQId(boq.id);
        setBoqNumberInput(details.boqNumber);
        setBoqItems(details.items);
        setActiveTab("create");
        toast.info("Mengedit BoQ Proyek");
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat detail BoQ.");
    } finally {
      setIsLoading(false);
    }
  };

  // Format Customer Info (Company & Name)
  const customerInfo = project?.customer?.company
    ? `${project.customer.company} (${project.customer.name})`
    : project?.customer?.name || "-";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl! max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <DialogHeader className="p-6 pb-2 shrink-0 border-b border-border/50 bg-muted/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold tracking-tight">
                      Kelola Bill of Quantities (BoQ)
                    </DialogTitle>
                    <DialogDescription className="text-xs mt-0.5 font-medium">
                      Kelola Dokumen Bill Of Quantity Proyek Ini
                    </DialogDescription>
                  </div>
                </div>

                <TabsList className="grid w-70 grid-cols-2 bg-muted/50 p-1 mr-4">
                  <TabsTrigger
                    value="create"
                    className="text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-white transition-all cursor-pointer"
                  >
                    Kelola BoQ
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-white transition-all cursor-pointer"
                  >
                    Riwayat BoQ
                  </TabsTrigger>
                </TabsList>
              </div>
            </DialogHeader>

            {isLoading ? (
              <div className="h-96 w-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs font-semibold">
                  Memuat BoQ proyek...
                </span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Project Header Info */}
                <div className="grid grid-cols-4 gap-6 bg-muted/20 border border-border/50 p-4 rounded-xl text-xs">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-semibold">
                      No. Proyek
                    </span>
                    <p className="font-bold text-foreground">
                      {project?.projectNumber || "-"}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-semibold">
                      Customer
                    </span>
                    <div className="font-bold text-foreground">
                      <p className="truncate">
                        {project?.customer?.company || "-"}
                      </p>
                      {project?.customer?.name && (
                        <p className="text-xs text-foreground font-normal truncate">
                          {project.customer.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-semibold">
                      Total BoQ Disetujui
                    </span>
                    <p className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatRupiah(
                        projectBoQs
                          .filter((b) => b.boqStatus === "APPROVED")
                          .reduce((sum, b) => sum + b.totalValue, 0),
                      )}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-semibold text-xs block mb-1">
                      Jumlah Dokumen BoQ
                    </span>
                    <p className="font-bold text-foreground">
                      {projectBoQs.length} Dokumen (
                      {
                        projectBoQs.filter((b) => b.boqStatus === "APPROVED")
                          .length
                      }{" "}
                      Disetujui)
                    </p>
                  </div>
                </div>
                {/* TAB 1: KELOLA BOQ */}
                <TabsContent
                  value="create"
                  className="space-y-6 m-0 border-0 outline-hidden"
                >
                  {isReadOnly && (
                    <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center gap-3 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-400">
                      <AlertTriangle className="w-5 h-5 text-blue-500 shrink-0" />
                      <div className="space-y-1">
                        <p className="font-bold text-blue-900 dark:text-blue-400">
                          Mode Baca Saja (Read-Only)
                        </p>
                        <p className="text-blue-700/80 dark:text-blue-400/80">
                          BoQ ini sedang dalam status{" "}
                          {boqStatus === "APPROVED"
                            ? "Disetujui"
                            : "Menunggu Approval"}{" "}
                          sehingga tidak dapat diubah kembali.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-b border-border/50 pb-2 mb-2">
                    <h3 className="text-sm font-bold text-foreground">
                      {selectedBoQId
                        ? `Mode Edit: ${boqNumberInput}`
                        : "Mode Buat BoQ Baru"}
                    </h3>
                    {selectedBoQId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedBoQId(null);
                          setBoqItems([]);
                          setBoqNumberInput("");
                          setSelectedItem(null);
                          toast.info("Beralih ke mode input BoQ baru.");
                        }}
                        className="text-xs text-primary font-bold hover:bg-primary/5 cursor-pointer h-7 rounded-lg"
                      >
                        Beralih ke Buat Baru
                      </Button>
                    )}
                  </div>

                  {/* BoQ Document Number Input */}
                  <div className="p-5 rounded-2xl border-2 border-border/40 bg-background space-y-3 shadow-xs">
                    <div className="flex flex-col gap-1.5">
                      <Label
                        htmlFor="boqNumberInput"
                        className="text-xs font-semibold text-muted-foreground"
                      >
                        Nomor BoQ *
                      </Label>
                      <Input
                        id="boqNumberInput"
                        type="text"
                        placeholder="e.g. BOQ/JLU/2026/001"
                        value={boqNumberInput}
                        onChange={(e) => setBoqNumberInput(e.target.value)}
                        disabled={isReadOnly}
                        className="h-10 bg-muted/20 border-2 border-border/60 rounded-xl text-xs font-semibold px-3 focus-visible:ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* Input Form for adding a new item */}
                  <div className="p-5 rounded-2xl border-2 border-border/40 bg-background space-y-4 shadow-xs">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                      <span className="text-xs font-bold text-muted-foreground block">
                        Input Item BoQ Baru
                      </span>

                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadTemplate}
                          className="h-8 text-[11px] font-bold gap-1.5 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/5 cursor-pointer shadow-2xs"
                          title="Unduh Template Excel Pengisian BoQ"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download Template Excel
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isImporting || isReadOnly}
                          onClick={() => fileInputRef.current?.click()}
                          className="h-8 text-[11px] font-bold gap-1.5 rounded-xl border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer shadow-2xs"
                          title="Import Barang dari File Excel"
                        >
                          {isImporting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          Import dari Excel
                        </Button>

                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept=".xlsx, .xls, .csv"
                          className="hidden"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_100px_90px_140px] gap-3 items-end">
                      {/* Master Item Search */}
                      <div className="space-y-1.5 flex flex-col min-w-0">
                        <Label className="text-[11px] font-semibold text-muted-foreground">
                          Cari Barang dari Master Data *
                        </Label>
                        <Popover
                          open={isReadOnly ? false : openPopover}
                          onOpenChange={isReadOnly ? undefined : setOpenPopover}
                        >
                          <PopoverTrigger
                            disabled={isReadOnly}
                            className={cn(
                              "h-10 w-full flex items-center justify-between bg-muted/20 border-2 border-border/60 text-left rounded-xl px-3 hover:bg-muted/30 outline-hidden cursor-pointer min-w-0 overflow-hidden",
                              isReadOnly && "pointer-events-none opacity-50",
                            )}
                          >
                            <span className="truncate text-xs font-semibold text-foreground min-w-0 block">
                              {selectedItem
                                ? `[${selectedItem.code}] ${selectedItem.name} (${selectedItem.unit?.name || selectedItem.unit || "pcs"})`
                                : "Cari berdasarkan nama atau kode..."}
                            </span>
                            <ChevronDown className="h-4 w-4 shrink-0 opacity-50 text-muted-foreground ml-1" />
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-112.5 p-0 rounded-xl border border-border shadow-xl bg-background"
                            align="start"
                          >
                            <Command>
                              <CommandInput
                                placeholder="Ketik nama atau kode barang..."
                                onValueChange={setSearchQuery}
                              />
                              <CommandList className="max-h-55 overflow-y-auto">
                                <CommandEmpty className="p-3 text-center text-xs text-muted-foreground">
                                  {isLoadingMaster
                                    ? "Memuat barang..."
                                    : "Barang tidak ditemukan."}
                                </CommandEmpty>
                                <CommandGroup heading="Master Data Items">
                                  {masterItems
                                    .filter((item) => {
                                      if (!searchQuery) return true;
                                      const q = searchQuery.toLowerCase();
                                      return (
                                        item.name?.toLowerCase().includes(q) ||
                                        item.code?.toLowerCase().includes(q) ||
                                        item.typeMerk
                                          ?.toLowerCase()
                                          .includes(q) ||
                                        (item.unit?.name || item.unit || "")
                                          .toLowerCase()
                                          .includes(q)
                                      );
                                    })
                                    .slice(0, 50)
                                    .map((item) => (
                                      <CommandItem
                                        key={item.id}
                                        value={`${item.code}_${item.name}`}
                                        onSelect={() => handleSelectItem(item)}
                                        className="text-xs font-medium cursor-pointer hover:bg-primary/5 p-2.5 rounded-lg border-b border-border/20 last:border-0"
                                      >
                                        <div className="flex flex-col gap-1 w-full">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold text-foreground">
                                              {item.name}
                                            </span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 text-primary shrink-0">
                                              Satuan:{" "}
                                              {item.unit?.name ||
                                                item.unit ||
                                                "pcs"}
                                            </span>
                                          </div>
                                          <span className="text-[10px] text-muted-foreground">
                                            Kode: {item.code}
                                            {item.typeMerk
                                              ? ` • Tipe: ${item.typeMerk}`
                                              : ""}
                                          </span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Qty Input (Decimal) */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold text-muted-foreground">
                          Kuantitas (Qty) *
                        </Label>
                        <Input
                          type="text"
                          placeholder="0.0"
                          value={inputQty}
                          onChange={(e) => setInputQty(e.target.value)}
                          disabled={isReadOnly}
                          className="h-10 bg-muted/20 border-2 border-border/60 rounded-xl text-xs font-semibold px-3 focus-visible:ring-primary/20"
                        />
                      </div>

                      {/* Unit Dropdown (Locked to Selected Item's Master Stock Unit) */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                          <span>Satuan *</span>
                        </Label>
                        <select
                          value={inputUnit}
                          onChange={(e) => setInputUnit(e.target.value)}
                          disabled={isReadOnly || !!selectedItem}
                          className={cn(
                            "h-10 w-full flex items-center bg-muted/20 border-2 border-border/60 rounded-xl text-xs font-bold px-2.5 cursor-pointer outline-hidden focus-visible:border-primary/50 uppercase",
                            (isReadOnly || !!selectedItem) &&
                              "pointer-events-none opacity-80 bg-muted/40 text-foreground cursor-not-allowed",
                          )}
                        >
                          {dbUnits.length > 0 ? (
                            dbUnits.map((u) => (
                              <option
                                key={u.id}
                                value={u.name.toLowerCase()}
                                className="text-foreground bg-background"
                              >
                                {u.name.toLowerCase()}
                              </option>
                            ))
                          ) : (
                            <>
                              <option
                                value="pcs"
                                className="text-foreground bg-background"
                              >
                                pcs
                              </option>
                              <option
                                value="mtr"
                                className="text-foreground bg-background"
                              >
                                mtr
                              </option>
                              <option
                                value="kg"
                                className="text-foreground bg-background"
                              >
                                kg
                              </option>
                              <option
                                value="set"
                                className="text-foreground bg-background"
                              >
                                set
                              </option>
                              <option
                                value="lsn"
                                className="text-foreground bg-background"
                              >
                                lsn
                              </option>
                              <option
                                value="sak"
                                className="text-foreground bg-background"
                              >
                                sak
                              </option>
                            </>
                          )}
                        </select>
                      </div>

                      {/* Price Input (with direct Rupiah formatting) */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-500" />{" "}
                          Harga Satuan *
                        </Label>
                        <Input
                          type="text"
                          placeholder="Rp 0"
                          value={inputPrice}
                          onChange={(e) =>
                            setInputPrice(formatInputRupiah(e.target.value))
                          }
                          disabled={isReadOnly}
                          className="h-10 bg-muted/20 border-2 border-border/60 rounded-xl text-xs font-semibold px-3 focus-visible:ring-primary/20"
                        />
                      </div>
                    </div>

                    {/* Note, Rupiah Subtext, and Add Button */}
                    <div className="flex flex-col sm:flex-row gap-3 items-end justify-between pt-2">
                      <div className="space-y-1 flex-1 min-w-0 w-full">
                        <Label className="text-[11px] font-semibold text-muted-foreground">
                          Catatan (Opsional)
                        </Label>
                        <Textarea
                          placeholder="e.g. untuk kebutuhan frame utama, toleransi 1mm"
                          value={inputNote}
                          onChange={(e) => setInputNote(e.target.value)}
                          disabled={isReadOnly}
                          rows={2}
                          className="min-h-12 bg-muted/20 border-2 border-border/60 rounded-xl text-xs font-medium px-3 py-2 focus-visible:ring-primary/20 resize-none w-full"
                        />
                        {(() => {
                          const parsedQty = parseFloat(
                            inputQty.replace(",", "."),
                          );
                          const parsedPrice = parseRupiahToNumber(inputPrice);
                          if (
                            !isNaN(parsedQty) &&
                            parsedQty > 0 &&
                            parsedPrice > 0
                          ) {
                            return (
                              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 pl-1">
                                Preview: {inputQty} {inputUnit} x {inputPrice} ={" "}
                                {formatRupiah(parsedQty * parsedPrice)}
                              </p>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 pb-0.5">
                        {editingItemId && (
                          <Button
                            variant="outline"
                            type="button"
                            onClick={() => {
                              setSelectedItem(null);
                              setInputQty("");
                              setInputUnit("pcs");
                              setInputPrice("");
                              setInputNote("");
                              setEditingItemId(null);
                              toast.info("Penyuntingan dibatalkan.");
                            }}
                            disabled={isReadOnly}
                            className="h-10 px-4 rounded-xl cursor-pointer text-xs font-semibold"
                          >
                            Batal
                          </Button>
                        )}
                        <Button
                          onClick={handleAddItem}
                          type="button"
                          disabled={isReadOnly}
                          className={cn(
                            "h-10 px-5 rounded-xl cursor-pointer font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm",
                            editingItemId
                              ? "bg-amber-600 hover:bg-amber-700 text-white"
                              : "",
                            isReadOnly && "pointer-events-none opacity-50",
                          )}
                        >
                          <Plus className="w-4 h-4" />
                          {editingItemId
                            ? "Simpan Perubahan"
                            : "Tambah ke List"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* List Table of Items */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-muted-foreground block px-1">
                      Daftar Barang BoQ ({boqItems.length} Item)
                    </span>

                    <div className="border border-border rounded-xl overflow-x-auto shadow-xs bg-card">
                      <div className="max-h-62.5 overflow-y-auto min-w-140">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-muted/40 border-b border-border/50 font-bold text-muted-foreground select-none">
                              <th className="p-3 w-12 text-center font-bold">
                                No
                              </th>
                              <th className="p-3 w-28 font-bold">
                                Kode Barang
                              </th>
                              <th className="p-3 font-bold">Nama Barang</th>
                              <th className="p-3 w-24 text-center font-bold">
                                Qty
                              </th>
                              <th className="p-3 w-32 text-right font-bold">
                                Harga Satuan
                              </th>
                              <th className="p-3 w-32 text-right font-bold">
                                Subtotal
                              </th>
                              <th className="p-3 w-16 text-center font-bold">
                                Aksi
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {boqItems.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="p-10 text-center text-muted-foreground opacity-50 font-medium"
                                >
                                  Belum ada barang dalam list BoQ. Silakan
                                  tambah barang di atas.
                                </td>
                              </tr>
                            ) : (
                              boqItems.map((item, idx) => (
                                <tr
                                  key={item.id}
                                  className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                                >
                                  <td className="p-3 text-center text-muted-foreground font-mono">
                                    {idx + 1}
                                  </td>
                                  <td className="p-3 font-semibold text-primary">
                                    {item.itemCode}
                                  </td>
                                  <td className="p-3">
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                      <span
                                        className="font-bold text-foreground leading-tight"
                                        title={item.itemName}
                                      >
                                        {item.itemName}
                                      </span>
                                      {item.itemTypeMerk && (
                                        <span className="text-[11px] font-medium text-muted-foreground leading-tight">
                                          {item.itemTypeMerk}
                                        </span>
                                      )}
                                      {item.note && (
                                        <span
                                          className="text-[10px] text-muted-foreground/80 font-medium italic truncate block mt-0.5"
                                          title={item.note}
                                        >
                                          Catatan: {item.note}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3 text-center font-bold text-foreground whitespace-nowrap">
                                    {item.qty}{" "}
                                    <span className="text-xs font-semibold text-muted-foreground lowercase">
                                      {item.unit}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                    {formatRupiah(item.price)}
                                  </td>
                                  <td className="p-3 text-right font-extrabold text-foreground whitespace-nowrap">
                                    {formatRupiah(item.qty * item.price)}
                                  </td>
                                  <td className="p-3 text-center">
                                    {editingItemId === item.id ? (
                                      <span className="inline-flex items-center text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-200 animate-pulse">
                                        Edit
                                      </span>
                                    ) : (
                                      <div className="flex items-center justify-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/5 cursor-pointer rounded-lg"
                                          onClick={() => handleEditItem(item)}
                                          title="Ubah Item"
                                          disabled={
                                            !!editingItemId || isReadOnly
                                          }
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 cursor-pointer rounded-lg"
                                          onClick={() =>
                                            handleRemoveItem(item.id)
                                          }
                                          title="Hapus Item"
                                          disabled={
                                            !!editingItemId || isReadOnly
                                          }
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </TabsContent>{" "}
                {/* TAB 2: RIWAYAT BOQ (FLAT CARD VIEW) */}
                <TabsContent
                  value="history"
                  className="space-y-4 m-0 border-0 outline-hidden"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-bold text-muted-foreground">
                      Daftar Dokumen BoQ Proyek
                    </h4>
                    {(isEngineering ||
                      roles.includes("Superadmin") ||
                      roles.includes("Admin")) && (
                      <Button
                        size="sm"
                        className="h-8 text-xs font-bold px-3 gap-1.5 cursor-pointer bg-primary hover:bg-primary/90 text-white shadow-xs rounded-lg"
                        onClick={() => {
                          setSelectedBoQId(null);
                          setBoqItems([]);
                          setBoqNumberInput("");
                          setSelectedItem(null);
                          setActiveTab("create");
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" /> Buat BoQ Baru
                      </Button>
                    )}
                  </div>

                  {projectBoQs.length > 0 ? (
                    <div className="space-y-3">
                      {projectBoQs.map((boq) => {
                        const isBoqReadOnly =
                          boq.boqStatus === "PENDING_APPROVAL" ||
                          boq.boqStatus === "APPROVED";
                        return (
                          <div
                            key={boq.id}
                            className="border border-border rounded-xl bg-card overflow-hidden shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="p-3 bg-primary/10 rounded-xl text-primary shrink-0">
                                <FileText className="w-6 h-6" />
                              </div>
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-sm text-foreground truncate">
                                    {boq.boqNumber || "Dokumen BoQ"}
                                  </h4>
                                  <span
                                    className={cn(
                                      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                                      boq.boqStatus === "APPROVED" &&
                                        "bg-emerald-100 text-emerald-800",
                                      boq.boqStatus === "PENDING_APPROVAL" &&
                                        "bg-amber-100 text-amber-800",
                                      boq.boqStatus === "REJECTED" &&
                                        "bg-rose-100 text-rose-800",
                                      boq.boqStatus === "DRAFT" &&
                                        "bg-zinc-100 text-zinc-800",
                                    )}
                                  >
                                    {boq.boqStatus === "APPROVED" &&
                                      "Disetujui"}
                                    {boq.boqStatus === "PENDING_APPROVAL" &&
                                      "Menunggu Approval"}
                                    {boq.boqStatus === "REJECTED" && "Ditolak"}
                                    {boq.boqStatus === "DRAFT" && "Draft"}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <span>
                                      Total:{" "}
                                      <strong>{boq.itemsCount} Item</strong>
                                    </span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                                    <span>
                                      Nilai:{" "}
                                      <strong className="text-emerald-600 dark:text-emerald-400">
                                        {formatRupiah(boq.totalValue)}
                                      </strong>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
                              {(isEngineering ||
                                roles.includes("Superadmin") ||
                                roles.includes("Admin")) &&
                                (boq.boqStatus === "DRAFT" ||
                                  boq.boqStatus === "REJECTED") && (
                                  <Button
                                    size="sm"
                                    className="h-8 text-xs font-bold px-3 gap-1 cursor-pointer bg-orange-600 hover:bg-orange-700 text-white shadow-xs rounded-lg shrink-0"
                                    onClick={() => {
                                      setTargetBoQ(boq);
                                      setShowSubmitConfirm(true);
                                    }}
                                  >
                                    <Send className="w-3.5 h-3.5" /> Ajukan
                                    Approval
                                  </Button>
                                )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-semibold px-2.5 gap-1 cursor-pointer border border-border/80 hover:bg-muted rounded-lg shrink-0"
                                onClick={async () => {
                                  setSelectedBoQId(boq.id);
                                  const details = await getProjectBoQ(boq.id);
                                  if (details) {
                                    setSavedBoQItems(details.items);
                                    setSavedBoQNumber(details.boqNumber);
                                    setDetailSearch("");
                                    setIsDetailOpen(true);
                                  }
                                }}
                              >
                                <Search className="w-3.5 h-3.5" /> Detail
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-semibold px-2.5 gap-1 cursor-pointer border border-border/80 hover:bg-primary/5 hover:text-primary hover:border-primary/20 rounded-lg shrink-0"
                                onClick={() => loadSavedBoqForEdit(boq)}
                                disabled={isBoqReadOnly}
                              >
                                <Pencil className="w-3.5 h-3.5" /> Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-semibold px-2.5 gap-1 cursor-pointer border border-border/80 hover:bg-orange-500/5 hover:text-orange-600 hover:border-orange-500/20 rounded-lg shrink-0"
                                onClick={async () => {
                                  setSelectedBoQId(boq.id);
                                  const details = await getProjectBoQ(boq.id);
                                  if (details) {
                                    setSavedBoQItems(details.items);
                                    setSavedBoQNumber(details.boqNumber);
                                    setBoqStatus(details.boqStatus);
                                    setBoqMakerName(details.boqMakerName || "");
                                    setBoqApprovedByPpic(
                                      details.boqApprovedByPpic,
                                    );
                                    setBoqApprovedByPm(details.boqApprovedByPm);
                                    setIsPreviewPdfOpen(true);
                                  }
                                }}
                              >
                                <Printer className="w-3.5 h-3.5" /> Cetak PDF
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-semibold px-2.5 gap-1 cursor-pointer border border-border/80 hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-300 rounded-lg shrink-0"
                                onClick={() => {
                                  setTargetBoQ(boq);
                                  setShowDeleteConfirm(true);
                                }}
                                disabled={isBoqReadOnly}
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Hapus
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-62.5 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground gap-3">
                      <FileText className="w-12 h-12 opacity-20" />
                      <p className="text-xs font-bold">
                        Belum ada riwayat BoQ untuk project ini.
                      </p>
                    </div>
                  )}
                </TabsContent>
              </div>
            )}

            {/* Dialog Footer (rendered dynamically depending on tab) */}
            {activeTab === "create" && !isLoading && (
              <DialogFooter className="p-6 shrink-0 border-t border-border/50 bg-muted/10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                  Total Nilai:{" "}
                  <strong className="text-primary font-bold text-sm">
                    {formatRupiah(calculateTotalBoq())}
                  </strong>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isSubmitting}
                    className="rounded-xl h-10 px-5 cursor-pointer font-bold text-xs"
                  >
                    Batal
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || isLoading || isReadOnly}
                    className="rounded-xl h-10 px-5 cursor-pointer font-bold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    {isSubmitting && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    Simpan BoQ
                  </Button>
                </div>
              </DialogFooter>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>{" "}
      {/* PDF Preview Dialog */}
      <Dialog
        open={isPreviewPdfOpen}
        onOpenChange={(open) => !open && setIsPreviewPdfOpen(false)}
      >
        <DialogContent className="max-w-4xl! h-[90vh] flex flex-col p-6 rounded-2xl bg-zinc-950 border border-zinc-800 text-white">
          <DialogHeader className="flex-none">
            <DialogTitle className="text-base font-bold text-white">
              Pratinjau Cetak BoQ
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Pratinjau dokumen PDF Bill of Quantities ({savedBoQNumber || "-"}
              ).
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 w-full overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 mt-4 relative">
            {isPreviewPdfOpen && (
              <PDFViewer
                width="100%"
                height="100%"
                showToolbar={true}
                className="border-0"
              >
                <BoQPDFDocument
                  project={{
                    ...project,
                    boqNumber: savedBoQNumber,
                    boqStatus,
                    boqMakerName,
                    boqApprovedByPpic,
                    boqApprovedByPpicAt: project?.boqApprovedByPpicAt,
                    boqApprovedByPm,
                    boqApprovedByPmAt: project?.boqApprovedByPmAt,
                    createdAt: project?.createdAt,
                  }}
                  items={savedBoQItems}
                />
              </PDFViewer>
            )}
          </div>
          <DialogFooter className="mt-4 flex-none">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewPdfOpen(false)}
              className="cursor-pointer font-semibold rounded-lg bg-transparent text-white border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* BoQ  Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-225! max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 pb-4 shrink-0 border-b border-border/50">
            <DialogTitle className="text-base font-bold flex items-center gap-1.5">
              <FileText className="w-5 h-5 text-primary" />
              Detail Bill of Quantities (BoQ)
            </DialogTitle>
            <DialogDescription className="text-xs space-y-1 mt-1 block">
              <span className="block">
                Proyek:{" "}
                <strong className="text-foreground">
                  {project?.projectName}
                </strong>
              </span>
              <span className="block">
                Nomor BoQ:{" "}
                <strong className="text-primary font-semibold">
                  {savedBoQNumber || "-"}
                </strong>
              </span>
            </DialogDescription>
          </DialogHeader>

          {/* Search bar & info */}
          <div className="px-6 py-4 shrink-0 bg-muted/10 border-b border-border/30 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau kode barang..."
                value={detailSearch}
                onChange={(e) => setDetailSearch(e.target.value)}
                className="pl-9 pr-9 h-9 text-xs rounded-xl bg-background border-border"
              />
              {detailSearch && (
                <button
                  type="button"
                  onClick={() => setDetailSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-muted-foreground/60 hover:text-foreground cursor-pointer rounded-full hover:bg-muted/80 active:scale-95 transition-all"
                  title="Bersihkan pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground font-medium shrink-0">
              Total Nilai:{" "}
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                {formatRupiah(
                  savedBoQItems.reduce(
                    (acc, item) => acc + item.qty * item.price,
                    0,
                  ),
                )}
              </strong>
            </div>
          </div>

          {/* Detail List Table */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="border border-border rounded-xl overflow-x-auto shadow-xs bg-card">
              <table className="w-full text-left border-collapse text-[11px] min-w-130">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/50 font-bold text-muted-foreground select-none">
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3 w-28">Kode Barang</th>
                    <th className="p-3">Nama Barang</th>
                    <th className="p-3 w-22 text-center">Qty</th>
                    <th className="p-3 w-30 text-right">Harga Satuan</th>
                    <th className="p-3 w-30 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = savedBoQItems.filter((item) => {
                      const q = detailSearch.toLowerCase();
                      return (
                        item.itemName.toLowerCase().includes(q) ||
                        item.itemCode.toLowerCase().includes(q) ||
                        (item.itemTypeMerk &&
                          item.itemTypeMerk.toLowerCase().includes(q))
                      );
                    });

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

                    return filtered.map((item, idx) => (
                      <tr
                        key={item.id}
                        className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                      >
                        <td className="p-3 text-center text-foreground">
                          {idx + 1}
                        </td>
                        <td className="p-3 font-semibold text-primary">
                          {item.itemCode}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span
                              className="font-bold text-foreground leading-tight"
                              title={item.itemName}
                            >
                              {item.itemName}
                            </span>
                            {item.itemTypeMerk && (
                              <span className="text-[11px] font-medium text-muted-foreground leading-tight">
                                {item.itemTypeMerk}
                              </span>
                            )}
                            {item.note && (
                              <span
                                className="text-[10px] text-muted-foreground/80 font-medium italic truncate block mt-0.5"
                                title={item.note}
                              >
                                Catatan: {item.note}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center font-bold text-foreground whitespace-nowrap">
                          {item.qty}{" "}
                          <span className="text-xs font-semibold text-muted-foreground lowercase">
                            {item.unit}
                          </span>
                        </td>
                        <td className="p-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">
                          {formatRupiah(item.price)}
                        </td>
                        <td className="p-3 text-right font-extrabold whitespace-nowrap">
                          {formatRupiah(item.qty * item.price)}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="p-6 shrink-0 border-t border-border/50 bg-muted/10">
            <Button
              onClick={() => setIsDetailOpen(false)}
              className="rounded-xl h-10 px-5 cursor-pointer font-bold text-xs"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete BoQ Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader className="space-y-2">
            <DialogTitle className="flex items-center gap-2 text-rose-600 font-bold">
              <AlertTriangle className="w-5 h-5" />
              Hapus BoQ Proyek?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Apakah Anda yakin ingin menghapus data Bill of Quantities (BoQ)
              untuk proyek{" "}
              <strong className="text-foreground">
                {project?.projectName}
              </strong>
              ? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
              className="text-xs font-semibold h-9 rounded-lg"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteBoQ}
              disabled={isDeleting}
              className="text-xs font-bold h-9 rounded-lg flex items-center gap-1.5"
            >
              {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Hapus BoQ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Submit Approval Confirmation Dialog */}
      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent className="sm:max-w-105 rounded-2xl border border-border shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <Send className="w-5 h-5 text-amber-600" />
              Ajukan Approval BoQ
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Apakah Anda yakin ingin mengajukan BoQ proyek ini untuk
              mendapatkan persetujuan PPIC dan PM? Setelah diajukan, BoQ akan
              dikunci dalam mode baca saja (read-only) dan tidak dapat diubah
              sampai proses approval selesai.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 mt-4">
            <Button
              variant="outline"
              disabled={isSubmittingApproval}
              onClick={() => setShowSubmitConfirm(false)}
              className="text-xs font-semibold h-9 rounded-lg"
            >
              Batal
            </Button>
            <Button
              disabled={isSubmittingApproval}
              onClick={async () => {
                setIsSubmittingApproval(true);
                const toastId = toast.loading(
                  "Mengajukan BoQ untuk approval...",
                );
                try {
                  const makerName = session?.user?.name || "Engineering";
                  const res = await submitBoQForApproval(
                    targetBoQ?.id || selectedBoQId || "",
                    makerName,
                  );
                  if (res.success) {
                    toast.success("BoQ berhasil diajukan untuk persetujuan!", {
                      id: toastId,
                    });
                    await fetchProjectBoQ();
                    setShowSubmitConfirm(false);
                    setTargetBoQ(null);
                  } else {
                    toast.error(res.error || "Gagal mengajukan BoQ.", {
                      id: toastId,
                    });
                  }
                } catch (err) {
                  console.error(err);
                  toast.error("Terjadi kesalahan.", { id: toastId });
                } finally {
                  setIsSubmittingApproval(false);
                }
              }}
              className="text-xs font-bold h-9 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1.5"
            >
              {isSubmittingApproval && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              Ya, Ajukan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Smart Excel Import Resolution Dialog */}
      <BoQSmartImportDialog
        open={smartImportOpen}
        onOpenChange={setSmartImportOpen}
        parsedRows={parsedExcelRows}
        masterItems={masterItems}
        dbUnits={dbUnits}
        onConfirmImport={handleConfirmSmartImport}
      />
    </>
  );
}
