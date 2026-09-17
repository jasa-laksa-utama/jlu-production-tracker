"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Camera,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  ExternalLink,
  ImageIcon,
  Sparkles,
  Calendar,
  User,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  compressImageToWebP,
  formatFileSize,
  CompressionResult,
} from "@/lib/image-compression";
import {
  createProgressPhotoUploadUrl,
  recordStageProgressWithDoc,
  getProgressPhotos,
} from "@/app/actions/progress-photos";

export interface StageProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName?: string;
  unitId: string;
  unitName: string;
  componentId: string;
  componentName: string;
  componentType: "STRUCTURE" | "MECHANICAL";
  stage: string; // "CUTTING", "SETTING", "WELDING", "FINISHING", "PAINTING", "PACKAGING", "PROCUREMENT", "PO", "FABRICATION"
  stageLabel: string; // "Cutting", "Welding", dll
  currentQty: number;
  totalQty: number;
  isInitiallyChecked: boolean;
  onSuccess?: () => void;
}

interface QueuedPhotoItem {
  id: string;
  file: File;
  compression: CompressionResult;
}

export function StageProgressDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  unitId,
  unitName,
  componentId,
  componentName,
  componentType,
  stage,
  stageLabel,
  currentQty,
  totalQty,
  isInitiallyChecked,
  onSuccess,
}: StageProgressDialogProps) {
  const [isChecked, setIsChecked] = useState<boolean>(isInitiallyChecked);
  const [notes, setNotes] = useState<string>("");
  const [queuedPhotos, setQueuedPhotos] = useState<QueuedPhotoItem[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<any[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initial checked state when dialog opens
  useEffect(() => {
    if (open) {
      setIsChecked(isInitiallyChecked);
      setNotes("");
      setQueuedPhotos([]);
      loadExistingPhotos();
    }
  }, [open, componentId, stage, isInitiallyChecked]);

  // Load photos already uploaded for this specific component and stage
  const loadExistingPhotos = async () => {
    setIsLoadingExisting(true);
    try {
      const res = await getProgressPhotos({
        projectId,
        componentId,
        stage: stage.toUpperCase(),
      });
      if (res.success && res.data) {
        setExistingPhotos(res.data);
      } else {
        setExistingPhotos([]);
      }
    } catch {
      setExistingPhotos([]);
    } finally {
      setIsLoadingExisting(false);
    }
  };

  // Handle multiple image selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    toast.loading(`Mengompresi ${files.length} foto...`, {
      id: "compress-stage",
    });

    try {
      const newItems: QueuedPhotoItem[] = [];
      for (const file of files) {
        const comp = await compressImageToWebP(file, {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.82,
        });
        newItems.push({
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          file: comp.file,
          compression: comp,
        });
      }

      setQueuedPhotos((prev) => [...prev, ...newItems]);
      toast.dismiss("compress-stage");
      toast.success(`${files.length} foto berhasil ditambahkan`);
    } catch (err: any) {
      toast.dismiss("compress-stage");
      toast.error("Gagal memproses file foto");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeQueuedPhoto = (id: string) => {
    setQueuedPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Submit progress + optional note + optional photo(s)
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const uploadedPhotosList: Array<{
        photoUrl: string;
        fileName: string;
        fileSize: number;
      }> = [];

      // 1. If user selected photos, upload them to Supabase Storage
      if (queuedPhotos.length > 0) {
        toast.loading(`Mengunggah ${queuedPhotos.length} foto bukti...`, {
          id: "upload-stage",
        });

        for (let i = 0; i < queuedPhotos.length; i++) {
          const item = queuedPhotos[i];
          const uploadUrlRes = await createProgressPhotoUploadUrl(
            projectId,
            item.file.name,
            unitId,
            "FABRICATION",
            componentId,
            componentType,
            componentName,
            stage,
          );

          if (!uploadUrlRes.success || !uploadUrlRes.uploadUrl) {
            throw new Error(
              uploadUrlRes.error ||
                `Gagal mendapatkan URL upload untuk foto "${item.file.name}"`,
            );
          }

          const uploadRes = await fetch(uploadUrlRes.uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": item.file.type || "image/webp",
            },
            body: item.file,
          });

          if (!uploadRes.ok) {
            throw new Error(
              `Gagal mengunggah file foto "${item.file.name}" ke server`,
            );
          }

          uploadedPhotosList.push({
            photoUrl: uploadUrlRes.path || "",
            fileName: item.file.name,
            fileSize: item.compression.compressedSize,
          });
        }

        toast.dismiss("upload-stage");
      }

      // 2. Record stage progress + optional documentation
      const res = await recordStageProgressWithDoc({
        projectId,
        unitId,
        componentId,
        componentType,
        componentName,
        stage,
        isDone: isChecked,
        qty: isChecked ? totalQty : 0,
        notes: notes.trim() || undefined,
        photos: uploadedPhotosList,
        photoUrl: uploadedPhotosList[0]?.photoUrl,
        fileName: uploadedPhotosList[0]?.fileName,
        fileSize: uploadedPhotosList[0]?.fileSize,
      });

      if (!res.success) {
        throw new Error(res.error || "Gagal menyimpan progres tahapan");
      }

      toast.success(
        `Tahap ${stageLabel} berhasil ${isChecked ? "ditandai selesai" : "di-reset"}!`,
      );
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.dismiss("upload-stage");
      toast.error(err.message || "Terjadi kesalahan saat menyimpan");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden sm:rounded-xl">
        <DialogHeader className="p-4 pb-3 bg-muted/20 border-b">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-xs font-semibold bg-primary/10 text-primary border-primary/30"
            >
              Tahapan: {stageLabel}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {componentType === "STRUCTURE" ? "Struktur" : "Mekanikal"}
            </Badge>
          </div>
          <DialogTitle className="text-base font-bold mt-1 text-foreground leading-tight">
            {componentName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Unit Conveyor:{" "}
            <span className="font-semibold text-foreground">{unitName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Status Selesai / Toggle */}
          <div
            onClick={() => setIsChecked(!isChecked)}
            className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between select-none ${
              isChecked
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
                : "bg-muted/30 border-border hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <Checkbox
                checked={isChecked}
                onCheckedChange={(c) => setIsChecked(!!c)}
                className="w-4 h-4 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
              />
              <div>
                <p className="text-xs font-bold leading-none">
                  {isChecked ? "Tahap Ditandai Selesai" : "Tahap Belum Selesai"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Volume: {isChecked ? totalQty : 0} / {totalQty} set
                </p>
              </div>
            </div>
            {isChecked && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
          </div>

          {/* Catatan Lapangan (Opsional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">
                Catatan Pengerjaan
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Opsional
              </span>
            </div>
            <Textarea
              placeholder="Contoh: Material UNP dipotong presisi, hasil las rapi tanpa undercut..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs min-h-16"
            />
          </div>

          {/* Upload Foto Bukti (Bisa lebih dari 1 foto) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">
                Bukti Foto Pengerjaan
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Opsional
              </span>
            </div>

            {queuedPhotos.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground">
                    Foto Siap Diunggah ({queuedPhotos.length})
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10.5px] px-2 py-0 gap-1 text-primary hover:text-primary border-primary/30 hover:bg-primary/10"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus className="w-3 h-3" /> Tambah Foto
                  </Button>
                </div>

                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-0.5">
                  {queuedPhotos.map((item, idx) => (
                    <div
                      key={item.id}
                      className="relative rounded-lg border overflow-hidden bg-muted/30 p-2 flex items-center gap-2.5 transition-all hover:bg-muted/50"
                    >
                      <img
                        src={item.compression.previewUrl}
                        alt={`Preview ${idx + 1}`}
                        className="w-12 h-12 object-cover rounded-md border shrink-0 bg-black/5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate text-foreground leading-snug">
                          {item.file.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10.5px] text-muted-foreground">
                            {formatFileSize(item.compression.compressedSize)}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1 py-0 h-4"
                          >
                            WebP
                          </Badge>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => removeQueuedPhoto(item.id)}
                        title="Hapus foto ini"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border/80 hover:border-primary/50 hover:bg-primary/5 rounded-lg p-3 text-center cursor-pointer transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
                  <Camera className="w-4 h-4 text-primary" />
                  <span>Ambil Foto Kamera / Pilih File Foto</span>
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  Mendukung banyak foto sekaligus • Otomatis WebP
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Riwayat Foto Tahapan yang Sudah Ada Sebelumnya */}
          {existingPhotos.filter((p) => !!p.url).length > 0 && (
            <div className="pt-2 border-t space-y-2">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Dokumentasi Sebelumnya (
                {existingPhotos.filter((p) => !!p.url).length})
              </p>
              <div className="grid grid-cols-2 gap-2">
                {existingPhotos
                  .filter((p) => !!p.url)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="border rounded-md p-1.5 bg-muted/20 text-xs space-y-1"
                    >
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block relative aspect-video rounded overflow-hidden bg-black/10 group cursor-pointer"
                      >
                        <img
                          src={p.url}
                          alt="Bukti foto"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-medium gap-1">
                          <ExternalLink className="w-3 h-3" /> Perbesar
                        </div>
                      </a>
                      {p.caption && (
                        <p className="text-[10.5px] text-foreground font-medium line-clamp-2 italic">
                          "{p.caption}"
                        </p>
                      )}
                      <div className="flex items-center justify-between text-[9.5px] text-muted-foreground pt-0.5 border-t border-border/40">
                        <span>{p.uploadedBy || "Produksi"}</span>
                        <span>
                          {new Date(p.createdAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer dengan padding proporsional tanpa terpotong margin negatif */}
        <div className="px-4 py-3 bg-muted/20 border-t flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-8 px-4"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            className="text-xs h-8 px-4 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xs"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Simpan Progres
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
