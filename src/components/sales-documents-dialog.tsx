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
import { formatJakartaDate } from "@/lib/date-utils";
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
  CheckCircle2,
  Loader2,
  FolderOpen,
  X,
  AlertCircle,
  Copy,
  Check,
  Receipt,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createDocumentUploadUrl,
  saveDocumentRecord,
  getSalesDocuments,
  getDocumentDownloadUrl,
} from "@/app/actions/documents";
import { format } from "date-fns";

const SALES_CATEGORIES = [
  { id: "PO", label: "Purchase Order", icon: <Receipt className="w-4 h-4" /> },
  {
    id: "OFFERING",
    label: "Bukti Penawaran",
    icon: <Mail className="w-4 h-4" />,
  },
] as const;

interface SalesDocumentsDialogProps {
  ownerId: string;
  ownerType: "LEAD" | "PROJECT";
  leadId?: string | null;
  onUploadSuccess?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

function CategorySection({
  ownerId,
  ownerType,
  category,
  documents,
  onUploadSuccess,
  leadId,
}: {
  ownerId: string;
  ownerType: "LEAD" | "PROJECT";
  category: (typeof SALES_CATEGORIES)[number];
  documents: DocumentRecord[];
  onUploadSuccess: () => void;
  leadId?: string | null;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
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
      return;
    }
    setSelectedFile(file);
    e.target.value = "";
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);

    try {
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

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: selectedFile,
        headers: { "Content-Type": selectedFile.type },
      });

      if (!uploadRes.ok) throw new Error("Gagal mengupload file");

      const result = await saveDocumentRecord({
        leadId: (ownerType === "LEAD"
          ? ownerId
          : leadId || undefined) as string,
        projectId: ownerType === "PROJECT" ? ownerId : undefined,
        category: category.id,
        url: path,
        fileName: selectedFile.name,
        version: version || 1,
        notes: revisionNotes.trim() || `Upload v${version || 1}`,
      });

      if (result.success) {
        toast.success(`${category.label} v${version} berhasil diupload!`);
        setSelectedFile(null);
        setRevisionNotes("");
        onUploadSuccess();
      } else {
        throw new Error("Gagal menyimpan record");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
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

  return (
    <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-primary">{category.icon}</span>
          <span className="font-semibold text-sm">{category.label}</span>
          {latestDoc && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold",
                isNew ? "bg-green-500/10 text-green-600 border-green-200" : "",
              )}
            >
              v{latestDoc.version} {isNew && "• NEW"}
            </Badge>
          )}
        </div>
        {sortedDocs.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] font-bold cursor-pointer"
            onClick={() => setShowHistory(!showHistory)}
          >
            {sortedDocs.length} Versi{" "}
            {showHistory ? (
              <ChevronDown className="ml-1 w-3 h-3" />
            ) : (
              <ChevronRight className="ml-1 w-3 h-3" />
            )}
          </Button>
        )}
      </div>

      <div className="p-4 space-y-3">
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
                <p className="text-[10px] text-muted-foreground italic truncate">
                  {formatJakartaDate(latestDoc.createdAt, "datetime")}{" "}
                  • by {latestDoc.uploadedBy || "System"}
                </p>
                {latestDoc.notes && (
                  <p className="text-[10px] text-muted-foreground mt-1 bg-muted/40 px-1.5 py-0.5 rounded inline-block">
                    Note: {latestDoc.notes}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 cursor-pointer"
              disabled={!!isDownloading}
              onClick={() => handleDownload(latestDoc)}
            >
              {isDownloading === latestDoc.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : latestDoc.isExternal ? (
                <ExternalLink className="w-3 h-3" />
              ) : (
                <Download className="w-3 h-3" />
              )}
            </Button>
          </div>
        ) : (
          <div className="p-4 text-center border border-dashed rounded-md bg-muted/10">
            <p className="text-[10px] text-muted-foreground font-medium">
              Belum ada dokumen {category.label}
            </p>
          </div>
        )}

        {showHistory &&
          sortedDocs.slice(1).map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-2 rounded-md bg-muted/20 text-[10px]"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                {doc.isExternal ? (
                  <ExternalLink className="w-3 h-3 text-blue-500 shrink-0" />
                ) : (
                  <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                    v{doc.version}
                  </Badge>
                )}
                <span className="truncate max-w-37.5">{doc.fileName}</span>
                <span className="text-muted-foreground">
                  {formatJakartaDate(doc.createdAt, "short")}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 cursor-pointer"
                onClick={() => handleDownload(doc)}
              >
                {doc.isExternal ? (
                  <ExternalLink className="w-3 h-3" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
              </Button>
            </div>
          ))}

        <div className="space-y-2 pt-2">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col w-full gap-2">
              {selectedFile ? (
                <div className="flex-1 flex items-center gap-2 bg-muted/40 p-1 rounded-md border text-[10px]">
                  <span className="truncate flex-1 pl-1">
                    {selectedFile.name}
                  </span>
                  <Button
                    size="sm"
                    className="h-6 px-2 text-[9px]"
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
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-dashed border-border text-[10px] text-muted-foreground hover:bg-muted/30 cursor-pointer transition-colors">
                  <UploadCloud className="w-3 h-3" />
                  Pilih File...
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                  />
                </label>
              )}

              <div className="flex items-center gap-1 flex-1">
                <Input
                  placeholder="atau Paste URL..."
                  className="h-7 text-[10px] bg-background/50"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  disabled={isUploading}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 cursor-pointer"
                  disabled={!linkInput.trim() || isUploading}
                  onClick={handleLinkSave}
                >
                  <LinkIcon className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
          <Input
            placeholder="Catatan (opsional)..."
            className="h-7 text-[10px] bg-background/50"
            value={revisionNotes}
            onChange={(e) => setRevisionNotes(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

export function SalesDocumentsDialog({
  ownerId,
  ownerType,
  leadId,
  onUploadSuccess,
  open,
  onOpenChange,
}: SalesDocumentsDialogProps) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDocs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getSalesDocuments(
        ownerId,
        ownerType,
        leadId || undefined,
      );
      if (res.success && res.data) {
        setDocuments(res.data as unknown as DocumentRecord[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [ownerId, ownerType, leadId]);

  useEffect(() => {
    if (open) fetchDocs();
  }, [open, fetchDocs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Sales & Marketing Documents
          </DialogTitle>
          <DialogDescription>
            Upload Purchase Order dan Bukti Penawaran
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            SALES_CATEGORIES.map((cat) => (
              <CategorySection
                key={cat.id}
                category={cat}
                ownerId={ownerId}
                ownerType={ownerType}
                leadId={leadId}
                documents={documents}
                onUploadSuccess={() => {
                  fetchDocs();
                  onUploadSuccess?.();
                }}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
