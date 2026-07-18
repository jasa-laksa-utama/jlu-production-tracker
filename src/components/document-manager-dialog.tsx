"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  UploadCloud,
  Link as LinkIcon,
  Download,
  History,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertCircle,
  Globe,
  Copy,
  Check,
  Edit,
  Eye,
  Loader2,
  X,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createDocumentUploadUrl,
  saveDocumentRecord,
  getDocumentsByOwner,
  getDocumentDownloadUrl,
} from "@/app/actions/documents";
import { updateGlobalDriveLink } from "@/app/actions/drive-link";
import { format } from "date-fns";

// Document categories available system-wide
export const DOCUMENT_CATEGORIES = [
  { id: "BRIEF", label: "Brief", icon: "📋" },
  { id: "DRAWING", label: "Drawing", icon: "📐" },
  { id: "BOQ", label: "Bill of Quantity", icon: "📊" },
  { id: "MECH_PART_LIST", label: "Mechanical Part List", icon: "⚙️" },
  { id: "RAB", label: "RAB", icon: "💰" },
  { id: "RAP", label: "RAP", icon: "📈" },
  { id: "SPB", label: "SPB", icon: "🚚" },
  { id: "PRODUCTION", label: "Dokumen Produksi", icon: "🏭" },
  { id: "QC", label: "Dokumen QC", icon: "✅" },
  { id: "OTHER", label: "Other", icon: "📎" },
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]["id"];

const DEFAULT_CATEGORIES: DocumentCategory[] = [
  "BRIEF",
  "DRAWING",
  "BOQ",
  "MECH_PART_LIST",
  "RAB",
  "RAP",
  "SPB",
  "OTHER",
];

interface DocumentManagerDialogProps {
  ownerId: string;
  ownerType: "LEAD" | "PROJECT";
  leadId?: string | null;
  categories?: DocumentCategory[];
  globalDriveUrl?: string | null;
  onUploadSuccess?: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  createdAt: string;
}

// ─── Single Category Section ────────────────────────────────────
function CategorySection({
  ownerId,
  ownerType,
  category,
  documents,
  onUploadSuccess,
  leadId,
  isDownloading,
  handleView,
}: {
  ownerId: string;
  ownerType: "LEAD" | "PROJECT";
  category: (typeof DOCUMENT_CATEGORIES)[number];
  documents: DocumentRecord[];
  onUploadSuccess: () => void;
  leadId?: string | null;
  isDownloading: string | null;
  handleView: (doc: DocumentRecord) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");

  const sortedDocs = documents
    .filter((d) => d.category === category.id)
    .sort((a, b) => b.version - a.version);
  const latestDoc = sortedDocs[0];
  const isNew =
    latestDoc &&
    new Date().getTime() - new Date(latestDoc.createdAt).getTime() <
      24 * 60 * 60 * 1000;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error("Ukuran file melebihi batas 25MB.");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    e.target.value = "";
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);

    try {
      toast.loading(`Menyiapkan upload ${category.label}...`, {
        id: `upload-${category.id}`,
      });

      const { uploadUrl, path, version, success, error } =
        await createDocumentUploadUrl(
          ownerId,
          ownerType,
          category.id,
          selectedFile.name,
        );

      if (!success || !uploadUrl || !path) {
        throw new Error(error || "Gagal membuat channel upload");
      }

      toast.loading(`Mengupload ke cloud...`, { id: `upload-${category.id}` });

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: selectedFile,
        headers: { "Content-Type": selectedFile.type },
      });

      if (!uploadRes.ok) throw new Error("Gagal mengupload file ke cloud");

      const result = await saveDocumentRecord({
        leadId: (ownerType === "LEAD"
          ? ownerId
          : leadId || undefined) as string,
        projectId: ownerType === "PROJECT" ? ownerId : undefined,
        category: category.id,
        url: path,
        fileName: selectedFile.name,
        isExternal: false,
        version: version || 1,
        notes: revisionNotes.trim() || `Upload v${version || 1}`,
      });

      if (result.success) {
        toast.success(`${category.label} v${version} berhasil diupload!`, {
          id: `upload-${category.id}`,
        });
        setSelectedFile(null);
        setRevisionNotes("");
        onUploadSuccess();
      } else {
        throw new Error("File diupload tapi gagal menyimpan record");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan", {
        id: `upload-${category.id}`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleLinkSave = async () => {
    if (!linkInput.trim()) return;
    setIsUploading(true);

    try {
      const newVersion = (latestDoc?.version || 0) + 1;
      const result = await saveDocumentRecord({
        leadId: (ownerType === "LEAD"
          ? ownerId
          : leadId || undefined) as string,
        projectId: ownerType === "PROJECT" ? ownerId : undefined,
        category: category.id,
        url: linkInput.trim(),
        fileName: "External Link",
        isExternal: true,
        version: newVersion,
        notes: revisionNotes.trim() || `Link v${newVersion}`,
      });

      if (result.success) {
        toast.success(`Link ${category.label} tersimpan!`);
        setLinkInput("");
        setRevisionNotes("");
        onUploadSuccess();
      } else {
        throw new Error("Gagal menyimpan link");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan link");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-base">{category.icon}</span>
          <span className="font-semibold text-sm">{category.label}</span>
          {latestDoc && (
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-semibold",
                  isNew
                    ? "bg-green-500/10 text-green-600 border-green-200"
                    : "bg-muted text-muted-foreground",
                )}
              >
                v{latestDoc.version}
                {isNew && " • NEW"}
              </Badge>
              {sortedDocs.length > 1 && (
                <Badge
                  variant="outline"
                  className="bg-orange-500/10 text-orange-600 border-orange-200 text-xs font-semibold animate-pulse"
                >
                  Ada Revisi / Tambahan
                </Badge>
              )}
            </div>
          )}
        </div>
        {sortedDocs.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground cursor-pointer"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="w-3 h-3 mr-1" />
            {sortedDocs.length} versi
            {showHistory ? (
              <ChevronDown className="w-3 h-3 ml-1" />
            ) : (
              <ChevronRight className="w-3 h-3 ml-1" />
            )}
          </Button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Active Document */}
        {latestDoc ? (
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-background border border-border/50">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {latestDoc.isExternal ? (
                <ExternalLink className="w-4 h-4 text-blue-500 shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-primary shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">
                  {latestDoc.fileName || "Document"}
                </p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  {format(new Date(latestDoc.createdAt), "dd MMM yyyy, HH:mm")}
                  {latestDoc.uploadedBy && ` • ${latestDoc.uploadedBy}`}
                  {sortedDocs.length > 1 && (
                    <span className="text-orange-600 font-medium ml-1">
                      (Revisi Terbaru / Ada Tambahan)
                    </span>
                  )}
                </p>
                {latestDoc.notes && (
                  <p className="text-[10px] text-muted-foreground mt-1 bg-muted/30 px-1.5 py-0.5 rounded italic">
                    Note: {latestDoc.notes}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs flex items-center gap-1 cursor-pointer bg-background"
              disabled={isDownloading === latestDoc.id}
              onClick={() => handleView(latestDoc)}
            >
              {isDownloading === latestDoc.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : latestDoc.isExternal ? (
                <>
                  <ExternalLink className="w-3.5 h-3.5 text-primary" />
                  <span>Buka Link</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-primary" />
                  <span>Lihat File</span>
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/20 border border-dashed border-border text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs">Belum ada dokumen</span>
          </div>
        )}

        {/* Version History (collapsible) */}
        {showHistory && sortedDocs.length > 1 && (
          <div className="space-y-1 pl-2 border-l-2 border-border ml-2">
            {sortedDocs.slice(1).map((doc) => (
              <div
                key={doc.id}
                className="group flex flex-col gap-1 py-2 px-2 rounded-md hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <Badge
                      variant="secondary"
                      className="h-4 px-1 text-xs font-medium"
                    >
                      v{doc.version}
                    </Badge>
                    <span className="truncate max-w-[200px] font-medium text-foreground/80">
                      {doc.fileName || "Document"}
                    </span>
                    <span className="shrink-0">•</span>
                    <span className="shrink-0">
                      {format(new Date(doc.createdAt), "dd/MM/yy HH:mm")}
                    </span>
                    {doc.uploadedBy && (
                      <>
                        <span className="shrink-0">•</span>
                        <span className="font-semibold text-primary/70">
                          by {doc.uploadedBy}
                        </span>
                      </>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0 flex items-center gap-1"
                    disabled={isDownloading === doc.id}
                    onClick={() => handleView(doc)}
                  >
                    {isDownloading === doc.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : doc.isExternal ? (
                      <>
                        <ExternalLink className="w-3.5 h-3.5 text-primary" />
                        <span>Buka</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-primary" />
                        <span>Lihat</span>
                      </>
                    )}
                  </Button>
                </div>
                {doc.notes && (
                  <p className="text-[10px] text-muted-foreground italic pl-5 line-clamp-1">
                    ↳ Note: {doc.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {/* File Upload */}
          <div className="w-full sm:flex-1">
            {selectedFile ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 text-xs truncate bg-muted/40 rounded px-2 py-1.5 border border-border/50">
                  {selectedFile.name}
                </div>
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs cursor-pointer"
                  onClick={handleFileUpload}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <UploadCloud className="w-3 h-3 mr-1" />
                  )}
                  Upload
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 cursor-pointer"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <label
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded border border-dashed border-border text-xs cursor-pointer",
                  "text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors",
                  isUploading && "pointer-events-none opacity-50",
                )}
              >
                <UploadCloud className="w-3 h-3" />
                Pilih File
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />
              </label>
            )}
          </div>

          {/* Separator - Hidden on very small screens to save space */}
          <span className="hidden sm:inline text-[10px] text-muted-foreground">
            atau
          </span>

          {/* Link Input */}
          <div className="flex items-center gap-1 w-full sm:flex-1">
            <Input
              placeholder="Paste URL..."
              className="h-7 text-xs shadow-none"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              disabled={isUploading}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs cursor-pointer"
              disabled={!linkInput.trim() || isUploading}
              onClick={handleLinkSave}
            >
              <LinkIcon className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Notes Input (Optional) */}
        <div className="pt-1">
          <Input
            placeholder="Catatan (opsional)..."
            className="h-7 text-[10px] bg-background/50 border-dashed"
            value={revisionNotes}
            onChange={(e) => setRevisionNotes(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main Dialog Component ──────────────────────────────────────
export function DocumentManagerDialog({
  ownerId,
  ownerType,
  leadId,
  categories,
  globalDriveUrl,
  onUploadSuccess,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: DocumentManagerDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen =
    setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  // Preview States
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

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
      toast.error(err.message);
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

  const activeCategories = categories
    ? DOCUMENT_CATEGORIES.filter((c) => categories.includes(c.id))
    : DOCUMENT_CATEGORIES.filter((c) => (DEFAULT_CATEGORIES as string[]).includes(c.id));

  const [isUpdatingDrive, setIsUpdatingDrive] = useState(false);
  const [driveUrl, setDriveUrl] = useState(globalDriveUrl || "");
  const [isEditingDrive, setIsEditingDrive] = useState(false);

  useEffect(() => {
    setDriveUrl(globalDriveUrl || "");
  }, [globalDriveUrl]);

  const handleUpdateDrive = async () => {
    setIsUpdatingDrive(true);
    try {
      const result = await updateGlobalDriveLink(ownerId, ownerType, driveUrl);
      if (result.success) {
        toast.success("Link Drive Terpusat berhasil diperbarui");
        setIsEditingDrive(false);
        if (onUploadSuccess) onUploadSuccess();
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error("Gagal memperbarui link drive");
    } finally {
      setIsUpdatingDrive(false);
    }
  };

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getDocumentsByOwner(
        ownerId,
        ownerType,
        leadId || undefined,
      );
      if (result.success && result.data) {
        // Exclude PO and OFFERING from document manager to keep them in SalesDocumentsDialog only
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
  }, [ownerId, ownerType]);

  useEffect(() => {
    if (open) {
      fetchDocuments();
    }
  }, [open, fetchDocuments]);

  const handleUploadSuccess = () => {
    fetchDocuments();
    onUploadSuccess?.();
  };

  const handleCopyDriveUrl = () => {
    if (globalDriveUrl) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(globalDriveUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Link Drive di-copy!");
      } else {
        // Fallback for insecure contexts (HTTP / IP)
        try {
          const textArea = document.createElement("textarea");
          textArea.value = globalDriveUrl;
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          toast.success("Link Drive di-copy!");
        } catch (err) {
          toast.error("Gagal menyalin link secara otomatis");
        }
      }
    }
  };

  const totalDocs = documents.length;
  const categoriesWithDocs = new Set(documents.map((d) => d.category)).size;

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
                className="gap-2 cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" />
                Documents
                {totalDocs > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-5 px-1.5 text-[10px] font-bold"
                  >
                    {totalDocs}
                  </Badge>
                )}
              </Button>
            }
          />
        )}
        <DialogContent className="md:max-w-[900px]! max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" />
              Document Manager
            </DialogTitle>
            <DialogDescription>
              Upload, kelola, dan lihat riwayat versi dokumen.{" "}
              {totalDocs > 0 && (
                <span className="font-medium text-foreground">
                  {totalDocs} dokumen di {categoriesWithDocs} kategori
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Global Drive URL */}
          <div className="space-y-1.5 px-0.5">
            <div className="flex items-center justify-between ml-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Global Drive Link
              </Label>
              {!isEditingDrive && (
                <button
                  onClick={() => setIsEditingDrive(true)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Edit className="w-2.5 h-2.5" />
                  {globalDriveUrl ? "Edit Link" : "Set Link"}
                </button>
              )}
            </div>

            {isEditingDrive ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={driveUrl}
                    onChange={(e) => setDriveUrl(e.target.value)}
                    placeholder="Paste link Google Drive folder di sini..."
                    className="h-9 pl-8 text-xs bg-muted/20 border-primary/20 focus-visible:ring-primary"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 px-3 text-xs font-semibold cursor-pointer"
                    onClick={() => {
                      setIsEditingDrive(false);
                      setDriveUrl(globalDriveUrl || "");
                    }}
                    disabled={isUpdatingDrive}
                  >
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 px-3 text-xs font-semibold bg-primary hover:bg-primary/95 text-primary-foreground cursor-pointer"
                    disabled={isUpdatingDrive || driveUrl === globalDriveUrl}
                    onClick={handleUpdateDrive}
                  >
                    {isUpdatingDrive ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      "Simpan"
                    )}
                  </Button>
                </div>
              </div>
            ) : globalDriveUrl ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-200 text-sm">
                <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                <a
                  href={globalDriveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate flex-1 text-xs"
                >
                  {globalDriveUrl}
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0 cursor-pointer"
                  onClick={handleCopyDriveUrl}
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-4 rounded-lg bg-muted/30 border border-dashed border-border text-sm justify-center">
                <p className="text-xs text-muted-foreground italic">
                  Link Drive Terpusat belum diatur.{" "}
                  <button
                    onClick={() => setIsEditingDrive(true)}
                    className="text-primary font-medium underline cursor-pointer"
                  >
                    Set Sekarang
                  </button>
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Document Categories */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              activeCategories.map((cat) => (
                <CategorySection
                  key={cat.id}
                  ownerId={ownerId}
                  ownerType={ownerType}
                  leadId={leadId}
                  category={cat}
                  documents={documents}
                  onUploadSuccess={handleUploadSuccess}
                  isDownloading={isDownloading}
                  handleView={handleView}
                />
              ))
            )}
          </div>

          {/* Document Preview Dialog - Nested inside Parent DialogContent to avoid pointer-events/focus conflict */}
          <Dialog
            open={!!previewDoc}
            onOpenChange={(open) => {
              if (!open) {
                setPreviewDoc(null);
                setPreviewUrl(null);
              }
            }}
          >
            <DialogContent 
              className="max-w-xl md:max-w-[800px]! w-full max-h-[90vh] flex flex-col p-6 rounded-2xl"
              forceRenderOverlay
            >
              <DialogHeader className="pb-2">
                <DialogTitle className="text-base font-bold flex items-center gap-2 truncate pr-6">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <span className="truncate">Preview: {previewDoc?.fileName}</span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Versi {previewDoc?.version} • Diupload oleh{" "}
                  {previewDoc?.uploadedBy || "Seseorang"} pada{" "}
                  {previewDoc &&
                    format(new Date(previewDoc.createdAt), "dd MMM yyyy, HH:mm")}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 min-h-[350px] bg-muted/20 border rounded-xl flex items-center justify-center overflow-hidden p-2 relative">
                {isPreviewLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground font-medium">
                      Memuat dokumen...
                    </span>
                  </div>
                ) : previewUrl ? (
                  (() => {
                    const ext = getFileExtension(previewDoc?.fileName || "");
                    if (["jpg", "jpeg", "png"].includes(ext)) {
                      return (
                        <div className="w-full h-full flex items-center justify-center p-2">
                          <img
                            src={previewUrl}
                            alt={previewDoc?.fileName || "Preview"}
                            className="max-w-full max-h-[55vh] object-contain rounded-lg shadow-sm bg-background"
                          />
                        </div>
                      );
                    } else if (ext === "pdf") {
                      return (
                        <iframe
                          src={previewUrl}
                          title={previewDoc?.fileName || "Preview PDF"}
                          className="w-full h-[55vh] rounded-lg border-0 bg-background"
                        />
                      );
                    }
                    return null;
                  })()
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground text-xs p-4">
                    <AlertCircle className="w-8 h-8 text-destructive/80" />
                    <span>Gagal menampilkan preview</span>
                  </div>
                )}
              </div>

              {previewDoc?.notes && (
                <div className="mt-2 text-xs bg-muted/40 p-2.5 rounded-lg border border-border/40 italic text-muted-foreground">
                  Catatan: "{previewDoc.notes}"
                </div>
              )}

              <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-4 border-t mt-4 shrink-0 font-sans">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-9 cursor-pointer"
                  onClick={() => {
                    setPreviewDoc(null);
                    setPreviewUrl(null);
                  }}
                >
                  Tutup
                </Button>
                {previewDoc && (
                  <Button
                    variant="default"
                    size="sm"
                    className="text-xs h-9 bg-primary hover:bg-primary/95 text-primary-foreground font-bold shadow-sm cursor-pointer flex items-center gap-1.5"
                    disabled={isDownloading === previewDoc.id}
                    onClick={() => handleDownload(previewDoc)}
                  >
                    {isDownloading === previewDoc.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Unduh File</span>
                      </>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
    </>
  );
}
