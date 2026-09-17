"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Download,
  Printer,
  Loader2,
  Tag,
  CheckCircle2,
} from "lucide-react";
import { MarkingPDFDocument } from "./marking-pdf-document";
import { MarkingOverviewItem } from "@/app/actions/marking-management";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-[72vh] gap-3 text-muted-foreground bg-muted/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-semibold">Menyiapkan Lembar Kontrol Marking PDF...</p>
        <p className="text-xs text-muted-foreground">Menata tata letak dokumen landscape...</p>
      </div>
    ),
  }
);

export interface MarkingPDFPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName?: string;
  items: MarkingOverviewItem[];
  unitFilterName?: string;
  typeFilterName?: string;
}

export function MarkingPDFPreviewDialog({
  open,
  onOpenChange,
  projectName = "Proyek Produksi JLU",
  items,
  unitFilterName = "Semua Unit",
  typeFilterName = "Semua Level",
}: MarkingPDFPreviewDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const totalMarked = items.filter((i) => Boolean(i.markingCode)).length;
  const totalItems = items.length;
  const markedPercent =
    totalItems > 0 ? Math.round((totalMarked / totalItems) * 100) : 0;

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const { pdf } = await import("@react-pdf/renderer");
      const blob = await pdf(
        <MarkingPDFDocument
          projectName={projectName}
          items={items}
          unitFilterName={unitFilterName}
          typeFilterName={typeFilterName}
          totalMarkedCount={totalMarked}
          totalItemCount={totalItems}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeProjectName = projectName.replace(/[^a-zA-Z0-9_-]/g, "_");
      link.download = `Lembar_Marking_${safeProjectName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Gagal mendownload PDF lembar marking:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl! w-[96vw] p-0 overflow-hidden flex flex-col h-[92vh] bg-background border-border shadow-2xl rounded-2xl">
        {/* Dialog Header */}
        <DialogHeader className="p-4 px-6 border-b border-border/80 flex flex-row items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Cetak Lembar Kontrol Kode Marking</span>
                <Badge
                  variant="outline"
                  className="font-mono text-xs font-bold bg-primary/5 text-primary border-primary/20"
                >
                  {items.length} Part
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Proyek: <span className="font-semibold text-foreground">{projectName}</span> • Filter: {unitFilterName} ({typeFilterName}) • Ter-Marking: <span className="text-emerald-600 font-semibold">{totalMarked}/{totalItems} ({markedPercent}%)</span>
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 pr-6">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading}
              className="h-8 text-xs font-bold gap-1.5 cursor-pointer shadow-sm"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Unduh PDF
            </Button>
          </div>
        </DialogHeader>

        {/* PDF Viewer */}
        <div className="flex-1 w-full bg-muted/40 p-2 overflow-hidden">
          {open && (
            <PDFViewer
              width="100%"
              height="100%"
              showToolbar={true}
              className="border-none rounded-xl overflow-hidden shadow-inner"
            >
              <MarkingPDFDocument
                projectName={projectName}
                items={items}
                unitFilterName={unitFilterName}
                typeFilterName={typeFilterName}
                totalMarkedCount={totalMarked}
                totalItemCount={totalItems}
              />
            </PDFViewer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
