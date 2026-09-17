"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Camera,
  ExternalLink,
  Calendar,
  User,
  X,
  FileText,
  Image as ImageIcon,
} from "lucide-react";

export interface StageDocViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  componentName: string;
  unitName?: string;
  stageName: string;
  photos: any[];
}

export function StageDocViewerDialog({
  open,
  onOpenChange,
  componentName,
  unitName,
  stageName,
  photos = [],
}: StageDocViewerDialogProps) {
  const [activePhoto, setActivePhoto] = useState<any | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden sm:rounded-xl">
        <DialogHeader className="p-4 pb-3 bg-muted/20 border-b">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-wider font-bold bg-primary/10 text-primary border-primary/30"
            >
              Bukti Tahapan: {stageName}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {photos.length} Dokumentasi
            </Badge>
          </div>
          <DialogTitle className="text-base font-bold mt-1 text-foreground leading-tight">
            {componentName}
          </DialogTitle>
          {unitName && (
            <DialogDescription className="text-xs text-muted-foreground">
              Unit Conveyor: <span className="font-semibold text-foreground">{unitName}</span>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="p-4 max-h-[75vh] overflow-y-auto space-y-4">
          {photos.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
              <Camera className="w-8 h-8 mx-auto text-muted-foreground/40" />
              <p className="font-medium">Belum ada foto atau catatan yang diunggah untuk tahap ini.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* If user clicked a specific photo to view enlarged */}
              {activePhoto && (
                <div className="border rounded-xl p-3 bg-muted/30 space-y-2 relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setActivePhoto(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <div className="aspect-video w-full rounded-lg overflow-hidden bg-black/5 flex items-center justify-center">
                    <img
                      src={activePhoto.url}
                      alt="Enlarged preview"
                      className="max-h-[380px] w-auto object-contain rounded-md"
                    />
                  </div>
                  {activePhoto.caption && (
                    <div className="flex items-start gap-2 bg-background p-2.5 rounded-lg border text-xs">
                      <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-foreground italic">"{activePhoto.caption}"</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 px-1">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> Oleh: {activePhoto.uploadedBy || "Produksi"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(activePhoto.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              )}

              {/* Grid thumbnail list */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((photo, idx) => (
                  <div
                    key={photo.id || idx}
                    onClick={() => setActivePhoto(photo)}
                    className="border rounded-lg p-2 bg-card hover:border-primary/50 hover:shadow-xs transition-all cursor-pointer group space-y-1.5"
                  >
                    <div className="aspect-video relative rounded-md overflow-hidden bg-black/10">
                      <img
                        src={photo.url}
                        alt="Bukti foto"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-medium gap-1">
                        <ExternalLink className="w-3 h-3" /> Klik untuk perbesar
                      </div>
                    </div>

                    {photo.caption ? (
                      <p className="text-[11px] text-foreground font-medium line-clamp-2 italic">
                        "{photo.caption}"
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground italic">Tanpa catatan</p>
                    )}

                    <div className="flex items-center justify-between text-[9.5px] text-muted-foreground pt-1 border-t border-border/40">
                      <span className="truncate">{photo.uploadedBy || "Produksi"}</span>
                      <span>
                        {new Date(photo.createdAt).toLocaleDateString("id-ID", {
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
      </DialogContent>
    </Dialog>
  );
}
