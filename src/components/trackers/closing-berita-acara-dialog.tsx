"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  File,
  FileSpreadsheet,
  FileImage,
  X,
  Loader2,
  Download,
  Calendar,
  User,
  ExternalLink,
  ShieldCheck,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  createDocumentUploadUrl,
  getDocumentDownloadUrl,
} from "@/app/actions/documents";
import {
  closeProjectWithBeritaAcara,
  getProjectBeritaAcaraDocuments,
} from "@/app/actions/projects";
import { formatJakartaDate } from "@/lib/date-utils";

interface ClosingBeritaAcaraDialogProps {
  project: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface SelectedFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
}

export function ClosingBeritaAcaraDialog({
  project,
  open,
  onOpenChange,
  onSuccess,
}: ClosingBeritaAcaraDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Existing documents state for CLOSED project mode
  const [existingDocs, setExistingDocs] = useState<any[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  const isClosed =
    project?.status === "CLOSED" || project?.status === "COMPLETED";

  // Load existing Berita Acara documents if opened
  useEffect(() => {
    if (open && project?.id) {
      setIsLoadingDocs(true);
      getProjectBeritaAcaraDocuments(project.id)
        .then((res) => {
          if (res.success && res.data) {
            setExistingDocs(res.data);
          }
        })
        .catch((err) => {
          console.error("Gagal memuat dokumen Berita Acara:", err);
        })
        .finally(() => {
          setIsLoadingDocs(false);
        });
    } else if (!open) {
      // Reset form states on close
      setSelectedFiles([]);
      setNotes("");
      setIsSubmitting(false);
      setUploadStatusText("");
    }
  }, [open, project?.id]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
      return <FileImage className="w-5 h-5 text-indigo-500 shrink-0" />;
    }
    if (["xls", "xlsx", "csv"].includes(ext)) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />;
    }
    if (["pdf"].includes(ext)) {
      return <FileText className="w-5 h-5 text-rose-500 shrink-0" />;
    }
    return <File className="w-5 h-5 text-blue-500 shrink-0" />;
  };

  const handleAddFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const allowedExtensions = [
      ".pdf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".png",
      ".jpg",
      ".jpeg",
    ];
    const newItems: SelectedFileItem[] = [];

    Array.from(files).forEach((file) => {
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        toast.error(`Format file "${file.name}" tidak didukung.`);
        return;
      }
      if (file.size > 200 * 1024 * 1024) {
        toast.error(`File "${file.name}" melebihi ukuran maksimal 200MB.`);
        return;
      }
      // Avoid duplicate by name and size
      const isDuplicate = selectedFiles.some(
        (f) => f.name === file.name && f.size === file.size,
      );
      if (!isDuplicate) {
        newItems.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          name: file.name,
          size: file.size,
        });
      }
    });

    if (newItems.length > 0) {
      setSelectedFiles((prev) => [...prev, ...newItems]);
    }
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDownloadExistingDoc = async (docId: string) => {
    setDownloadingDocId(docId);
    try {
      const res = await getDocumentDownloadUrl(docId);
      if (res.success && res.url) {
        window.open(res.url, "_blank");
      } else {
        toast.error(res.error || "Gagal mengunduh dokumen.");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunduh dokumen.");
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleSubmitClosing = async () => {
    if (!project?.id) return;

    if (selectedFiles.length === 0) {
      toast.error("Pilih minimal satu file Berita Acara atau hasil uji site.");
      return;
    }

    setIsSubmitting(true);
    const uploadedDocsPayload: Array<{
      url: string;
      fileName: string;
      fileType: string;
      fileSize: number;
    }> = [];

    try {
      // 1. Upload each file to Supabase Storage via signed URL
      for (let i = 0; i < selectedFiles.length; i++) {
        const item = selectedFiles[i];
        setUploadStatusText(
          `Mengunggah berkas (${i + 1}/${selectedFiles.length}): ${item.name}...`,
        );

        const urlRes = await createDocumentUploadUrl(
          project.id,
          "PROJECT",
          "BERITA_ACARA",
          item.file.name,
        );

        if (!urlRes.success || !urlRes.uploadUrl || !urlRes.path) {
          throw new Error(
            urlRes.error || `Gagal menyiapkan URL upload untuk ${item.name}`,
          );
        }

        const uploadRes = await fetch(urlRes.uploadUrl, {
          method: "PUT",
          body: item.file,
          headers: {
            "Content-Type": item.file.type || "application/octet-stream",
          },
        });

        if (!uploadRes.ok) {
          throw new Error(
            `Gagal mengunggah file ${item.name} ke server storage.`,
          );
        }

        uploadedDocsPayload.push({
          url: urlRes.path,
          fileName: item.name,
          fileType: item.file.type || "application/pdf",
          fileSize: item.size,
        });
      }

      // 2. Submit Berita Acara and close project in DB
      setUploadStatusText("Menyimpan Berita Acara dan menutup proyek...");
      const closeRes = await closeProjectWithBeritaAcara({
        projectId: project.id,
        notes: notes.trim() || undefined,
        files: uploadedDocsPayload,
      });

      if (!closeRes.success) {
        throw new Error(
          closeRes.error || "Gagal menyelesaikan proses penutupan proyek.",
        );
      }

      toast.success(
        closeRes.message ||
          "Proyek berhasil ditutup resmi dengan Berita Acara!",
      );
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    } catch (err: any) {
      console.error("Error submitting Berita Acara:", err);
      toast.error(
        err.message || "Terjadi kesalahan saat memproses Berita Acara.",
      );
    } finally {
      setIsSubmitting(false);
      setUploadStatusText("");
    }
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl rounded-2xl p-4 sm:p-6 max-h-[92vh] flex flex-col overflow-y-auto">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">
                {isClosed
                  ? "Arsip Berita Acara Closing Proyek"
                  : "Submit Berita Acara & Closing Proyek"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {isClosed
                  ? "Dokumen hasil pengujian unit conveyor di site dan riwayat penutupan resmi proyek."
                  : "Penutupan proyek oleh Engineering setelah pengujian unit conveyor di site."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Info Box: Data Proyek */}
        <div className="mt-4 p-3.5 rounded-xl border border-border/70 bg-muted/25 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs bg-background px-2 py-0.5 rounded-md border border-border/60 text-primary">
                {project.projectNumber || "DRAFT"}
              </span>
              <span className="font-semibold text-sm text-foreground">
                {project.projectName}
              </span>
            </div>
            {isClosed ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                Proyek Ditutup (Closed)
              </Badge>
            ) : (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Selesai Pengujian
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Customer:{" "}
              <strong className="text-foreground/90 font-medium">
                {project.customer?.company ||
                  project.customer?.name ||
                  "Klien Umum"}
              </strong>
            </span>
            {project.customer?.name && project.customer?.company && (
              <span>
                Kontak:{" "}
                <strong className="text-foreground/90 font-medium">
                  {project.customer.name}
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        {isClosed ? (
          /* ================= MODE: ALREADY CLOSED / VIEW ARCHIVE ================= */
          <div className="space-y-4 py-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-muted-foreground">
                Lampiran Berita Acara & Hasil Uji Site ({existingDocs.length})
              </h4>
              {existingDocs.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Terverifikasi di Cloud Storage
                </span>
              )}
            </div>

            {isLoadingDocs ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs font-medium">
                  Memuat dokumen Berita Acara...
                </span>
              </div>
            ) : existingDocs.length === 0 ? (
              <div className="p-6 text-center border border-dashed rounded-xl border-border/80 text-muted-foreground text-xs">
                Tidak ada dokumen Berita Acara terpisah yang ditemukan.
              </div>
            ) : (
              <div className="space-y-2.5">
                {existingDocs.map((doc: any) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border/80 bg-card hover:bg-muted/20 transition-colors gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {getFileIcon(doc.fileName || doc.name || "")}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {doc.fileName || doc.name || "Dokumen Berita Acara"}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatJakartaDate(doc.createdAt)}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {doc.uploadedBy || "Engineering"}
                          </span>
                        </div>
                        {doc.notes && (
                          <p className="text-[11px] text-foreground/80 italic mt-1 bg-muted/40 p-1.5 rounded-md border border-border/40">
                            Catatan: {doc.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs shrink-0 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all"
                      disabled={downloadingDocId === doc.id}
                      onClick={() => handleDownloadExistingDoc(doc.id)}
                    >
                      {downloadingDocId === doc.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>Unduh</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ================= MODE: SUBMIT FORM ================= */
          <div className="space-y-4 py-2">
            {/* Multi-file Dropzone */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  Unggah Dokumen Berita Acara & Hasil Uji Site
                  <span className="text-rose-500 ml-1">*</span>
                </label>
                <span className="text-[10px] text-muted-foreground">
                  PDF, DOCX, XLSX, JPG, PNG (Maks 200MB/file)
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => {
                  handleAddFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              <div
                onClick={() => !isSubmitting && fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleAddFiles(e.dataTransfer.files);
                }}
                className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border/80 hover:border-primary/50 hover:bg-muted/20"
                }`}
              >
                <div className="p-3 rounded-full bg-primary/10 text-primary">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">
                    Klik untuk memilih file atau tarik berkas ke sini
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Bisa memilih beberapa file sekaligus
                  </p>
                </div>
              </div>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-medium px-1">
                    <span>
                      {selectedFiles.length} berkas dipilih (Total:{" "}
                      {formatFileSize(
                        selectedFiles.reduce((acc, f) => acc + f.size, 0),
                      )}
                      )
                    </span>
                    <button
                      type="button"
                      className="text-[11px] text-rose-500 hover:underline cursor-pointer"
                      onClick={() => setSelectedFiles([])}
                    >
                      Hapus Semua
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {selectedFiles.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-card text-xs gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {getFileIcon(f.name)}
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {f.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatFileSize(f.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-rose-600 shrink-0 cursor-pointer"
                          disabled={isSubmitting}
                          onClick={() => handleRemoveFile(f.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Notes Textarea (Optional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Catatan Pengujian Site & Serah Terima{" "}
                <span className="text-muted-foreground font-normal">
                  (Opsional)
                </span>
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Masukkan catatan pengujian site & serah terima..."
                className="text-xs min-h-20 resize-y mt-2"
                disabled={isSubmitting}
              />
            </div>

            {/* Submission Progress / Status banner */}
            {isSubmitting && uploadStatusText && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs font-medium text-primary animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{uploadStatusText}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="pt-3 border-t border-border/50 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="text-xs h-9 cursor-pointer"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {isClosed ? "Tutup" : "Batal"}
          </Button>

          {!isClosed && (
            <Button
              type="button"
              className="text-xs h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              disabled={isSubmitting || selectedFiles.length === 0}
              onClick={handleSubmitClosing}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memproses Penutupan...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Submit Berita Acara & Tutup Proyek</span>
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
