"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  UploadCloud,
  Link as LinkIcon,
  Download,
  History,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Globe,
  Copy,
  Check,
  Eye,
  Loader2,
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
  Filter,
  ClipboardList,
  DraftingCompass,
  Cog,
  Boxes,
  FileSpreadsheet,
  FileSignature,
  Calculator,
  TrendingUp,
  Factory,
  ShieldCheck,
  Paperclip,
  Scale,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BoQPDFDocument } from "@/components/trackers/boq-pdf-document";
import { SPBPDFDocument } from "@/components/trackers/spb-pdf-document";
import { SPJPDFDocument } from "@/components/trackers/spj-pdf-document";

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
import {
  createDocumentUploadUrl,
  saveDocumentRecord,
  getDocumentsByOwner,
  getDocumentDownloadUrl,
} from "@/app/actions/documents";
import { updateGlobalDriveLink } from "@/app/actions/drive-link";
import { formatJakartaDate } from "@/lib/date-utils";

// Kategori Dokumen Sistem
export const DOCUMENT_CATEGORIES = [
  {
    id: "BRIEF",
    label: "Brief",
    icon: ClipboardList,
    desc: "Dokumen brief, TOR, dan spesifikasi awal",
  },
  {
    id: "DRAWING",
    label: "Drawing",
    icon: DraftingCompass,
    desc: "Gambar teknik 2D/3D & layout kerja",
  },
  {
    id: "MECH_PART_LIST",
    label: "Mechanical Part List",
    icon: Cog,
    desc: "Daftar komponen mekanik & part list",
  },
  {
    id: "ASSEMBLY_LIST",
    label: "Assembly List",
    icon: Boxes,
    desc: "Urutan dan instruksi perakitan unit",
  },
  {
    id: "BOQ",
    label: "BoQ",
    icon: FileSpreadsheet,
    desc: "Bill of Quantities & daftar kebutuhan material proyek",
  },
  {
    id: "SPB",
    label: "SPB / SPJ",
    icon: FileSignature,
    desc: "Surat Permintaan Barang (SPB) & Surat Pertanggungjawaban (SPJ)",
  },
  {
    id: "RAB",
    label: "RAB",
    icon: Calculator,
    desc: "Rencana Anggaran Biaya proyek",
  },
  { id: "RAP", label: "RAP", icon: TrendingUp, desc: "Rencana Anggaran Pelaksanaan" },
  {
    id: "PRODUCTION",
    label: "Dokumen Produksi",
    icon: Factory,
    desc: "Work order, SPK, dan instruksi kerja",
  },
  {
    id: "QC",
    label: "Dokumen QC",
    icon: ShieldCheck,
    desc: "Checklist QC, ITP, dan laporan inspeksi",
  },
  {
    id: "OTHER",
    label: "Lainnya",
    icon: Paperclip,
    desc: "Lampiran & berkas pendukung lainnya",
  },
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]["id"];

const DEFAULT_CATEGORIES: DocumentCategory[] = [
  "BRIEF",
  "DRAWING",
  "MECH_PART_LIST",
  "ASSEMBLY_LIST",
  "RAB",
  "RAP",
  "OTHER",
];

interface DocumentManagerDialogProps {
  ownerId?: string;
  ownerType?: "LEAD" | "PROJECT" | "GLOBAL";
  leadId?: string | null;
  categories?: DocumentCategory[];
  defaultCategory?: string;
  globalDriveUrl?: string | null;
  onUploadSuccess?: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  projectData?: any;
  readOnly?: boolean;
}

interface DocumentRecord {
  id: string;
  leadId: string | null;
  projectId: string | null;
  category: string;
  label: string | null;
  url: string;
  fileName: string | null;
  isExternal: boolean;
  version: number;
  uploadedBy: string | null;
  notes: string | null;
  tonnage?: number | null;
  createdAt: string;
}

export function DocumentManagerDialog({
  ownerId,
  ownerType = "PROJECT",
  leadId,
  categories,
  defaultCategory,
  globalDriveUrl,
  onUploadSuccess,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  projectData,
  readOnly = false,
}: DocumentManagerDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen =
    setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  // Detail Item Dialog States (untuk BoQ & SPB/SPJ)
  const [viewingDetailType, setViewingDetailType] = useState<
    "BOQ" | "SPB" | "SPJ" | null
  >(null);
  const [viewingDetailData, setViewingDetailData] = useState<any>(null);
  const [detailSearchQuery, setDetailSearchQuery] = useState("");

  // PDF Preview States (untuk BoQ & SPB/SPJ)
  const [previewPdfType, setPreviewPdfType] = useState<
    "BOQ" | "SPB" | "SPJ" | null
  >(null);
  const [previewPdfData, setPreviewPdfData] = useState<any>(null);

  // Filter Sub-tab SPB vs SPJ
  const [spbFilterType, setSpbFilterType] = useState<"ALL" | "SPB" | "SPJ">(
    "ALL",
  );

  // Selected Category State untuk Drill-Down
  const [selectedCatId, setSelectedCatId] = useState<DocumentCategory | null>(
    defaultCategory ? (defaultCategory as DocumentCategory) : null,
  );

  // Active Tab di Level 2 ("latest" | "history")
  const [activeLevel2Tab, setActiveLevel2Tab] = useState<string>("latest");

  // Form Upload State
  const [uploadType, setUploadType] = useState<"NEW" | "REVISION">("NEW");
  const [revisionTargetLabel, setRevisionTargetLabel] = useState<string>("");
  const [documentCustomLabel, setDocumentCustomLabel] = useState<string>("");
  const [uploadMode, setUploadMode] = useState<"FILE" | "LINK">("FILE");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [documentTonnage, setDocumentTonnage] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  // History Tab Filter States
  const [historySearch, setHistorySearch] = useState("");
  const [historyDocFilter, setHistoryDocFilter] = useState("ALL");

  // Preview States
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Global Drive Link States
  const [isUpdatingDrive, setIsUpdatingDrive] = useState(false);
  const [driveUrl, setDriveUrl] = useState(globalDriveUrl || "");
  const [isEditingDrive, setIsEditingDrive] = useState(false);

  useEffect(() => {
    setDriveUrl(globalDriveUrl || "");
  }, [globalDriveUrl]);

  // Reset category view when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (defaultCategory) {
        setSelectedCatId(defaultCategory as DocumentCategory);
      } else {
        setSelectedCatId(null);
      }
      setActiveLevel2Tab("latest");
      setUploadType("NEW");
      setRevisionTargetLabel("");
      setDocumentCustomLabel("");
      setSelectedFile(null);
      setLinkInput("");
      setRevisionNotes("");
      setDocumentTonnage("");
      setHistorySearch("");
      setHistoryDocFilter("ALL");
    }
  }, [open, defaultCategory]);

  const activeCategories = categories
    ? DOCUMENT_CATEGORIES.filter((c) => categories.includes(c.id))
    : DOCUMENT_CATEGORIES.filter((c) =>
        (DEFAULT_CATEGORIES as string[]).includes(c.id),
      );

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getDocumentsByOwner(
        ownerId || "",
        ownerType === "LEAD" ? "LEAD" : "PROJECT",
        leadId || undefined,
      );
      if (result.success && result.data) {
        const filteredDocs = (
          result.data as unknown as DocumentRecord[]
        ).filter((doc) => doc.category !== "PO" && doc.category !== "OFFERING");
        setDocuments(filteredDocs);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setIsLoading(false);
    }
  }, [ownerId, ownerType, leadId]);

  useEffect(() => {
    if (open) {
      fetchDocuments();
    }
  }, [open, fetchDocuments]);

  // Kelompokkan dokumen pada kategori aktif berdasarkan label / kelompok berkas
  const currentCatDocs = useMemo(() => {
    if (!selectedCatId) return [];
    return documents
      .filter((d) => {
        if (selectedCatId === "SPB") {
          const cat = (d.category || "").toUpperCase();
          return cat === "SPB" || cat === "SPJ";
        }
        return d.category === selectedCatId;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [documents, selectedCatId]);

  // Mengambil daftar dokumen terbaru (unique per label atau nama file)
  const latestDocsGrouped = useMemo(() => {
    if (!currentCatDocs.length) return [];
    const map = new Map<string, DocumentRecord>();

    for (const doc of currentCatDocs) {
      const key = doc.label || doc.fileName || doc.id;
      const existing = map.get(key);
      if (!existing || doc.version > existing.version) {
        map.set(key, doc);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.version - a.version);
  }, [currentCatDocs]);

  // Daftar unik label dokumen yang ada untuk pilihan dropdown revisi
  const existingDocumentLabels = useMemo(() => {
    return latestDocsGrouped.map((doc) => ({
      key: doc.label || doc.fileName || doc.id,
      label: doc.label || doc.fileName || "Dokumen",
      latestVersion: doc.version,
    }));
  }, [latestDocsGrouped]);

  const getFileExtension = (fileName: string | null) => {
    if (!fileName) return "";
    return fileName.split(".").pop()?.toLowerCase() || "";
  };

  const isPreviewable = (fileName: string | null) => {
    const ext = getFileExtension(fileName);
    return ["jpg", "jpeg", "png", "pdf"].includes(ext);
  };

  const handleDownload = async (doc: DocumentRecord) => {
    setIsDownloading(doc.id);
    try {
      if (doc.isExternal) {
        window.open(doc.url, "_blank");
      } else {
        const { success, url, error } = await getDocumentDownloadUrl(doc.id);
        if (success && url) {
          window.open(url, "_blank");
        } else {
          throw new Error(error || "Gagal generate download URL");
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengunduh dokumen");
    } finally {
      setIsDownloading(null);
    }
  };

  const handleView = async (doc: DocumentRecord) => {
    if (!isPreviewable(doc.fileName)) {
      handleDownload(doc);
      return;
    }

    setPreviewDoc(doc);
    setIsPreviewLoading(true);
    try {
      if (doc.isExternal) {
        setPreviewUrl(doc.url);
      } else {
        const { success, url, error } = await getDocumentDownloadUrl(
          doc.id,
          false,
        );
        if (success && url) {
          setPreviewUrl(url);
        } else {
          throw new Error(error || "Gagal memuat URL preview");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat preview");
      setPreviewDoc(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error("Ukuran file melebihi batas maksimal 25MB.");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    e.target.value = "";
  };

  // Shortcut untuk langsung memulai revisi dokumen dari tombol card
  const handleStartRevisionForDoc = (doc: DocumentRecord) => {
    const key = doc.label || doc.fileName || doc.id;
    setUploadType("REVISION");
    setRevisionTargetLabel(key);
    setActiveLevel2Tab("latest");
  };

  const handleSaveUpload = async () => {
    if (!selectedCatId) return;
    const catObj = DOCUMENT_CATEGORIES.find((c) => c.id === selectedCatId);
    const catLabel = catObj?.label || selectedCatId;

    if (uploadMode === "FILE" && !selectedFile) {
      toast.error("Pilih file yang ingin diunggah terlebih dahulu.");
      return;
    }
    if (uploadMode === "LINK" && !linkInput.trim()) {
      toast.error("Masukkan link URL dokumen.");
      return;
    }

    if (selectedCatId === "DRAWING" && (!documentTonnage || Number(documentTonnage) <= 0)) {
      toast.error("Tonase Drawing (Ton) wajib diisi untuk dokumen Drawing.");
      return;
    }

    // Tentukan versi dan label yang sesuai
    let targetVersion = 1;
    let finalLabel = documentCustomLabel.trim();

    if (uploadType === "REVISION") {
      if (!revisionTargetLabel) {
        toast.error("Pilih dokumen induk yang ingin direvisi.");
        return;
      }
      finalLabel = revisionTargetLabel;
      const matchingDocs = currentCatDocs.filter(
        (d) => (d.label || d.fileName || d.id) === revisionTargetLabel,
      );
      if (matchingDocs.length > 0) {
        const maxVersion = Math.max(...matchingDocs.map((d) => d.version));
        targetVersion = maxVersion + 1;
      } else {
        targetVersion = 2;
      }
    } else {
      if (!finalLabel) {
        finalLabel =
          uploadMode === "FILE"
            ? selectedFile?.name || `${catLabel} Dokumen`
            : "Tautan Eksternal";
      }
      targetVersion = 1;
    }

    setIsUploading(true);
    const toastId = `upload-${selectedCatId}`;

    try {
      if (uploadMode === "FILE" && selectedFile) {
        toast.loading(`Menyiapkan upload ${catLabel}...`, { id: toastId });

        const { uploadUrl, path, success, error } =
          await createDocumentUploadUrl(
            ownerId || "",
            ownerType === "LEAD" ? "LEAD" : "PROJECT",
            selectedCatId,
            selectedFile.name,
          );

        if (!success || !uploadUrl || !path) {
          throw new Error(error || "Gagal membuat channel upload");
        }

        toast.loading(`Mengunggah berkas ke cloud...`, { id: toastId });

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: selectedFile,
          headers: { "Content-Type": selectedFile.type },
        });

        if (!uploadRes.ok) throw new Error("Gagal mengunggah file ke cloud");

        const result = await saveDocumentRecord({
          leadId: (ownerType === "LEAD"
            ? ownerId
            : leadId || undefined) as string,
          projectId: ownerType === "PROJECT" ? ownerId : undefined,
          category: selectedCatId,
          label: finalLabel,
          url: path,
          fileName: selectedFile.name,
          isExternal: false,
          version: targetVersion,
          tonnage: Number(documentTonnage) || 0,
          notes:
            revisionNotes.trim() ||
            (uploadType === "REVISION"
              ? `Revisi v${targetVersion}`
              : `Upload awal v${targetVersion}`),
        });

        if (result.success) {
          toast.success(
            `${catLabel} ${uploadType === "REVISION" ? `Revisi v${targetVersion}` : "Dokumen Baru"} berhasil disimpan!`,
            { id: toastId },
          );
          setSelectedFile(null);
          setRevisionNotes("");
          setDocumentCustomLabel("");
          setDocumentTonnage("");
          await fetchDocuments();
          onUploadSuccess?.();
        } else {
          throw new Error(result.error || "Gagal menyimpan data dokumen");
        }
      } else if (uploadMode === "LINK" && linkInput.trim()) {
        toast.loading(`Menyimpan tautan ${catLabel}...`, { id: toastId });

        let displayUrl = linkInput.trim();
        try {
          const urlObj = new URL(displayUrl);
          displayUrl = urlObj.hostname + urlObj.pathname;
        } catch {}

        const result = await saveDocumentRecord({
          leadId: (ownerType === "LEAD"
            ? ownerId
            : leadId || undefined) as string,
          projectId: ownerType === "PROJECT" ? ownerId : undefined,
          category: selectedCatId,
          label: finalLabel,
          url: linkInput.trim(),
          fileName: displayUrl,
          isExternal: true,
          version: targetVersion,
          tonnage: Number(documentTonnage) || 0,
          notes:
            revisionNotes.trim() ||
            (uploadType === "REVISION"
              ? `Revisi tautan v${targetVersion}`
              : `Tautan awal v${targetVersion}`),
        });

        if (result.success) {
          toast.success(
            `Tautan ${catLabel} ${uploadType === "REVISION" ? `Revisi v${targetVersion}` : "Dokumen Baru"} berhasil disimpan!`,
            { id: toastId },
          );
          setLinkInput("");
          setRevisionNotes("");
          setDocumentCustomLabel("");
          setDocumentTonnage("");
          await fetchDocuments();
          onUploadSuccess?.();
        } else {
          throw new Error(result.error || "Gagal menyimpan tautan dokumen");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal memproses dokumen", { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateDrive = async () => {
    setIsUpdatingDrive(true);
    try {
      const result = await updateGlobalDriveLink(
        ownerId || "",
        ownerType === "LEAD" ? "LEAD" : "PROJECT",
        driveUrl,
      );
      if (result.success) {
        toast.success("Link Google Drive berhasil diperbarui!");
        setIsEditingDrive(false);
        onUploadSuccess?.();
      } else {
        toast.error(result.error || "Gagal memperbarui link drive");
      }
    } catch (err) {
      toast.error("Gagal memperbarui link drive");
    } finally {
      setIsUpdatingDrive(false);
    }
  };

  const handleCopyDriveUrl = () => {
    const targetUrl = driveUrl || globalDriveUrl;
    if (targetUrl) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(targetUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Link Google Drive berhasil disalin!");
      } else {
        toast.success("Link Google Drive berhasil disalin!");
      }
    }
  };

  const totalDocs = documents.length;
  const currentCategoryObj = DOCUMENT_CATEGORIES.find(
    (c) => c.id === selectedCatId,
  );

  // Filter Riwayat Lengkap
  const filteredHistoryDocs = useMemo(() => {
    return currentCatDocs.filter((doc) => {
      const matchSearch =
        !historySearch.trim() ||
        (doc.fileName &&
          doc.fileName.toLowerCase().includes(historySearch.toLowerCase())) ||
        (doc.label &&
          doc.label.toLowerCase().includes(historySearch.toLowerCase())) ||
        (doc.notes &&
          doc.notes.toLowerCase().includes(historySearch.toLowerCase())) ||
        (doc.uploadedBy &&
          doc.uploadedBy.toLowerCase().includes(historySearch.toLowerCase()));

      const docGroupKey = doc.label || doc.fileName || doc.id;
      const matchDoc =
        historyDocFilter === "ALL" || docGroupKey === historyDocFilter;

      return matchSearch && matchDoc;
    });
  }, [currentCatDocs, historySearch, historyDocFilter]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger ? (
          <DialogTrigger render={trigger as React.ReactElement} />
        ) : (
          <DialogTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="gap-2 cursor-pointer rounded-xl font-semibold text-xs"
              >
                <FolderOpen className="w-4 h-4 text-primary" />
                Documents
                {totalDocs > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-5 px-1.5 text-[10px] font-bold bg-primary/10 text-primary"
                  >
                    {totalDocs}
                  </Badge>
                )}
              </Button>
            }
          />
        )}

        <DialogContent className="w-[96vw] sm:max-w-4xl max-h-[90vh] flex flex-col p-4 sm:p-6 rounded-2xl overflow-hidden border border-border/80 shadow-2xl">
          {/* LEVEL 1: HUB OVERVIEW (Card Grid) */}
          {!selectedCatId ? (
            <>
              <DialogHeader className="border-b border-border/50 pb-3.5 shrink-0">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-primary" />
                    Document Hub
                  </DialogTitle>
                  {totalDocs > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-primary/10 text-primary border-primary/20 text-xs font-bold px-2 py-0.5"
                    >
                      {totalDocs} Dokumen Terdaftar
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground pt-0.5">
                  Pusat berkas proyek. Pilih kategori dokumen di bawah untuk
                  melihat dokumen terbaru, riwayat versi, atau menambah berkas
                  baru.
                </DialogDescription>
              </DialogHeader>

              {/* Global Drive Link Baris Ringkas */}
              <div className="bg-muted/30 p-2.5 sm:p-3 rounded-xl border border-border/60 flex items-center justify-between gap-2 my-2 text-xs">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Globe className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-semibold text-foreground shrink-0">
                    Global Drive:
                  </span>
                  {isEditingDrive ? (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Input
                        value={driveUrl}
                        onChange={(e) => setDriveUrl(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="h-7 text-xs bg-background"
                      />
                      <Button
                        size="xs"
                        onClick={handleUpdateDrive}
                        disabled={isUpdatingDrive}
                        className="h-7 text-xs font-bold px-2 bg-primary text-white cursor-pointer"
                      >
                        Simpan
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setIsEditingDrive(false)}
                        className="h-7 text-xs cursor-pointer"
                      >
                        Batal
                      </Button>
                    </div>
                  ) : driveUrl ? (
                    <a
                      href={driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate font-medium flex items-center gap-1"
                    >
                      {driveUrl}
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground italic">
                      Link Google Drive belum diatur.
                    </span>
                  )}
                </div>

                {!isEditingDrive && (
                  <div className="flex items-center gap-1 shrink-0">
                    {driveUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCopyDriveUrl}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Copy Link Drive"
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    )}
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setIsEditingDrive(true)}
                        className="h-7 text-xs text-primary font-semibold hover:bg-primary/10 cursor-pointer"
                      >
                        {driveUrl ? "Ubah" : "Atur Link"}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Grid Category Cards */}
              <div className="flex-1 overflow-y-auto min-h-0 pr-1 my-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {activeCategories.map((cat) => {
                    const isBoqCat = cat.id === "BOQ";
                    const isSpbCat = cat.id === "SPB";
                    const isSpecialViewerCat = isBoqCat || isSpbCat;

                    const catDocs = documents.filter((d) => {
                      if (cat.id === "SPB") {
                        const c = (d.category || "").toUpperCase();
                        return c === "SPB" || c === "SPJ";
                      }
                      return d.category === cat.id;
                    });

                    const uniqueLabelsCount = new Set(
                      catDocs.map((d) => d.label || d.fileName || d.id),
                    ).size;

                    const sysBoqs = projectData?.boqs || [];
                    const sysSpbs = projectData?.spb || [];
                    const sysSpjs = projectData?.spj || [];

                    let totalItemCount = uniqueLabelsCount;
                    let totalDocsCount = catDocs.length;

                    if (isBoqCat) {
                      totalItemCount = sysBoqs.length + uniqueLabelsCount;
                      totalDocsCount = sysBoqs.length + catDocs.length;
                    } else if (isSpbCat) {
                      totalItemCount =
                        sysSpbs.length + sysSpjs.length + uniqueLabelsCount;
                      totalDocsCount =
                        sysSpbs.length + sysSpjs.length + catDocs.length;
                    }

                    const hasDocs = totalDocsCount > 0;

                    return (
                      <div
                        key={cat.id}
                        onClick={() => {
                          setSelectedCatId(cat.id);
                          setActiveLevel2Tab("latest");
                        }}
                        className={cn(
                          "p-3.5 rounded-xl border transition-all cursor-pointer text-left flex flex-col justify-between group",
                          hasDocs
                            ? "bg-card hover:bg-muted/40 border-border/80 hover:border-primary/50 shadow-2xs"
                            : "bg-muted/15 hover:bg-muted/30 border-border/40 hover:border-border/80",
                        )}
                      >
                        <div>
                          {/* Top: Icon + Name + Badge Count */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                                <cat.icon className="w-4 h-4 text-primary" />
                              </div>
                              <span className="font-bold text-xs sm:text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                {cat.label}
                              </span>
                            </div>

                            {hasDocs ? (
                              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 text-[10px] font-bold px-1.5 py-0 shrink-0">
                                {isSpecialViewerCat
                                  ? `${totalItemCount} Dokumen`
                                  : `${uniqueLabelsCount} Berkas (${catDocs.length} Versi)`}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-muted-foreground/70 border-dashed text-[10px] px-1.5 py-0 shrink-0"
                              >
                                Kosong
                              </Badge>
                            )}
                          </div>

                          {/* Description / Summary */}
                          <div className="mt-2 text-[11px] leading-relaxed">
                            {isBoqCat ? (
                              <p className="text-muted-foreground line-clamp-2">
                                {hasDocs
                                  ? `Terdapat ${totalItemCount} dokumen BoQ resmi proyek yang siap dilihat.`
                                  : "Daftar Bill of Quantities (BoQ) proyek dari PPIC."}
                              </p>
                            ) : isSpbCat ? (
                              <p className="text-muted-foreground line-clamp-2">
                                {hasDocs
                                  ? `Terdapat ${totalItemCount} dokumen SPB & SPJ proyek yang siap dilihat.`
                                  : "Daftar Surat Permintaan Barang (SPB) & SPJ proyek."}
                              </p>
                            ) : hasDocs ? (
                              <p className="text-muted-foreground line-clamp-2">
                                Terdapat {uniqueLabelsCount} item dokumen aktif
                                dengan total {catDocs.length} riwayat revisi.
                              </p>
                            ) : (
                              <p className="text-muted-foreground/80 line-clamp-2">
                                {cat.desc}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Bottom Action Hint */}
                        <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] font-semibold text-muted-foreground group-hover:text-primary">
                          <span>
                            {readOnly || isSpecialViewerCat
                              ? "Lihat Dokumen"
                              : hasDocs
                              ? "Lihat & Kelola Berkas"
                              : "Tambah Dokumen"}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <DialogFooter className="pt-2 border-t border-border/40 flex justify-end shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Tutup
                </Button>
              </DialogFooter>
            </>
          ) : (
            /* LEVEL 2: FOCUSED DETAIL VIEW DENGAN 2 TAB (DOKUMEN TERBARU & UPLOAD vs RIWAYAT VERSI) */
            <>
              <DialogHeader className="border-b border-border/50 pb-3 shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCatId(null);
                        setSelectedFile(null);
                        setLinkInput("");
                        setRevisionNotes("");
                      }}
                      className="h-8 px-2 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg -ml-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Semua Dokumen</span>
                    </Button>
                    <span className="text-muted-foreground/40">/</span>
                    <div className="flex items-center gap-2 min-w-0">
                      {currentCategoryObj?.icon && (
                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                          <currentCategoryObj.icon className="w-3.5 h-3.5 text-primary" />
                        </div>
                      )}
                      <DialogTitle className="text-sm sm:text-base font-bold text-foreground truncate">
                        {currentCategoryObj?.label}
                      </DialogTitle>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              {/* 2 Tabs Navigation di Level 2 / Read-only viewer untuk BoQ, SPB/SPJ, dan readOnly mode */}
              {readOnly || selectedCatId === "BOQ" || selectedCatId === "SPB" ? (
                <div className="flex-1 overflow-y-auto min-h-0 space-y-4 py-2 pr-1">
                  {/* Banner Mode Lihat */}
                  <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        {currentCategoryObj?.icon && (
                          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                            <currentCategoryObj.icon className="w-3.5 h-3.5 text-primary" />
                          </div>
                        )}
                        <h4 className="text-xs sm:text-sm font-bold text-foreground">
                          {selectedCatId === "BOQ"
                            ? "Daftar Bill of Quantities (BoQ) Proyek"
                            : selectedCatId === "SPB"
                            ? "Daftar Surat Permintaan Barang (SPB) & SPJ Proyek"
                            : `Dokumen ${currentCategoryObj?.label}`}
                        </h4>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedCatId === "BOQ"
                          ? "Dokumen BoQ resmi diterbitkan oleh tim PPIC dan disahkan oleh Project Manager. Anda dapat melihat rincian item barang atau membuka pratinjau cetak PDF."
                          : selectedCatId === "SPB"
                          ? "Dokumen SPB (Material) dan SPJ (Barang Jadi) diajukan oleh tim Engineering. Anda dapat melihat rincian item atau membuka pratinjau cetak PDF."
                          : `Lihat dan unduh berkas resmi ${currentCategoryObj?.label} proyek.`}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-primary/5 text-primary border-primary/20 text-[10px] font-bold px-2 py-0.5 shrink-0 self-start sm:self-auto"
                    >
                      Mode Lihat Dokumen
                    </Badge>
                  </div>

                  {/* KONTEN KATEGORI BOQ */}
                  {selectedCatId === "BOQ" && (
                    <div className="space-y-3">
                      {(() => {
                        const sysBoqs = projectData?.boqs || [];
                        if (sysBoqs.length === 0 && currentCatDocs.length === 0) {
                          return (
                            <div className="p-8 rounded-xl border border-dashed border-border/80 text-center bg-muted/10 space-y-2">
                              <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                              <p className="text-xs font-semibold text-foreground">
                                Belum Ada Dokumen BoQ
                              </p>
                              <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                                Belum ada Bill of Quantities (BoQ) yang diterbitkan untuk proyek ini oleh tim PPIC.
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-2.5">
                            {sysBoqs.map((boq: any) => (
                              <div
                                key={boq.id}
                                className="p-3.5 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                              >
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-xs sm:text-sm text-foreground">
                                      {boq.boqNumber || "BoQ Proyek"}
                                    </span>
                                    <Badge
                                      className={cn(
                                        "text-[10px] font-bold px-2 py-0 border shadow-none",
                                        boq.boqStatus === "APPROVED"
                                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200"
                                          : boq.boqStatus === "PENDING"
                                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200"
                                          : "bg-muted text-muted-foreground border-border/60",
                                      )}
                                    >
                                      {boq.boqStatus || "DRAFT"}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                                    <span>
                                      Pembuat:{" "}
                                      <strong className="text-foreground font-semibold">
                                        {boq.boqMakerName || "PPIC"}
                                      </strong>
                                    </span>
                                    <span>•</span>
                                    <span>
                                      Tanggal:{" "}
                                      {boq.createdAt
                                        ? formatJakartaDate(boq.createdAt)
                                        : "-"}
                                    </span>
                                    <span>•</span>
                                    <span className="text-primary font-semibold">
                                      {(boq.boqItems || []).length} Item Barang
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setViewingDetailType("BOQ");
                                      setViewingDetailData({
                                        ...boq,
                                        projectName:
                                          projectData?.projectName || "Proyek",
                                      });
                                    }}
                                    className="h-8 px-2.5 text-xs font-semibold gap-1.5 rounded-lg border-border/80 hover:bg-primary/5 hover:text-primary cursor-pointer"
                                  >
                                    <Search className="w-3.5 h-3.5" />
                                    <span>Lihat Rincian</span>
                                  </Button>

                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setPreviewPdfType("BOQ");
                                      setPreviewPdfData({
                                        project: {
                                          ...(projectData || {}),
                                          boqNumber: boq.boqNumber,
                                          boqStatus: boq.boqStatus,
                                          boqMakerName: boq.boqMakerName,
                                          boqApprovedByPpic:
                                            boq.boqApprovedByPpic,
                                          boqApprovedByPm: boq.boqApprovedByPm,
                                          createdAt: boq.createdAt,
                                        },
                                        items: (boq.boqItems || []).map(
                                          (bi: any) => ({
                                            itemId: bi.itemId || bi.id,
                                            itemCode:
                                              bi.item?.itemCode ||
                                              bi.item?.code ||
                                              "",
                                            itemName:
                                              bi.item?.itemName ||
                                              bi.item?.name ||
                                              "",
                                            itemTypeMerk:
                                              bi.item?.typeMerk || "",
                                            qty: bi.qty || 0,
                                            unit:
                                              bi.unit ||
                                              bi.item?.unit ||
                                              "pcs",
                                            price: Number(bi.price) || 0,
                                            note: bi.note || "",
                                          }),
                                        ),
                                        boqNumber: boq.boqNumber,
                                      });
                                    }}
                                    className="h-8 px-2.5 text-xs font-semibold gap-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 cursor-pointer shadow-none"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Pratinjau PDF</span>
                                  </Button>
                                </div>
                              </div>
                            ))}

                            {/* Berkas Tambahan / Lampiran BoQ jika ada */}
                            {currentCatDocs.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-border/40 space-y-2">
                                <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                  Berkas Lampiran Tambahan ({currentCatDocs.length})
                                </h5>
                                <div className="space-y-1.5">
                                  {currentCatDocs.map((doc) => (
                                    <div
                                      key={doc.id}
                                      className="p-2.5 rounded-lg border border-border/60 bg-muted/20 flex items-center justify-between gap-2 text-xs"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                                        <span className="font-semibold text-foreground truncate">
                                          {doc.label || doc.fileName}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                          v{doc.version}
                                        </span>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => handleDownload(doc)}
                                        className="h-7 px-2 text-xs font-semibold gap-1 text-primary hover:bg-primary/10 cursor-pointer"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Unduh</span>
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* KONTEN KATEGORI SPB & SPJ */}
                  {selectedCatId === "SPB" && (
                    <div className="space-y-3">
                      {(() => {
                        const sysSpbs = projectData?.spb || [];
                        const sysSpjs = projectData?.spj || [];

                        if (
                          sysSpbs.length === 0 &&
                          sysSpjs.length === 0 &&
                          currentCatDocs.length === 0
                        ) {
                          return (
                            <div className="p-8 rounded-xl border border-dashed border-border/80 text-center bg-muted/10 space-y-2">
                              <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                              <p className="text-xs font-semibold text-foreground">
                                Belum Ada Dokumen SPB / SPJ
                              </p>
                              <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                                Belum ada Surat Permintaan Barang (SPB) atau SPJ yang diajukan untuk proyek ini.
                              </p>
                            </div>
                          );
                        }

                        const filteredSpbs =
                          spbFilterType === "SPJ" ? [] : sysSpbs;
                        const filteredSpjs =
                          spbFilterType === "SPB" ? [] : sysSpjs;

                        return (
                          <div className="space-y-3">
                            {/* Filter Sub-tab SPB vs SPJ */}
                            <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/60 w-fit">
                              <button
                                type="button"
                                onClick={() => setSpbFilterType("ALL")}
                                className={cn(
                                  "px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                                  spbFilterType === "ALL"
                                    ? "bg-background text-foreground shadow-2xs border border-border/60"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                Semua ({sysSpbs.length + sysSpjs.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setSpbFilterType("SPB")}
                                className={cn(
                                  "px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                                  spbFilterType === "SPB"
                                    ? "bg-background text-foreground shadow-2xs border border-border/60"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                SPB Material ({sysSpbs.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setSpbFilterType("SPJ")}
                                className={cn(
                                  "px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                                  spbFilterType === "SPJ"
                                    ? "bg-background text-foreground shadow-2xs border border-border/60"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                SPJ Barang Jadi ({sysSpjs.length})
                              </button>
                            </div>

                            {/* SPB Cards */}
                            {filteredSpbs.map((spb: any) => (
                              <div
                                key={spb.id}
                                className="p-3.5 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                              >
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className="bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 text-[10px] font-bold px-1.5 py-0">
                                      SPB
                                    </Badge>
                                    <span className="font-bold text-xs sm:text-sm text-foreground">
                                      {spb.spbNumber || "SPB Proyek"}
                                    </span>
                                    <Badge
                                      className={cn(
                                        "text-[10px] font-bold px-2 py-0 border shadow-none",
                                        spb.status === "APPROVED"
                                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200"
                                          : spb.status === "SUBMITTED" ||
                                              spb.status === "IN_PROGRESS"
                                          ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200"
                                          : "bg-muted text-muted-foreground border-border/60",
                                      )}
                                    >
                                      {(spb.status || "DRAFT").replace(
                                        /_/g,
                                        " ",
                                      )}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                                    <span>
                                      Pemohon:{" "}
                                      <strong className="text-foreground font-semibold">
                                        {spb.makerName || "Engineering"}
                                      </strong>
                                    </span>
                                    <span>•</span>
                                    <span>
                                      Tanggal:{" "}
                                      {spb.createdAt
                                        ? formatJakartaDate(spb.createdAt)
                                        : "-"}
                                    </span>
                                    <span>•</span>
                                    <span className="text-orange-600 font-semibold">
                                      {(spb.items || []).length} Item Material
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setViewingDetailType("SPB");
                                      setViewingDetailData({
                                        ...spb,
                                        projectName:
                                          projectData?.projectName || "Proyek",
                                      });
                                    }}
                                    className="h-8 px-2.5 text-xs font-semibold gap-1.5 rounded-lg border-border/80 hover:bg-primary/5 hover:text-primary cursor-pointer"
                                  >
                                    <Search className="w-3.5 h-3.5" />
                                    <span>Lihat Rincian</span>
                                  </Button>

                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setPreviewPdfType("SPB");
                                      setPreviewPdfData({
                                        spb: {
                                          id: spb.id,
                                          spbNumber: spb.spbNumber,
                                          date: spb.createdAt
                                            ? formatJakartaDate(spb.createdAt)
                                            : "-",
                                          deadlineDate: spb.deadlineDate,
                                          imageUrl: spb.imageUrl,
                                          items: (spb.items || []).map(
                                            (it: any) => ({
                                              name:
                                                it.material?.name ||
                                                it.itemName ||
                                                it.name ||
                                                "Material",
                                              qty: it.qty || 0,
                                              source: it.source || "GUDANG",
                                              unit:
                                                it.unit ||
                                                it.material?.unit ||
                                                "pcs",
                                              note: it.note || "",
                                              typeMerk:
                                                it.material?.typeMerk || "",
                                            }),
                                          ),
                                          makerName:
                                            spb.makerName || "Engineering",
                                          mengetahuiName: spb.mengetahuiName,
                                          menyetujuiName: spb.menyetujuiName,
                                          createdAt: spb.createdAt,
                                          approvedByPpic: spb.approvedByPpic,
                                          approvedByPpicAt:
                                            spb.approvedByPpicAt,
                                          approvedByPm: spb.approvedByPm,
                                          approvedByPmAt: spb.approvedByPmAt,
                                        },
                                        project: projectData || {},
                                        spbNumber: spb.spbNumber,
                                      });
                                    }}
                                    className="h-8 px-2.5 text-xs font-semibold gap-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 cursor-pointer shadow-none"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Pratinjau PDF</span>
                                  </Button>
                                </div>
                              </div>
                            ))}

                            {/* SPJ Cards */}
                            {filteredSpjs.map((spj: any) => (
                              <div
                                key={spj.id}
                                className="p-3.5 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                              >
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 text-[10px] font-bold px-1.5 py-0">
                                      SPJ
                                    </Badge>
                                    <span className="font-bold text-xs sm:text-sm text-foreground">
                                      {spj.spjNumber || "SPJ Proyek"}
                                    </span>
                                    <Badge
                                      className={cn(
                                        "text-[10px] font-bold px-2 py-0 border shadow-none",
                                        spj.status === "APPROVED"
                                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200"
                                          : spj.status === "SUBMITTED"
                                          ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200"
                                          : "bg-muted text-muted-foreground border-border/60",
                                      )}
                                    >
                                      {(spj.status || "DRAFT").replace(
                                        /_/g,
                                        " ",
                                      )}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                                    <span>
                                      Pembuat:{" "}
                                      <strong className="text-foreground font-semibold">
                                        {spj.makerName || "Engineering"}
                                      </strong>
                                    </span>
                                    <span>•</span>
                                    <span>
                                      Tanggal:{" "}
                                      {spj.createdAt
                                        ? formatJakartaDate(spj.createdAt)
                                        : "-"}
                                    </span>
                                    <span>•</span>
                                    <span className="text-purple-600 font-semibold">
                                      {(spj.items || []).length} Item Barang Jadi
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setViewingDetailType("SPJ");
                                      setViewingDetailData({
                                        ...spj,
                                        projectName:
                                          projectData?.projectName || "Proyek",
                                      });
                                    }}
                                    className="h-8 px-2.5 text-xs font-semibold gap-1.5 rounded-lg border-border/80 hover:bg-primary/5 hover:text-primary cursor-pointer"
                                  >
                                    <Search className="w-3.5 h-3.5" />
                                    <span>Lihat Rincian</span>
                                  </Button>

                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setPreviewPdfType("SPJ");
                                      setPreviewPdfData({
                                        spj: {
                                          id: spj.id,
                                          spjNumber: spj.spjNumber,
                                          date: spj.createdAt
                                            ? formatJakartaDate(spj.createdAt)
                                            : "-",
                                          items: (spj.items || []).map(
                                            (it: any) => ({
                                              name:
                                                it.itemName ||
                                                it.name ||
                                                "Barang Jadi",
                                              qty: it.qty || 0,
                                              unit: it.unit || "pcs",
                                              note: it.note || "",
                                            }),
                                          ),
                                          makerName:
                                            spj.makerName || "Engineering",
                                          mengetahuiName: spj.mengetahuiName,
                                          menyetujuiName: spj.menyetujuiName,
                                          createdAt: spj.createdAt,
                                          approvedByPpic: spj.approvedByPpic,
                                          approvedByPpicAt:
                                            spj.approvedByPpicAt,
                                          approvedByPm: spj.approvedByPm,
                                          approvedByPmAt: spj.approvedByPmAt,
                                        },
                                        project: projectData || {},
                                        spjNumber: spj.spjNumber,
                                      });
                                    }}
                                    className="h-8 px-2.5 text-xs font-semibold gap-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 cursor-pointer shadow-none"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Pratinjau PDF</span>
                                  </Button>
                                </div>
                              </div>
                            ))}

                            {/* Berkas Tambahan Lampiran SPB/SPJ */}
                            {currentCatDocs.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-border/40 space-y-2">
                                <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                  Berkas Lampiran Tambahan ({currentCatDocs.length})
                                </h5>
                                <div className="space-y-1.5">
                                  {currentCatDocs.map((doc) => (
                                    <div
                                      key={doc.id}
                                      className="p-2.5 rounded-lg border border-border/60 bg-muted/20 flex items-center justify-between gap-2 text-xs"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                                        <span className="font-semibold text-foreground truncate">
                                          {doc.label || doc.fileName}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                          v{doc.version}
                                        </span>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => handleDownload(doc)}
                                        className="h-7 px-2 text-xs font-semibold gap-1 text-primary hover:bg-primary/10 cursor-pointer"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Unduh</span>
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* KONTEN KATEGORI UMUM SAAT READ-ONLY (DRAWING, BRIEF, MECH PART LIST, ASSEMBLY LIST, DLL) */}
                  {selectedCatId !== "BOQ" && selectedCatId !== "SPB" && (
                    <div className="space-y-3">
                      {/* Search & Filter Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/40 p-2 sm:p-2.5 rounded-xl border border-border/60">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                          <Input
                            placeholder={`Cari berkas ${currentCategoryObj?.label || "dokumen"}...`}
                            value={historySearch}
                            onChange={(e) => setHistorySearch(e.target.value)}
                            className="h-8 pl-8 text-xs bg-background rounded-lg border-border/60 shadow-none"
                          />
                        </div>

                        {existingDocumentLabels.length > 1 && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <select
                              value={historyDocFilter}
                              onChange={(e) => setHistoryDocFilter(e.target.value)}
                              className="h-8 text-xs bg-background border border-border/60 rounded-lg px-2 text-foreground font-medium cursor-pointer"
                            >
                              <option value="ALL">
                                Semua Berkas ({currentCatDocs.length})
                              </option>
                              {existingDocumentLabels.map((item) => (
                                <option key={item.key} value={item.key}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* List Berkas Dokumen */}
                      {filteredHistoryDocs.length > 0 ? (
                        <div className="space-y-2.5">
                          {filteredHistoryDocs.map((doc, idx) => (
                            <div
                              key={doc.id}
                              className="p-3.5 sm:p-4 rounded-xl border border-border/80 bg-card shadow-2xs hover:border-border transition-all space-y-2"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                  <span className="text-xs font-bold text-muted-foreground/70 min-w-5 shrink-0 pt-0.5">
                                    {idx + 1}.
                                  </span>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-xs sm:text-sm text-foreground break-all">
                                        {doc.label || doc.fileName || "Dokumen"}
                                      </span>
                                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold px-1.5 py-0">
                                        v{doc.version}
                                      </Badge>
                                      {doc.tonnage && doc.tonnage > 0 ? (
                                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 text-[10px] font-bold px-1.5 py-0 flex items-center gap-1">
                                          <Scale className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                          <span>{doc.tonnage} Ton</span>
                                        </Badge>
                                      ) : null}
                                      {doc.isExternal && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] px-1.5 py-0"
                                        >
                                          External Link
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1 flex-wrap">
                                      <span>File: {doc.fileName || "-"}</span>
                                      <span>•</span>
                                      <span>
                                        Oleh: {doc.uploadedBy || "System"}
                                      </span>
                                      <span>•</span>
                                      <span>
                                        {formatJakartaDate(doc.createdAt, "datetime")}
                                      </span>
                                    </div>

                                    {doc.notes && (
                                      <p className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-lg mt-2 italic border border-border/40">
                                        &ldquo;{doc.notes}&rdquo;
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                  {isPreviewable(doc.fileName) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleView(doc)}
                                      className="h-8 px-2.5 text-xs font-semibold gap-1.5 rounded-lg border-border/80 hover:bg-primary/5 hover:text-primary cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Pratinjau</span>
                                    </Button>
                                  )}

                                  <Button
                                    size="sm"
                                    onClick={() => handleDownload(doc)}
                                    disabled={isDownloading === doc.id}
                                    className="h-8 px-2.5 text-xs font-semibold gap-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 cursor-pointer shadow-none"
                                  >
                                    {isDownloading === doc.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : doc.isExternal ? (
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    ) : (
                                      <Download className="w-3.5 h-3.5" />
                                    )}
                                    <span>{doc.isExternal ? "Buka Link" : "Unduh"}</span>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 rounded-xl border border-dashed border-border/80 text-center bg-muted/10 space-y-2">
                          <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                          <p className="text-xs font-semibold text-foreground">
                            {historySearch
                              ? "Tidak ada berkas yang cocok dengan pencarian."
                              : "Belum ada berkas untuk kategori ini."}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <Tabs
                  value={activeLevel2Tab}
                  onValueChange={setActiveLevel2Tab}
                  className="flex-1 flex flex-col min-h-0"
                >
                <div className="px-0.5 pt-2 shrink-0">
                  <TabsList className="grid grid-cols-2 w-full sm:w-auto h-9 bg-muted/60 p-1 rounded-xl">
                    <TabsTrigger
                      value="latest"
                      className="text-xs font-bold gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-primary" />
                      <span>Upload Dokumen</span>
                    </TabsTrigger>

                    <TabsTrigger
                      value="history"
                      className="text-xs font-semibold gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Riwayat Versi</span>
                      {currentCatDocs.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.2 rounded-full bg-muted text-foreground text-xs">
                          {currentCatDocs.length}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* TAB 1: FORM UNGGAH / TAMBAH / REVISI BERKAS */}
                <TabsContent
                  value="latest"
                  className="flex-1 overflow-y-auto min-h-0 space-y-4 py-3 pr-1 mt-0"
                >
                  <div className="p-4 sm:p-5 rounded-xl border border-border/80 bg-card space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <UploadCloud className="w-4 h-4 text-primary" />
                        <span>Unggah Berkas / Revisi Dokumen</span>
                      </Label>
                    </div>

                    {/* 1. SWITCHER TIPE UNGGAHAN: DOKUMEN BARU VS REVISI */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Tipe Tindakan
                      </Label>
                      <div className="grid grid-cols-2 gap-2 bg-muted/60 p-1 rounded-xl border border-border/60">
                        <button
                          type="button"
                          onClick={() => {
                            setUploadType("NEW");
                            setRevisionTargetLabel("");
                          }}
                          className={cn(
                            "flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer",
                            uploadType === "NEW"
                              ? "bg-background text-foreground shadow-xs border border-border/40"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Plus className="w-3.5 h-3.5 text-primary" />
                          <span>Dokumen Baru / Tambahan</span>
                        </button>

                        <button
                          type="button"
                          disabled={existingDocumentLabels.length === 0}
                          onClick={() => {
                            setUploadType("REVISION");
                            if (
                              existingDocumentLabels.length > 0 &&
                              !revisionTargetLabel
                            ) {
                              setRevisionTargetLabel(
                                existingDocumentLabels[0].key,
                              );
                            }
                          }}
                          className={cn(
                            "flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer",
                            uploadType === "REVISION"
                              ? "bg-background text-amber-700 dark:text-amber-300 shadow-xs border border-amber-200"
                              : "text-muted-foreground hover:text-foreground",
                            existingDocumentLabels.length === 0 &&
                              "opacity-50 cursor-not-allowed",
                          )}
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                          <span>Unggah Revisi Dokumen</span>
                        </button>
                      </div>
                    </div>

                    {/* Jika memilih REVISI: Tampilkan pilihan dokumen target */}
                    {uploadType === "REVISION" ? (
                      <div className="p-3 bg-amber-500/10 border border-amber-200 rounded-xl space-y-1.5 animate-in fade-in-50">
                        <Label className="text-xs font-bold text-amber-900 dark:text-amber-200">
                          Pilih Dokumen Induk yang Ingin Direvisi
                        </Label>
                        <select
                          value={revisionTargetLabel}
                          onChange={(e) =>
                            setRevisionTargetLabel(e.target.value)
                          }
                          className="w-full h-9 text-xs bg-background border border-amber-300 rounded-lg px-2.5 text-foreground font-semibold cursor-pointer"
                        >
                          {existingDocumentLabels.map((item) => (
                            <option key={item.key} value={item.key}>
                              {item.label} (Versi saat ini: v
                              {item.latestVersion} → Akan menjadi v
                              {item.latestVersion + 1})
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-amber-700 dark:text-amber-300">
                          Berkas yang diunggah akan otomatis menaikkan versi
                          berkas di atas dan menyimpan versi sebelumnya ke tab
                          Riwayat Versi.
                        </p>
                      </div>
                    ) : (
                      /* Jika Dokumen Baru: Input Judul / Label Berkas */
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-foreground">
                          Nama / Label Dokumen (Opsional)
                        </Label>
                        <Input
                          placeholder="Contoh: Layout 2D Jalur Pabrik, Skema Wiring, dll..."
                          value={documentCustomLabel}
                          onChange={(e) =>
                            setDocumentCustomLabel(e.target.value)
                          }
                          className="h-8.5 text-xs rounded-lg"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Jika dikosongkan, nama file asli akan digunakan
                          sebagai judul dokumen.
                        </p>
                      </div>
                    )}

                    {/* Jika Kategori DRAWING: Input Tonase Gambar (Ton) */}
                    {selectedCatId === "DRAWING" && (
                      <div className="space-y-1 bg-amber-500/10 p-3 rounded-xl border border-amber-300">
                        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Scale className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>Tonase Drawing (Ton) <span className="text-red-500 font-bold">* Wajib</span></span>
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="Contoh: 12.5 (wajib diisi dalam satuan Ton)"
                          value={documentTonnage}
                          onChange={(e) => setDocumentTonnage(e.target.value)}
                          className="h-8.5 text-xs rounded-lg bg-background border-amber-300 font-semibold"
                        />
                        <p className="text-[10px] text-amber-800 dark:text-amber-300">
                          Tonase gambar wajib diisi untuk kalkulasi presisi progress fase Engineering di Masterplan.
                        </p>
                      </div>
                    )}

                    {/* 2. MODE PILIHAN: FILE VS TAUTAN */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-foreground">
                          Metode Unggah
                        </Label>
                        <div className="flex items-center bg-muted p-0.5 rounded-lg border border-border/60">
                          <button
                            type="button"
                            onClick={() => setUploadMode("FILE")}
                            className={cn(
                              "px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                              uploadMode === "FILE"
                                ? "bg-background text-foreground shadow-2xs"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            Upload File
                          </button>
                          <button
                            type="button"
                            onClick={() => setUploadMode("LINK")}
                            className={cn(
                              "px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                              uploadMode === "LINK"
                                ? "bg-background text-foreground shadow-2xs"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            Paste Link URL
                          </button>
                        </div>
                      </div>

                      {uploadMode === "FILE" ? (
                        <div className="border-2 border-dashed border-border/80 rounded-xl p-4 sm:p-5 text-center hover:border-primary/40 bg-muted/10 transition-colors relative">
                          <input
                            type="file"
                            onChange={handleFileSelect}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                            disabled={isUploading}
                          />
                          <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                            <UploadCloud className="w-6 h-6 text-primary" />
                            {selectedFile ? (
                              <div className="space-y-0.5">
                                <span className="font-bold text-xs text-foreground block">
                                  {selectedFile.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  (
                                  {(selectedFile.size / 1024 / 1024).toFixed(2)}{" "}
                                  MB)
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="font-semibold text-xs text-foreground block">
                                  Klik untuk memilih berkas atau seret file ke
                                  sini
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  Maksimal 25MB (PDF, PNG, JPG, ZIP, CAD, DWG,
                                  XLSX, dll)
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="relative">
                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <Input
                              placeholder="https://drive.google.com/file/d/..."
                              value={linkInput}
                              onChange={(e) => setLinkInput(e.target.value)}
                              className="pl-8 text-xs h-9 rounded-lg"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3. INPUT CATATAN REVISI / PERUBAHAN */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-foreground">
                        Catatan Perubahan / Keterangan (Opsional)
                      </Label>
                      <Input
                        placeholder="Contoh: Perubahan dimensi diameter pulley 300mm sesuai request QC..."
                        value={revisionNotes}
                        onChange={(e) => setRevisionNotes(e.target.value)}
                        className="text-xs h-8.5 rounded-lg"
                      />
                    </div>

                    {/* 4. TOMBOL SIMPAN */}
                    <div className="pt-2 flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleSaveUpload}
                        disabled={
                          isUploading ||
                          (uploadMode === "FILE" && !selectedFile) ||
                          (uploadMode === "LINK" && !linkInput.trim()) ||
                          (uploadType === "REVISION" && !revisionTargetLabel)
                        }
                        className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 cursor-pointer shadow-md shadow-primary/20"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Menyimpan Dokumen...</span>
                          </>
                        ) : (
                          <>
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>
                              {uploadType === "REVISION"
                                ? "Simpan Dokumen Revisi"
                                : "Simpan Dokumen Baru"}
                            </span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 2: RIWAYAT VERSI LENGKAP (TAMPILAN CARD INDEKS DOKUMEN) */}
                <TabsContent
                  value="history"
                  className="flex-1 overflow-y-auto min-h-0 space-y-3 py-3 pr-1 mt-0"
                >
                  {/* Filter & Search Bar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-muted/30 p-2.5 rounded-xl border border-border/60">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Cari nama file, catatan, atau uploader..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        className="h-8 pl-8 text-xs bg-background rounded-lg"
                      />
                    </div>

                    {existingDocumentLabels.length > 1 && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <select
                          value={historyDocFilter}
                          onChange={(e) => setHistoryDocFilter(e.target.value)}
                          className="h-8 text-xs bg-background border border-border rounded-lg px-2 text-foreground font-medium cursor-pointer"
                        >
                          <option value="ALL">
                            Semua Berkas ({currentCatDocs.length})
                          </option>
                          {existingDocumentLabels.map((item) => (
                            <option key={item.key} value={item.key}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* List Riwayat Versi dalam Bentuk Card Elegan dengan Nomor Indeks */}
                  {filteredHistoryDocs.length > 0 ? (
                    <div className="space-y-2.5">
                      {filteredHistoryDocs.map((doc, idx) => (
                        <div
                          key={doc.id}
                          className="p-3.5 sm:p-4 rounded-xl border border-border/80 bg-card shadow-2xs hover:border-border transition-all space-y-2"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              {/* Nomor Indeks Simpel */}
                              <span className="text-xs font-bold text-muted-foreground/70 min-w-5 shrink-0 pt-0.5">
                                {idx + 1}.
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs sm:text-sm text-foreground break-all">
                                    {doc.label || doc.fileName || "Dokumen"}
                                  </span>
                                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold px-1.5 py-0">
                                    v{doc.version}
                                  </Badge>
                                  {doc.tonnage && doc.tonnage > 0 ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 text-[10px] font-bold px-1.5 py-0 flex items-center gap-1">
                                      <Scale className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                      <span>{doc.tonnage} Ton</span>
                                    </Badge>
                                  ) : null}
                                  {doc.isExternal && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0"
                                    >
                                      External Link
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1 flex-wrap">
                                  <span>File: {doc.fileName || "-"}</span>
                                  <span>•</span>
                                  <span>
                                    Diupdate:{" "}
                                    {formatJakartaDate(
                                      doc.createdAt,
                                      "datetime",
                                    )}
                                  </span>
                                  {doc.uploadedBy && (
                                    <>
                                      <span>•</span>
                                      <span>Oleh: {doc.uploadedBy}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => handleStartRevisionForDoc(doc)}
                                className="h-8 text-xs font-semibold gap-1 rounded-lg border-amber-300 text-amber-700 bg-amber-500/10 hover:bg-amber-500/20 cursor-pointer"
                                title="Unggah revisi untuk dokumen ini (menaikkan versi)"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Revisi</span>
                              </Button>

                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => handleView(doc)}
                                disabled={isPreviewLoading}
                                className="h-8 text-xs font-semibold gap-1 rounded-lg border-primary/40 text-primary hover:bg-primary/10 cursor-pointer"
                              >
                                {isPreviewLoading ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : doc.isExternal ? (
                                  <ExternalLink className="w-3 h-3" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                                <span>{doc.isExternal ? "Buka" : "Lihat"}</span>
                              </Button>

                              {!doc.isExternal && (
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => handleDownload(doc)}
                                  disabled={isDownloading === doc.id}
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
                                  title="Download File"
                                >
                                  {isDownloading === doc.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Download className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>

                          {doc.notes && (
                            <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/40 ml-7">
                              <span className="font-semibold text-foreground">
                                Catatan Versi Ini:{" "}
                              </span>
                              {doc.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl border border-dashed border-border/80 text-center bg-muted/10">
                      <p className="text-xs text-muted-foreground">
                        {historySearch
                          ? "Tidak ada riwayat dokumen yang cocok dengan pencarian."
                          : "Belum ada riwayat versi untuk kategori ini."}
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              )}

              <DialogFooter className="pt-2 border-t border-border/40 flex justify-between items-center shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCatId(null)}
                  className="rounded-xl text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Kembali ke Daftar Dokumen
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Tutup
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL PREVIEW DOKUMEN (PDF / GAMBAR) */}
      {previewDoc && (
        <Dialog
          open={!!previewDoc}
          onOpenChange={(o) => !o && setPreviewDoc(null)}
        >
          <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-4 rounded-2xl">
            <DialogHeader className="border-b pb-2 flex flex-row items-center justify-between">
              <div>
                <DialogTitle className="text-sm font-bold truncate">
                  {previewDoc.fileName || "Preview Dokumen"}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Versi {previewDoc.version} •{" "}
                  {formatJakartaDate(previewDoc.createdAt, "datetime")}
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-hidden rounded-xl bg-muted/20 flex items-center justify-center min-h-0 relative">
              {isPreviewLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground font-semibold">
                    Memuat berkas...
                  </span>
                </div>
              ) : previewUrl ? (
                getFileExtension(previewDoc.fileName) === "pdf" ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-0 rounded-xl"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain rounded-xl"
                  />
                )
              ) : (
                <span className="text-xs text-muted-foreground">
                  Tidak dapat menampilkan preview
                </span>
              )}
            </div>

            <DialogFooter className="pt-2 flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(previewDoc)}
                className="gap-1 text-xs font-semibold cursor-pointer rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewDoc(null)}
                className="text-xs font-semibold cursor-pointer rounded-lg"
              >
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* DIALOG DETAIL ITEM (BOQ / SPB / SPJ) */}
      <Dialog
        open={!!viewingDetailType}
        onOpenChange={(open) => {
          if (!open) {
            setViewingDetailType(null);
            setViewingDetailData(null);
            setDetailSearchQuery("");
          }
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-border/80 shadow-2xl bg-background z-[60]">
          <DialogHeader className="p-4 sm:p-6 pb-4 shrink-0 border-b border-border/50">
            <div className="flex items-center justify-between w-full pr-6">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center border shrink-0",
                    viewingDetailType === "BOQ"
                      ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                      : viewingDetailType === "SPB"
                      ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
                      : "bg-purple-500/10 text-purple-600 border-purple-500/20",
                  )}
                >
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Detail Item{" "}
                    {viewingDetailType === "BOQ"
                      ? `BoQ: ${viewingDetailData?.boqNumber || "-"}`
                      : viewingDetailType === "SPB"
                      ? `SPB: ${viewingDetailData?.spbNumber || "-"}`
                      : `SPJ: ${viewingDetailData?.spjNumber || "-"}`}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground font-medium mt-0.5">
                    Proyek: {viewingDetailData?.projectName || "-"}
                  </DialogDescription>
                </div>
              </div>
              <Badge
                className={cn(
                  "border-none shadow-none text-[10px] font-bold rounded-lg px-2.5 py-1",
                  viewingDetailType === "BOQ"
                    ? viewingDetailData?.boqStatus === "APPROVED"
                      ? "bg-emerald-500/10 text-emerald-700"
                      : "bg-amber-500/10 text-amber-700"
                    : viewingDetailData?.status === "APPROVED"
                    ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-amber-500/10 text-amber-700",
                )}
              >
                {viewingDetailType === "BOQ"
                  ? viewingDetailData?.boqStatus || "DRAFT"
                  : (viewingDetailData?.status || "DRAFT").replace(/_/g, " ")}
              </Badge>
            </div>
          </DialogHeader>

          {/* Search Bar */}
          <div className="px-4 sm:px-6 py-2 border-b border-border/30 bg-muted/10 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Cari nama barang atau kode..."
                className="pl-9 w-full shadow-none bg-background rounded-lg border-border h-9 text-xs"
                value={detailSearchQuery}
                onChange={(e) => setDetailSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Items Table inside Dialog */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/5">
            <div className="border border-border/40 rounded-xl overflow-x-auto shadow-xs bg-card">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/30 text-xs font-semibold text-muted-foreground border-b border-border/30">
                    <th className="p-3 w-12 text-center">No</th>
                    {viewingDetailType === "BOQ" && (
                      <th className="p-3 w-32">Kode Barang</th>
                    )}
                    <th className="p-3">Nama Barang</th>
                    {viewingDetailType !== "SPJ" && (
                      <th className="p-3 w-36">Tipe / Merk</th>
                    )}
                    <th className="p-3 text-center w-28">Kuantitas</th>
                    {viewingDetailType === "SPB" && (
                      <th className="p-3 text-center w-32">Sumber Barang</th>
                    )}
                    <th className="p-3">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const q = detailSearchQuery.toLowerCase();
                    if (viewingDetailType === "BOQ") {
                      const items = (viewingDetailData?.boqItems || []).filter(
                        (bi: any) =>
                          (bi.item?.name || bi.item?.itemName || "")
                            .toLowerCase()
                            .includes(q) ||
                          (bi.item?.code || bi.item?.itemCode || "")
                            .toLowerCase()
                            .includes(q) ||
                          (bi.item?.typeMerk || "").toLowerCase().includes(q),
                      );

                      if (items.length === 0) {
                        return (
                          <tr>
                            <td
                              colSpan={6}
                              className="p-8 text-center text-muted-foreground italic"
                            >
                              Tidak ada item yang ditemukan.
                            </td>
                          </tr>
                        );
                      }

                      return items.map((item: any, idx: number) => (
                        <tr
                          key={item.id || idx}
                          className="border-b border-border/10 last:border-0 hover:bg-muted/5 transition-colors"
                        >
                          <td className="p-3 text-center text-foreground font-bold">
                            {idx + 1}
                          </td>
                          <td className="p-3 font-mono text-muted-foreground">
                            {item.item?.itemCode || item.item?.code || "-"}
                          </td>
                          <td className="p-3 font-semibold text-foreground">
                            {item.item?.itemName || item.item?.name || "-"}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {item.item?.typeMerk || "-"}
                          </td>
                          <td className="p-3 text-center font-bold text-primary">
                            {item.qty} {item.unit || item.item?.unit || "pcs"}
                          </td>
                          <td className="p-3 text-muted-foreground italic text-[11px]">
                            {item.note || "-"}
                          </td>
                        </tr>
                      ));
                    }

                    if (viewingDetailType === "SPB") {
                      const items = (viewingDetailData?.items || []).filter(
                        (it: any) =>
                          (it.material?.name || it.itemName || it.name || "")
                            .toLowerCase()
                            .includes(q) ||
                          (it.material?.typeMerk || it.typeMerk || "")
                            .toLowerCase()
                            .includes(q),
                      );

                      if (items.length === 0) {
                        return (
                          <tr>
                            <td
                              colSpan={6}
                              className="p-8 text-center text-muted-foreground italic"
                            >
                              Tidak ada item yang ditemukan.
                            </td>
                          </tr>
                        );
                      }

                      return items.map((item: any, idx: number) => (
                        <tr
                          key={item.id || idx}
                          className="border-b border-border/10 last:border-0 hover:bg-muted/5 transition-colors"
                        >
                          <td className="p-3 text-center text-foreground font-bold">
                            {idx + 1}
                          </td>
                          <td className="p-3 font-semibold text-foreground">
                            {item.material?.name ||
                              item.itemName ||
                              item.name ||
                              "-"}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {item.material?.typeMerk || item.typeMerk || "-"}
                          </td>
                          <td className="p-3 text-center font-bold text-orange-600">
                            {item.qty}{" "}
                            {item.unit || item.material?.unit || "pcs"}
                          </td>
                          <td className="p-3 text-center">
                            <Badge
                              variant="outline"
                              className="text-[9px] font-bold px-1.5 py-0"
                            >
                              {item.source || "GUDANG"}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground italic text-[11px]">
                            {item.note || "-"}
                          </td>
                        </tr>
                      ));
                    }

                    if (viewingDetailType === "SPJ") {
                      const items = (viewingDetailData?.items || []).filter(
                        (it: any) =>
                          (it.itemName || it.name || "")
                            .toLowerCase()
                            .includes(q),
                      );

                      if (items.length === 0) {
                        return (
                          <tr>
                            <td
                              colSpan={4}
                              className="p-8 text-center text-muted-foreground italic"
                            >
                              Tidak ada item yang ditemukan.
                            </td>
                          </tr>
                        );
                      }

                      return items.map((item: any, idx: number) => (
                        <tr
                          key={item.id || idx}
                          className="border-b border-border/10 last:border-0 hover:bg-muted/5 transition-colors"
                        >
                          <td className="p-3 text-center text-foreground font-bold">
                            {idx + 1}
                          </td>
                          <td className="p-3 font-semibold text-foreground">
                            {item.itemName || item.name || "-"}
                          </td>
                          <td className="p-3 text-center font-bold text-purple-600">
                            {item.qty} {item.unit || "pcs"}
                          </td>
                          <td className="p-3 text-muted-foreground italic text-[11px]">
                            {item.note || "-"}
                          </td>
                        </tr>
                      ));
                    }

                    return null;
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border/40 bg-muted/10 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewingDetailType(null)}
              className="rounded-xl text-xs font-semibold cursor-pointer"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG PRATINJAU CETAK PDF (BOQ / SPB / SPJ) */}
      <Dialog
        open={!!previewPdfType}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewPdfType(null);
            setPreviewPdfData(null);
          }
        }}
      >
        <DialogContent className="w-[96vw] sm:max-w-4xl h-[90vh] flex flex-col p-6 bg-zinc-950 border border-zinc-800 text-white rounded-2xl z-[60]">
          <DialogHeader className="flex-none">
            <DialogTitle className="text-base font-bold text-white">
              Pratinjau Cetak {previewPdfType === "BOQ" ? "BoQ" : previewPdfType === "SPB" ? "SPB" : "SPJ"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Pratinjau dokumen PDF{" "}
              {previewPdfType === "BOQ"
                ? `Bill of Quantities (${previewPdfData?.boqNumber || "-"})`
                : previewPdfType === "SPB"
                ? `Surat Permintaan Barang (${previewPdfData?.spbNumber || "-"})`
                : `Surat Pertanggungjawaban (${previewPdfData?.spjNumber || "-"})`}
              .
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 w-full overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 mt-4 relative">
            {previewPdfType === "BOQ" && previewPdfData && (
              <PDFViewer
                width="100%"
                height="100%"
                showToolbar={true}
                className="border-0"
              >
                <BoQPDFDocument
                  project={previewPdfData.project}
                  items={previewPdfData.items}
                />
              </PDFViewer>
            )}

            {previewPdfType === "SPB" && previewPdfData && (
              <PDFViewer
                width="100%"
                height="100%"
                showToolbar={true}
                className="border-0"
              >
                <SPBPDFDocument
                  spb={previewPdfData.spb}
                  project={previewPdfData.project}
                />
              </PDFViewer>
            )}

            {previewPdfType === "SPJ" && previewPdfData && (
              <PDFViewer
                width="100%"
                height="100%"
                showToolbar={true}
                className="border-0"
              >
                <SPJPDFDocument
                  spj={previewPdfData.spj}
                  project={previewPdfData.project}
                />
              </PDFViewer>
            )}
          </div>

          <DialogFooter className="mt-4 flex-none">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPreviewPdfType(null);
                setPreviewPdfData(null);
              }}
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
