"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Printer,
  Download,
  Loader2,
  Calendar,
  CheckCircle2,
  Layers,
  FileText,
  CheckSquare,
  Square,
  SlidersHorizontal,
  FolderDown,
  X,
  AlertCircle,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  WeeklyReportPDF,
  REPORT_SECTIONS,
  SummaryRowItem,
} from "./weekly-report-pdf";
import { getProgressPhotos } from "@/app/actions/progress-photos";
import { SCurveWeekHeader } from "@/lib/s-curve-calculator";

// Client-only dynamic import of PDFViewer to avoid server-side SSR issues
const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-[520px] gap-2.5 text-muted-foreground">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-xs font-semibold text-foreground/80">
          Membuat pratinjau dokumen PDF...
        </p>
      </div>
    ),
  }
);

interface WeeklyReportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
  masterplan?: any;
  units?: any[];
  rows: SummaryRowItem[];
  totalRow: {
    bobot: number;
    mingguLaluBobot: number;
    mingguIniBobot: number;
    sdMingguIniBobot: number;
  };
  initialWeekNum?: number;
  weekHeaders?: SCurveWeekHeader[];
}

const ALL_SECTION_IDS = REPORT_SECTIONS.map((s) => s.id);

export function WeeklyReportPreviewDialog({
  open,
  onOpenChange,
  project,
  masterplan,
  units = [],
  rows = [],
  totalRow,
  initialWeekNum = 1,
  weekHeaders = [],
}: WeeklyReportPreviewDialogProps) {
  // Mode: "ALL" (Opsi 1) vs "CUSTOM" (Opsi 2)
  const [downloadMode, setDownloadMode] = useState<"ALL" | "CUSTOM">("ALL");

  // Selected sections for Opsi 2 (defaults to all sections)
  const [selectedSections, setSelectedSections] = useState<string[]>(ALL_SECTION_IDS);

  // Selected week number
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(initialWeekNum);

  // Photos loaded for the project
  const [photos, setPhotos] = useState<any[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState<boolean>(false);

  // Downloading PDF Blob state
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Optional Client Company Logo (base64 Data URL)
  const [clientLogo, setClientLogo] = useState<string | null>(null);

  // Preload JLU logo as base64 for instant & bulletproof PDF rendering
  const [jluLogoBase64, setJluLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    fetch("/jlu-logo-removebg.png")
      .then((res) => res.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            setJluLogoBase64(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      })
      .catch((err) => {
        console.warn("Gagal memuat base64 logo JLU:", err);
      });
  }, []);

  const handleClientLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran logo maksimal 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setClientLogo(reader.result);
        toast.success("Logo klien berhasil dipasang pada cover laporan.");
      }
    };
    reader.readAsDataURL(file);
  };

  // Synchronize week number when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedWeekNum(initialWeekNum);
    }
  }, [open, initialWeekNum]);

  // Load progress photos on open
  useEffect(() => {
    if (!open || !project?.id) return;
    let isCancelled = false;

    async function fetchPhotos() {
      try {
        setLoadingPhotos(true);
        const res = await getProgressPhotos({ projectId: project.id });
        if (!isCancelled && res?.data) {
          setPhotos(res.data);
        }
      } catch (err) {
        console.error("Gagal mengambil foto progress:", err);
      } finally {
        if (!isCancelled) {
          setLoadingPhotos(false);
        }
      }
    }

    fetchPhotos();
    return () => {
      isCancelled = true;
    };
  }, [open, project?.id]);

  // Active section list based on selected mode
  const activeSections = useMemo(() => {
    if (downloadMode === "ALL") {
      return ALL_SECTION_IDS;
    }
    return selectedSections;
  }, [downloadMode, selectedSections]);

  // Current week header label
  const activeWeekHeader = useMemo(() => {
    return (
      weekHeaders.find((w) => w.weekNumber === selectedWeekNum) ||
      weekHeaders[0] || {
        weekNumber: selectedWeekNum,
        dateRange: "-",
        monthName: "",
      }
    );
  }, [weekHeaders, selectedWeekNum]);

  const periodWeekLabel = `Minggu #${activeWeekHeader.weekNumber} (${activeWeekHeader.dateRange} ${activeWeekHeader.monthName})`;

  const periodDateRange = useMemo(() => {
    if (!activeWeekHeader) return "";
    if (activeWeekHeader.startDate && activeWeekHeader.endDate) {
      const s = new Date(activeWeekHeader.startDate).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const e = new Date(activeWeekHeader.endDate).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      return `${s} - ${e}`;
    }
    return `${activeWeekHeader.dateRange} ${activeWeekHeader.monthName}`;
  }, [activeWeekHeader]);

  const jluLogoUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/jlu-logo-removebg.png`
      : "/jlu-logo-removebg.png";

  // Toggle single section in custom mode
  const handleToggleSection = (sectionId: string) => {
    setSelectedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  // Select all sections in custom mode
  const handleSelectAll = () => {
    setSelectedSections(ALL_SECTION_IDS);
  };

  // Deselect all sections in custom mode
  const handleClearAll = () => {
    setSelectedSections([]);
  };

  // Handle PDF Download
  const handleDownloadPDF = async () => {
    if (activeSections.length === 0) {
      toast.error("Pilih minimal satu bagian laporan untuk diunduh.");
      return;
    }

    try {
      setIsDownloading(true);
      const { pdf } = await import("@react-pdf/renderer");

      const projectNo = (project?.projectNumber || "PRJ").replace(/[^a-zA-Z0-9_-]/g, "");
      const modeSlug = downloadMode === "ALL" ? "Full" : "Kustom";
      const fileName = `Weekly_Report_Wk${selectedWeekNum}_${projectNo}_${modeSlug}.pdf`;

      const blob = await pdf(
        <WeeklyReportPDF
          project={project}
          masterplan={masterplan}
          units={units}
          rows={rows}
          totalRow={totalRow}
          photos={photos}
          selectedSections={activeSections}
          selectedWeekNum={selectedWeekNum}
          periodWeekLabel={periodWeekLabel}
          periodDateRange={periodDateRange}
          clientLogo={clientLogo}
          jluLogoUrl={jluLogoBase64 || jluLogoUrl}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Laporan mingguan berhasil diunduh: ${fileName}`);
    } catch (err) {
      console.error("Gagal mendownload PDF Laporan Mingguan:", err);
      toast.error("Terjadi kesalahan saat memproses file PDF.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw]! w-full p-0 overflow-hidden flex flex-col h-[94vh] bg-background border-border shadow-2xl rounded-2xl">
        {/* Header Bar */}
        <DialogHeader className="p-3.5 sm:px-6 border-b border-border/80 flex flex-row items-center justify-between gap-3 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                <span>Cetak Dokumen Laporan Mingguan</span>
                <Badge variant="outline" className="font-semibold text-xs py-0.5">
                  Minggu #{selectedWeekNum}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {project?.projectNumber ? `${project.projectNumber} : ` : ""}
                {project?.projectName || "Proyek Fabrikasi"}
              </DialogDescription>
            </div>
          </div>

          {/* Quick Week Selector & Download Button */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-background border border-border/80 rounded-xl px-2.5 py-1 text-xs shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="font-semibold text-muted-foreground text-[11px]">Periode:</span>
              <select
                value={selectedWeekNum}
                onChange={(e) => setSelectedWeekNum(Number(e.target.value))}
                className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer pr-1 text-xs"
              >
                {weekHeaders.map((wh) => (
                  <option
                    key={wh.weekNumber}
                    value={wh.weekNumber}
                    className="bg-popover text-popover-foreground"
                  >
                    Wk #{wh.weekNumber} ({wh.dateRange} {wh.monthName})
                  </option>
                ))}
              </select>
            </div>

            <Button
              size="sm"
              onClick={handleDownloadPDF}
              disabled={isDownloading || activeSections.length === 0}
              className="h-8 px-3.5 text-xs font-bold gap-1.5 rounded-xl cursor-pointer shadow-xs"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengunduh...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh PDF</span>
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        {/* Main Body: Left Sidebar (Menu Setting / Konfigurasi) + Right Area (PDF Preview Full) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Left Sidebar: Compact Configuration Panel */}
          <div className="w-full md:w-72 lg:w-80 shrink-0 border-r border-border/70 bg-muted/10 flex flex-col overflow-y-auto p-4 space-y-4">
            <div>
              <h4 className="text-xs font-bold text-foreground mb-1.5">
                Mode Cetak Dokumen
              </h4>
              {/* Mode Toggle Buttons */}
              <div className="flex flex-col gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60">
                <button
                  type="button"
                  onClick={() => setDownloadMode("ALL")}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-between text-left ${
                    downloadMode === "ALL"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FolderDown className="w-3.5 h-3.5 text-primary" />
                    <span>Opsi 1: Unduh Semua</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-bold py-0 px-1.5">
                    9 Bagian
                  </Badge>
                </button>

                <button
                  type="button"
                  onClick={() => setDownloadMode("CUSTOM")}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-between text-left ${
                    downloadMode === "CUSTOM"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                    <span>Opsi 2: Kustom Pilihan</span>
                  </div>
                  {downloadMode === "CUSTOM" && (
                    <Badge variant="outline" className="text-[10px] font-bold py-0 px-1.5">
                      {selectedSections.length} Aktif
                    </Badge>
                  )}
                </button>
              </div>
            </div>

            {/* Mode Details */}
            {downloadMode === "ALL" ? (
              <div className="p-3 rounded-xl border border-border/70 bg-background/60 space-y-2 text-xs">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Seluruh Dokumen Lengkap</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Menyertakan seluruh 9 bagian laporan mingguan: Cover, S-Curve, Summary Progress, Rekapitulasi Bobot, Structure & Mechanical, Detail Struktur, Detail Mekanikal, Detail Ereksi, dan Dokumentasi Foto.
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col space-y-2 min-h-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    Pilih Lembar Laporan
                  </span>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-primary hover:underline font-semibold cursor-pointer"
                    >
                      Semua
                    </button>
                    <span className="text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-muted-foreground hover:text-destructive font-semibold cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>

                {/* Compact Checkbox List */}
                <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
                  {REPORT_SECTIONS.map((sec, sIdx) => {
                    const isChecked = selectedSections.includes(sec.id);
                    return (
                      <label
                        key={sec.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer text-xs ${
                          isChecked
                            ? "bg-primary/5 border-primary/40 text-foreground"
                            : "bg-background border-border/60 text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleToggleSection(sec.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-xs truncate">
                            <span className="font-mono text-[10px] text-muted-foreground mr-1">
                              #{sIdx + 1}
                            </span>
                            {sec.label}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Logo Settings Section */}
            <div className="pt-2 border-t border-border/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-primary" />
                  Logo Lembar Cover
                </span>
              </div>

              {/* Logo JLU (Bawaan Sistem dari public/) */}
              <div className="p-2 rounded-xl border border-border/70 bg-background/60 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src="/jlu-logo-removebg.png"
                    alt="Logo JLU"
                    className="h-6 w-auto max-w-[28px] object-contain shrink-0"
                  />
                  <div className="truncate">
                    <p className="font-semibold text-foreground text-[11px] truncate">PT. Jasa Laksa Utama</p>
                    <p className="text-[10px] text-muted-foreground truncate">public/jlu-logo-removebg.png</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px] text-emerald-600 font-bold border-emerald-500/30 shrink-0">
                  Otomatis
                </Badge>
              </div>

              {/* Logo Klien (Opsional) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Logo Klien (Opsional)
                  </span>
                  {clientLogo && (
                    <button
                      type="button"
                      onClick={() => setClientLogo(null)}
                      className="text-[10px] text-destructive hover:underline font-semibold cursor-pointer"
                    >
                      Hapus
                    </button>
                  )}
                </div>

                {clientLogo ? (
                  <div className="p-2 rounded-xl border border-primary/30 bg-background flex items-center justify-between gap-2">
                    <img
                      src={clientLogo}
                      alt="Logo Client"
                      className="h-8 w-auto max-w-[110px] object-contain rounded"
                    />
                    <Badge variant="outline" className="text-[10px] text-emerald-600 font-bold border-emerald-500/30">
                      Terpasang
                    </Badge>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-2 rounded-xl border border-dashed border-border/80 hover:border-primary/50 bg-background/50 hover:bg-muted/30 cursor-pointer transition-colors text-xs text-muted-foreground">
                    <Upload className="w-3.5 h-3.5 text-primary" />
                    <span>Unggah Logo Klien</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      className="hidden"
                      onChange={handleClientLogoUpload}
                    />
                  </label>
                )}
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Format PNG transparan direkomendasikan. Ditampilkan di kolom Owner pada sampul.
                </p>
              </div>
            </div>

            {/* Bottom Download Action for Quick Access */}
            <div className="pt-2 border-t border-border/60">
              <Button
                size="sm"
                onClick={handleDownloadPDF}
                disabled={isDownloading || activeSections.length === 0}
                className="w-full h-8 text-xs font-bold gap-1.5 rounded-xl cursor-pointer"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF ({activeSections.length} Bagian)</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right Area: PDF Preview Full Height */}
          <div className="flex-1 bg-muted/30 relative overflow-hidden flex flex-col min-h-0">
            {activeSections.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground gap-3">
                <AlertCircle className="w-8 h-8 text-amber-500" />
                <div>
                  <p className="text-sm font-bold text-foreground">
                    Tidak ada lembar laporan yang dipilih
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    Silakan centang minimal satu bagian laporan di panel sebelah kiri untuk melihat pratinjau dan mengunduh berkas PDF.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAll}
                  className="mt-1 h-8 text-xs font-semibold cursor-pointer"
                >
                  Centang Semua Bagian
                </Button>
              </div>
            ) : (
              <PDFViewer
                width="100%"
                height="100%"
                showToolbar={true}
                className="border-0 w-full h-full flex-1"
              >
                <WeeklyReportPDF
                  project={project}
                  masterplan={masterplan}
                  units={units}
                  rows={rows}
                  totalRow={totalRow}
                  photos={photos}
                  selectedSections={activeSections}
                  selectedWeekNum={selectedWeekNum}
                  periodWeekLabel={periodWeekLabel}
                  periodDateRange={periodDateRange}
                  clientLogo={clientLogo}
                  jluLogoUrl={jluLogoBase64 || jluLogoUrl}
                />
              </PDFViewer>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
