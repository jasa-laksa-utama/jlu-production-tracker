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
  CheckCircle2,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { QCReceiptReportPDF } from "./qc-receipt-report-pdf";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-semibold">Menyiapkan Laporan PDF...</p>
      </div>
    ),
  }
);

interface QCReceiptReportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: any | null;
}

export function QCReceiptReportPreviewDialog({
  open,
  onOpenChange,
  purchaseOrder,
}: QCReceiptReportPreviewDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!purchaseOrder) return null;

  const reportNo =
    purchaseOrder.qcReportNumber ||
    `QCR-${purchaseOrder.nomorPO?.replace(/[^a-zA-Z0-9-]/g, "") || "PO"}`;

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const { pdf } = await import("@react-pdf/renderer");
      const blob = await pdf(
        <QCReceiptReportPDF purchaseOrder={purchaseOrder} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Laporan_QC_${reportNo}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Gagal mendownload PDF:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl! w-full p-0 overflow-hidden flex flex-col h-[90vh] bg-background border-border shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 border-b border-border/80 flex flex-row items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Berita Acara QC Penerimaan Barang</span>
                <Badge
                  variant="outline"
                  className="font-mono text-xs font-bold"
                >
                  {reportNo}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                PO: <span className="font-semibold text-foreground">{purchaseOrder.nomorPO}</span> • Supplier: {purchaseOrder.kepada || "-"}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 pr-6">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading}
              className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Download PDF
            </Button>
          </div>
        </DialogHeader>

        {/* PDF Viewer Canvas */}
        <div className="flex-1 w-full bg-slate-900 overflow-hidden">
          <PDFViewer
            width="100%"
            height="100%"
            className="border-none w-full h-full"
            showToolbar={true}
          >
            <QCReceiptReportPDF purchaseOrder={purchaseOrder} />
          </PDFViewer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
