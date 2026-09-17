"use client";

import React, {
  useState,
  useEffect,
  useTransition,
  useMemo,
  useDeferredValue,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  SlidersHorizontal,
  Camera,
  Image as ImageIcon,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { getQCReportCompiledDataAction } from "@/app/actions/qc";
import { convertImageUrlToJpegDataUrl } from "@/lib/image-compression";
import { ProgressPhotoDialog } from "./progress-photo-dialog";
import {
  QCReportPDFDocument,
  QCReportData,
  getItemQCStatus,
} from "./qc-report-pdf";

// Dynamic import of PDFViewer to avoid SSR hydration issues
const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-3 bg-muted/20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs font-semibold">
          Menyiapkan Pratinjau PDF...
        </span>
      </div>
    ),
  },
);

interface QCReportDialogProps {
  project: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultUnitId?: string;
  defaultLevel?: "UNIT" | "COMPONENT";
  defaultComponentId?: string;
  defaultComponentIds?: string[];
}

export function QCReportDialog({
  project,
  open,
  onOpenChange,
  defaultUnitId,
  defaultLevel,
  defaultComponentId,
  defaultComponentIds,
}: QCReportDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [compiledData, setCompiledData] = useState<any>(null);

  const initialTargetLevel =
    defaultLevel ||
    (defaultComponentId ||
    (defaultComponentIds && defaultComponentIds.length > 0)
      ? "COMPONENT"
      : "UNIT");

  // 2 Report Levels: UNIT (Per Unit) or COMPONENT (Per Komponen)
  const [reportLevel, setReportLevel] = useState<"UNIT" | "COMPONENT">(
    initialTargetLevel,
  );

  // Multi-select Units: List of selected Unit IDs
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>(
    defaultUnitId && defaultUnitId !== "ALL" ? [defaultUnitId] : [],
  );

  // Active Unit focus when managing Component Selection
  const [activeUnitForComponent, setActiveUnitForComponent] = useState<string>(
    defaultUnitId && defaultUnitId !== "ALL" ? defaultUnitId : "",
  );

  // Multi-select Components: List of selected Component IDs
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>(
    defaultComponentId
      ? [defaultComponentId]
      : defaultComponentIds && defaultComponentIds.length > 0
        ? defaultComponentIds
        : [],
  );

  // Form Configuration States
  const [reportNumber, setReportNumber] = useState<string>("");
  const [inspectionDate, setInspectionDate] = useState<string>("");
  const [endFabricationDate, setEndFabricationDate] = useState<string>("");
  const [deliveryTo, setDeliveryTo] = useState<string>("PT. JASA LAKSA UTAMA");
  const [lengthSpec, setLengthSpec] = useState<string>("");
  const [widthSpec, setWidthSpec] = useState<string>("");
  const [heightSpec, setHeightSpec] = useState<string>("");
  const [qcInspector, setQCInspector] = useState<string>(
    "QC Inspector PT. JLU",
  );
  const [productionHead, setProductionHead] = useState<string>(
    "Kepala Produksi PT. JLU",
  );
  const [projectManager, setProjectManager] = useState<string>(
    "Project Manager PT. JLU",
  );
  const [isAccepted, setIsAccepted] = useState<boolean>(true);
  const [notesText, setNotesText] = useState<string>(
    "Dimensi dan kualitas pengelasan telah diperiksa serta memenuhi standar toleransi gambar kerja.",
  );

  // Photo Separation: Cover Photo vs Attachment Photos (Default: EMPTY / UNSELECTED)
  const [selectedCoverPhotoId, setSelectedCoverPhotoId] = useState<string | null>(null);
  const [selectedAttachmentPhotoIds, setSelectedAttachmentPhotoIds] = useState<string[]>([]);
  const [photoFilter, setPhotoFilter] = useState<"ALL" | "PRODUCTION" | "QC">("ALL");

  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState<boolean>(false);

  // Photos derived logic (Production vs QC)
  const allAvailablePhotos = useMemo(
    () => compiledData?.progressPhotos || [],
    [compiledData?.progressPhotos],
  );

  const qcPhotosCount = useMemo(
    () =>
      allAvailablePhotos.filter(
        (p: any) => p.isQC || p.source === "QC" || p.category === "QC_INSPECTION",
      ).length,
    [allAvailablePhotos],
  );

  const prodPhotosCount = useMemo(
    () =>
      allAvailablePhotos.filter(
        (p: any) =>
          !p.isQC && p.source !== "QC" && p.category !== "QC_INSPECTION",
      ).length,
    [allAvailablePhotos],
  );

  const filteredPhotos = useMemo(() => {
    if (photoFilter === "QC") {
      return allAvailablePhotos.filter(
        (p: any) => p.isQC || p.source === "QC" || p.category === "QC_INSPECTION",
      );
    }
    if (photoFilter === "PRODUCTION") {
      return allAvailablePhotos.filter(
        (p: any) =>
          !p.isQC && p.source !== "QC" && p.category !== "QC_INSPECTION",
      );
    }
    return allAvailablePhotos;
  }, [allAvailablePhotos, photoFilter]);

  // Synchronize unit & component states ONCE when dialog opens or default props change
  useEffect(() => {
    if (open) {
      const targetLevel =
        defaultLevel ||
        (defaultComponentId ||
        (defaultComponentIds && defaultComponentIds.length > 0)
          ? "COMPONENT"
          : "UNIT");
      setReportLevel(targetLevel);
      if (defaultUnitId && defaultUnitId !== "ALL") {
        setSelectedUnitIds([defaultUnitId]);
        setActiveUnitForComponent(defaultUnitId);
      } else {
        setSelectedUnitIds([]);
        setActiveUnitForComponent("");
      }
      if (defaultComponentId) {
        setSelectedComponentIds([defaultComponentId]);
      } else if (defaultComponentIds && defaultComponentIds.length > 0) {
        setSelectedComponentIds(defaultComponentIds);
      } else {
        setSelectedComponentIds([]);
      }
      setSelectedCoverPhotoId(null);
      setSelectedAttachmentPhotoIds([]);
    }
  }, [
    open,
    defaultUnitId,
    defaultLevel,
    defaultComponentId,
    defaultComponentIds,
  ]);

  // Fetch compiled QC report data when dialog opens, level changes, or unit/component selections change
  const loadData = () => {
    if (!project?.id || !open) return;

    startTransition(async () => {
      const uIds = selectedUnitIds.length > 0 ? selectedUnitIds : undefined;
      const cIds =
        reportLevel === "COMPONENT" && selectedComponentIds.length > 0
          ? selectedComponentIds
          : defaultComponentId
            ? [defaultComponentId]
            : defaultComponentIds && defaultComponentIds.length > 0
              ? defaultComponentIds
              : undefined;

      const res = await getQCReportCompiledDataAction(project.id, uIds, cIds);

      if (res.success && res.data) {
        setCompiledData(res.data);
        if (!reportNumber) {
          setReportNumber(res.data.autoReportNumber || "");
        }
        if (!inspectionDate) {
          setInspectionDate(new Date().toISOString().split("T")[0]);
        }
        if (!endFabricationDate) {
          setEndFabricationDate(new Date().toISOString().split("T")[0]);
        }

        // Auto calculate acceptance status:
        let hasRev = false;
        (res.data.units || []).forEach((u: any) => {
          (u.structureItems || []).forEach((item: any) => {
            const st = getItemQCStatus(
              item,
              "STRUCTURE",
              u.qcCheckpoints || [],
            );
            if (st.status === "REVISION") hasRev = true;
          });
          (u.mechanicalItems || []).forEach((item: any) => {
            const st = getItemQCStatus(
              item,
              "MECHANICAL",
              u.qcCheckpoints || [],
            );
            if (st.status === "REVISION") hasRev = true;
          });
        });

        setIsAccepted(!hasRev);

        // Fallback active unit for component if not set
        if (!activeUnitForComponent) {
          if (defaultUnitId && defaultUnitId !== "ALL") {
            setActiveUnitForComponent(defaultUnitId);
          } else if (res.data.units?.length > 0) {
            setActiveUnitForComponent(res.data.units[0].id);
          } else if (res.data.allUnitsList?.length > 0) {
            setActiveUnitForComponent(res.data.allUnitsList[0].id);
          }
        }
      } else {
        toast.error(res.error || "Gagal memuat data laporan QC");
      }
    });
  };

  // Safe dependency keys to prevent re-trigger loop on new array instances
  const unitIdsKey = selectedUnitIds.join(",");
  const compIdsKey = selectedComponentIds.join(",");

  useEffect(() => {
    if (open && project?.id) {
      loadData();
    }
  }, [open, project?.id, reportLevel, unitIdsKey, compIdsKey]);

  // Handle report level change
  const handleLevelChange = (newLevel: "UNIT" | "COMPONENT") => {
    setReportLevel(newLevel);
    if (newLevel === "UNIT") {
      if (selectedUnitIds.length === 0 && compiledData?.allUnitsList?.length > 0) {
        setSelectedUnitIds(compiledData.allUnitsList.map((u: any) => u.id));
      }
    } else if (newLevel === "COMPONENT") {
      const curUId =
        activeUnitForComponent ||
        (selectedUnitIds.length > 0 ? selectedUnitIds[0] : compiledData?.allUnitsList?.[0]?.id || "");
      setActiveUnitForComponent(curUId);
      setSelectedUnitIds([curUId]);

      if (selectedComponentIds.length === 0 && curUId) {
        const targetUnit = (compiledData?.allUnitsList || []).find(
          (u: any) => u.id === curUId,
        );
        const allCIds = [
          ...(targetUnit?.structureItems || []).map((i: any) => i.id),
          ...(targetUnit?.mechanicalItems || []).map((i: any) => i.id),
        ];
        setSelectedComponentIds(allCIds);
      }
    }
  };

  // Multi-select helpers for UNITS
  const toggleUnitSelection = (unitId: string) => {
    setSelectedUnitIds((prev) => {
      if (prev.includes(unitId)) {
        if (prev.length === 1) {
          toast.warning("Minimal harus ada 1 unit yang dipilih");
          return prev;
        }
        return prev.filter((id) => id !== unitId);
      } else {
        return [...prev, unitId];
      }
    });
  };

  const handleSelectAllUnits = () => {
    if (compiledData?.allUnitsList?.length > 0) {
      setSelectedUnitIds(compiledData.allUnitsList.map((u: any) => u.id));
    }
  };

  const handleDeselectAllUnits = () => {
    if (compiledData?.allUnitsList?.length > 0) {
      setSelectedUnitIds([compiledData.allUnitsList[0].id]);
    }
  };

  // Multi-select helpers for COMPONENTS
  const effectiveActiveUnitId =
    activeUnitForComponent ||
    (selectedUnitIds.length > 0
      ? selectedUnitIds[0]
      : compiledData?.allUnitsList?.[0]?.id || "");

  const activeUnitObj = (compiledData?.allUnitsList || []).find(
    (u: any) => u.id === effectiveActiveUnitId,
  );
  const activeUnitStructureItems = activeUnitObj?.structureItems || [];
  const activeUnitMechanicalItems = activeUnitObj?.mechanicalItems || [];

  const toggleComponentSelection = (componentId: string) => {
    setSelectedComponentIds((prev) => {
      if (prev.includes(componentId)) {
        if (prev.length === 1) {
          toast.warning("Minimal harus ada 1 komponen yang dipilih");
          return prev;
        }
        return prev.filter((id) => id !== componentId);
      } else {
        return [...prev, componentId];
      }
    });
  };

  const handleSelectAllComponentsInActiveUnit = () => {
    const allCIds = [
      ...activeUnitStructureItems.map((i: any) => i.id),
      ...activeUnitMechanicalItems.map((i: any) => i.id),
    ];
    setSelectedComponentIds(allCIds);
  };

  const handleDeselectAllComponents = () => {
    const allCIds = [
      ...activeUnitStructureItems.map((i: any) => i.id),
      ...activeUnitMechanicalItems.map((i: any) => i.id),
    ];
    if (allCIds.length > 0) {
      setSelectedComponentIds([allCIds[0]]);
    }
  };

  // Process and convert Cover & Attachment Photos to Base64 JPEG data URLs
  const [convertedCoverUrl, setConvertedCoverUrl] = useState<string | undefined>(undefined);
  const [convertedAttachmentPhotos, setConvertedAttachmentPhotos] = useState<any[]>([]);

  useEffect(() => {
    let isCancelled = false;

    async function processPhotos() {
      const allPhotos = compiledData?.progressPhotos || [];

      // 1. Process Cover Photo
      if (selectedCoverPhotoId) {
        const coverObj = allPhotos.find((p: any) => p.id === selectedCoverPhotoId);
        if (coverObj) {
          const coverDataUrl = await convertImageUrlToJpegDataUrl(coverObj.url);
          if (!isCancelled) {
            setConvertedCoverUrl(coverDataUrl || coverObj.url);
          }
        } else if (!isCancelled) {
          setConvertedCoverUrl(undefined);
        }
      } else if (!isCancelled) {
        setConvertedCoverUrl(undefined);
      }

      // 2. Process Attachment Photos
      if (selectedAttachmentPhotoIds.length > 0) {
        const targetAttachments = allPhotos.filter((p: any) =>
          selectedAttachmentPhotoIds.includes(p.id),
        );
        const results = await Promise.all(
          targetAttachments.map(async (p: any) => {
            const dataUrl = await convertImageUrlToJpegDataUrl(p.url);
            return {
              ...p,
              url: dataUrl || p.url,
            };
          }),
        );
        if (!isCancelled) {
          setConvertedAttachmentPhotos(results);
        }
      } else if (!isCancelled) {
        setConvertedAttachmentPhotos([]);
      }
    }

    processPhotos();

    return () => {
      isCancelled = true;
    };
  }, [compiledData?.progressPhotos, selectedCoverPhotoId, selectedAttachmentPhotoIds]);

  // Memoize PDF Data to avoid heavy unneeded re-computations and close lag
  const pdfData: QCReportData = useMemo(() => {
    const units = compiledData?.units || [];

    return {
      project: compiledData?.project || project,
      units,
      targetComponent: compiledData?.targetComponent,
      reportLevel,
      progressPhotos: convertedAttachmentPhotos,
      ncrs: compiledData?.ncrs || [],
      reportNumber: reportNumber || `QC-01/${project?.projectNumber || "PRJ"}`,
      inspectionDate: inspectionDate || new Date().toLocaleDateString("id-ID"),
      endFabricationDate:
        endFabricationDate || new Date().toLocaleDateString("id-ID"),
      deliveryTo: deliveryTo || "PT. JASA LAKSA UTAMA",
      specification: {
        length: lengthSpec ? `${lengthSpec} mm` : undefined,
        width: widthSpec ? `${widthSpec} mm` : undefined,
        height: heightSpec ? `${heightSpec} mm` : undefined,
      },
      signatories: {
        qcInspector,
        productionHead,
        projectManager,
      },
      notes: notesText
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean),
      isAccepted,
      coverImageUrl: convertedCoverUrl,
    };
  }, [
    compiledData,
    convertedCoverUrl,
    convertedAttachmentPhotos,
    project,
    reportLevel,
    reportNumber,
    inspectionDate,
    endFabricationDate,
    deliveryTo,
    lengthSpec,
    widthSpec,
    heightSpec,
    qcInspector,
    productionHead,
    projectManager,
    notesText,
    isAccepted,
  ]);

  // Use deferred value for smooth UI interactions without locking main thread
  const deferredPdfData = useDeferredValue(pdfData);

  // 1. Direct Download PDF Handler
  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPdf(true);
      toast.info("Sedang mengunduh laporan QC PDF...");
      const { pdf } = await import("@react-pdf/renderer");
      const blob = await pdf(<QCReportPDFDocument data={pdfData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      let filePrefix = "QC_Report_Unit";
      if (reportLevel === "COMPONENT") {
        filePrefix = `QC_Report_Component_${activeUnitObj?.name || "Unit"}`;
      } else if (selectedUnitIds.length === 1 && activeUnitObj) {
        filePrefix = `QC_Report_${activeUnitObj.name}`;
      } else {
        filePrefix = `QC_Report_${project?.projectName || "Project"}`;
      }

      const cleanPrjName = filePrefix
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .substring(0, 35);
      const cleanRepNo = (reportNumber || "QC-01").replace(
        /[^a-zA-Z0-9_-]/g,
        "_",
      );
      link.download = `${cleanPrjName}_${cleanRepNo}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Laporan QC PDF berhasil diunduh!");
    } catch (err: any) {
      console.error("PDF Download error:", err);
      toast.error("Gagal mengunduh PDF: " + (err.message || "Unknown error"));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 2. Open PDF in New Tab Fullscreen Handler
  const handleOpenInNewTab = async () => {
    try {
      toast.info("Membuka pratinjau PDF di tab baru...");
      const { pdf } = await import("@react-pdf/renderer");
      const blob = await pdf(<QCReportPDFDocument data={pdfData} />).toBlob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err: any) {
      console.error("Open in new tab error:", err);
      toast.error(
        "Gagal membuka PDF di tab baru: " + (err.message || "Unknown error"),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl! w-[88vw] h-[90vh] max-h-[90vh] p-0 rounded-2xl overflow-hidden shadow-2xl border-border/80 flex flex-col">
        {/* COMPACT TOP HEADER BAR */}
        <DialogHeader className="px-4 py-2.5 bg-muted/40 border-b flex flex-row items-center justify-between gap-3 shrink-0 m-0!">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4.5 h-4.5 text-red-500 shrink-0" />
            <DialogTitle className="font-bold text-xs text-foreground tracking-tight whitespace-nowrap">
              QC Report (Inspection & Test Dossier)
            </DialogTitle>
            <Badge
              variant="outline"
              className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5 px-1.5 py-0"
            >
              {project?.projectNumber || "PRJ"}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 pr-6">
            {/* Buka di Tab Baru (Full Screen Preview) */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleOpenInNewTab}
              disabled={isPending}
              title="Buka pratinjau PDF di tab browser baru secara layar penuh"
              className="h-7.5 px-2.5 rounded-lg text-xs font-semibold gap-1 border-border/80 hover:bg-muted/40 cursor-pointer shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Buka di Tab Baru</span>
            </Button>

            {/* Download PDF */}
            <Button
              type="button"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf || isPending}
              className="h-7.5 px-3 rounded-lg text-xs font-bold gap-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs cursor-pointer"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Download PDF
            </Button>
          </div>
        </DialogHeader>

        {/* 2-COLUMN STUDIO LAYOUT (LEFT: CONFIGURATION, RIGHT: WIDE PDF PREVIEW) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* ========================================================= */}
          {/* LEFT COLUMN: CONFIGURATION CONTROLS (Scrollable Sidebar)  */}
          {/* ========================================================= */}
          <div className="w-full md:w-80 lg:w-88 shrink-0 border-r border-border/70 bg-muted/15 overflow-y-auto p-3.5 space-y-4 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-foreground pb-1 border-b border-border/60">
              <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
              <span>Pengaturan & Cakupan Laporan</span>
            </div>

            {/* 1. Bentuk Laporan (2 Opsi: Per Unit & Per Komponen) */}
            <div className="space-y-2.5 p-2.5 rounded-xl border bg-background shadow-2xs">
              <Label className="text-[11px] font-semibold text-foreground">
                1. Bentuk Laporan
              </Label>
              <div className="grid grid-cols-2 gap-1 bg-muted/40 p-0.5 rounded-lg border">
                <button
                  type="button"
                  onClick={() => handleLevelChange("UNIT")}
                  className={`py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                    reportLevel === "UNIT"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Per Unit
                </button>
                <button
                  type="button"
                  onClick={() => handleLevelChange("COMPONENT")}
                  className={`py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                    reportLevel === "COMPONENT"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Per Komponen
                </button>
              </div>

              {/* ========================================================= */}
              {/* MODE 1: PER UNIT MULTI-SELECT                             */}
              {/* ========================================================= */}
              {reportLevel === "UNIT" && (
                <div className="space-y-2 pt-1 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      Pilih Unit Conveyor:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSelectAllUnits}
                        className="text-[9px] text-primary hover:underline font-semibold cursor-pointer"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-muted-foreground text-[8px]">•</span>
                      <button
                        type="button"
                        onClick={handleDeselectAllUnits}
                        className="text-[9px] text-muted-foreground hover:text-foreground font-semibold cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {(compiledData?.allUnitsList || []).map((u: any) => {
                      const isChecked = selectedUnitIds.includes(u.id);
                      const compCount =
                        (u.structureItems?.length || 0) +
                        (u.mechanicalItems?.length || 0);

                      return (
                        <div
                          key={u.id}
                          onClick={() => toggleUnitSelection(u.id)}
                          className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                            isChecked
                              ? "border-primary bg-primary/5 text-foreground shadow-2xs"
                              : "border-border/70 opacity-60 hover:opacity-100 hover:bg-muted/20"
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded border-primary text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer shrink-0"
                            />
                            <span className="font-semibold text-xs truncate">
                              {u.name}
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[9px] font-medium border-border/80 text-muted-foreground shrink-0 px-1 py-0"
                          >
                            {compCount} Item
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[10px] text-muted-foreground text-right font-medium">
                    {selectedUnitIds.length} dari{" "}
                    {(compiledData?.allUnitsList || []).length} unit dipilih
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* MODE 2: PER KOMPONEN MULTI-SELECT                         */}
              {/* ========================================================= */}
              {reportLevel === "COMPONENT" && (
                <div className="space-y-2 pt-1 border-t border-border/60">
                  {/* Unit Selector */}
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-muted-foreground">
                      Pilih Unit Acuan Komponen:
                    </Label>
                    <Select
                      value={effectiveActiveUnitId}
                      onValueChange={(val) => {
                        if (val) {
                          setActiveUnitForComponent(val);
                          setSelectedUnitIds([val]);
                          const targetUnit = (
                            compiledData?.allUnitsList || []
                          ).find((u: any) => u.id === val);
                          const allCIds = [
                            ...(targetUnit?.structureItems || []).map(
                              (i: any) => i.id,
                            ),
                            ...(targetUnit?.mechanicalItems || []).map(
                              (i: any) => i.id,
                            ),
                          ];
                          setSelectedComponentIds(allCIds);
                        }
                      }}
                    >
                      <SelectTrigger className="h-7.5 w-full rounded-lg text-xs font-semibold bg-background shadow-2xs">
                        <SelectValue placeholder="Pilih Unit">
                          {(compiledData?.allUnitsList || []).find(
                            (u: any) => u.id === effectiveActiveUnitId,
                          )?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(compiledData?.allUnitsList || []).map((u: any) => (
                          <SelectItem
                            key={u.id}
                            value={u.id}
                            className="text-xs font-medium"
                          >
                            {u.name} (
                            {(u.structureItems?.length || 0) +
                              (u.mechanicalItems?.length || 0)}{" "}
                            Item)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Component Checkboxes */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        Pilih Komponen:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleSelectAllComponentsInActiveUnit}
                          className="text-[9px] text-primary hover:underline font-semibold cursor-pointer"
                        >
                          Pilih Semua
                        </button>
                        <span className="text-muted-foreground text-[8px]">•</span>
                        <button
                          type="button"
                          onClick={handleDeselectAllComponents}
                          className="text-[9px] text-muted-foreground hover:text-foreground font-semibold cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                      {/* Structure items */}
                      {activeUnitStructureItems.length > 0 && (
                        <div className="space-y-1">
                          <div className="px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground bg-muted/40 rounded flex items-center gap-1">
                            <span>🔩 Komponen Struktur</span>
                          </div>
                          {activeUnitStructureItems.map((item: any) => {
                            const isChecked = selectedComponentIds.includes(
                              item.id,
                            );
                            return (
                              <div
                                key={item.id}
                                onClick={() => toggleComponentSelection(item.id)}
                                className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between gap-1.5 ${
                                  isChecked
                                    ? "border-primary bg-primary/5 text-foreground shadow-2xs"
                                    : "border-border/70 opacity-60 hover:opacity-100 hover:bg-muted/20"
                                }`}
                              >
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="rounded border-primary text-primary focus:ring-primary w-3 h-3 cursor-pointer shrink-0"
                                  />
                                  <span className="font-medium text-[11px] truncate">
                                    {item.name}
                                  </span>
                                </div>
                                <span className="text-[9px] text-muted-foreground shrink-0 font-medium">
                                  {item.qty || 1} {item.unit || "pcs"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Mechanical items */}
                      {activeUnitMechanicalItems.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <div className="px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground bg-muted/40 rounded flex items-center gap-1">
                            <span>⚙️ Komponen Mekanikal</span>
                          </div>
                          {activeUnitMechanicalItems.map((item: any) => {
                            const isChecked = selectedComponentIds.includes(
                              item.id,
                            );
                            return (
                              <div
                                key={item.id}
                                onClick={() => toggleComponentSelection(item.id)}
                                className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between gap-1.5 ${
                                  isChecked
                                    ? "border-primary bg-primary/5 text-foreground shadow-2xs"
                                    : "border-border/70 opacity-60 hover:opacity-100 hover:bg-muted/20"
                                }`}
                              >
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="rounded border-primary text-primary focus:ring-primary w-3 h-3 cursor-pointer shrink-0"
                                  />
                                  <span className="font-medium text-[11px] truncate">
                                    {item.name}
                                  </span>
                                </div>
                                <span className="text-[9px] text-muted-foreground shrink-0 font-medium">
                                  {item.qty || 1} {item.unit || "unit"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-muted-foreground text-right font-medium pt-0.5">
                      {selectedComponentIds.length} dari{" "}
                      {activeUnitStructureItems.length +
                        activeUnitMechanicalItems.length}{" "}
                      komponen dipilih
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Informasi Dokumen & Tanggal */}
            <div className="space-y-2 p-2.5 rounded-xl border bg-background shadow-2xs">
              <Label className="text-[11px] font-semibold text-foreground">
                2. Metadata Dokumen
              </Label>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-muted-foreground">
                    No. Laporan QC
                  </Label>
                  <Input
                    value={reportNumber}
                    onChange={(e) => setReportNumber(e.target.value)}
                    placeholder={`QC-01/${project?.projectNumber || "PRJ"}`}
                    className="h-7.5 text-xs font-semibold rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-muted-foreground">
                      Tgl Fabrikasi
                    </Label>
                    <Input
                      type="date"
                      value={endFabricationDate}
                      onChange={(e) => setEndFabricationDate(e.target.value)}
                      className="h-7.5 text-xs rounded-lg font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-muted-foreground">
                      Tgl Pengujian
                    </Label>
                    <Input
                      type="date"
                      value={inspectionDate}
                      onChange={(e) => setInspectionDate(e.target.value)}
                      className="h-7.5 text-xs rounded-lg font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-muted-foreground">
                    Delivery To
                  </Label>
                  <Input
                    value={deliveryTo}
                    onChange={(e) => setDeliveryTo(e.target.value)}
                    placeholder="PT. JASA LAKSA UTAMA"
                    className="h-7.5 text-xs rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* 3. Spesifikasi Dimensi */}
            <div className="space-y-2 p-2.5 rounded-xl border bg-background shadow-2xs">
              <Label className="text-[11px] font-semibold text-foreground">
                3. Dimensi P x L x T (mm)
              </Label>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="space-y-0.5">
                  <Label className="text-[9px] font-semibold text-muted-foreground">
                    P (mm)
                  </Label>
                  <Input
                    value={lengthSpec}
                    onChange={(e) => setLengthSpec(e.target.value)}
                    placeholder="2120"
                    className="h-7.5 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[9px] font-semibold text-muted-foreground">
                    L (mm)
                  </Label>
                  <Input
                    value={widthSpec}
                    onChange={(e) => setWidthSpec(e.target.value)}
                    placeholder="155"
                    className="h-7.5 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[9px] font-semibold text-muted-foreground">
                    T (mm)
                  </Label>
                  <Input
                    value={heightSpec}
                    onChange={(e) => setHeightSpec(e.target.value)}
                    placeholder="180"
                    className="h-7.5 text-xs rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* 4. Keputusan Kelulusan & Catatan */}
            <div className="space-y-2 p-2.5 rounded-xl border bg-background shadow-2xs">
              <Label className="text-[11px] font-semibold text-foreground">
                4. Keputusan Kelulusan
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={isAccepted ? "default" : "outline"}
                  onClick={() => setIsAccepted(true)}
                  className={
                    isAccepted
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-7.5 font-bold cursor-pointer"
                      : "text-[11px] h-7.5 cursor-pointer"
                  }
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Accepted
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!isAccepted ? "destructive" : "outline"}
                  onClick={() => setIsAccepted(false)}
                  className={
                    !isAccepted
                      ? "bg-rose-600 hover:bg-rose-700 text-white text-[11px] h-7.5 font-bold cursor-pointer"
                      : "text-[11px] h-7.5 cursor-pointer"
                  }
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Rejected
                </Button>
              </div>

              <div className="space-y-1 pt-1">
                <Label className="text-[10px] font-semibold text-muted-foreground">
                  Catatan Inspeksi
                </Label>
                <Textarea
                  rows={2}
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  className="text-xs rounded-lg resize-none text-[11px]"
                />
              </div>
            </div>

            {/* 5. Tanda Tangan 3 Pihak */}
            <div className="space-y-2 p-2.5 rounded-xl border bg-background shadow-2xs">
              <Label className="text-[11px] font-semibold text-foreground">
                5. Penandatangan (3 Pihak)
              </Label>
              <div className="space-y-1.5">
                <div className="space-y-0.5">
                  <Label className="text-[9px] font-semibold text-muted-foreground">
                    QC PT. JLU
                  </Label>
                  <Input
                    value={qcInspector}
                    onChange={(e) => setQCInspector(e.target.value)}
                    className="h-7 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[9px] font-semibold text-muted-foreground">
                    Produksi PT. JLU
                  </Label>
                  <Input
                    value={productionHead}
                    onChange={(e) => setProductionHead(e.target.value)}
                    className="h-7 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[9px] font-semibold text-muted-foreground">
                    Project Manager PT. JLU
                  </Label>
                  <Input
                    value={projectManager}
                    onChange={(e) => setProjectManager(e.target.value)}
                    className="h-7 text-xs rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* 6. Lampiran Foto Dokumentasi (Produksi & QC) */}
            <div className="space-y-3 p-2.5 rounded-xl border bg-background shadow-2xs">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-primary" />
                  6. Dokumentasi Foto (Produksi & QC)
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsPhotoDialogOpen(true)}
                  className="h-5 px-2 text-[9px] font-bold gap-1 rounded cursor-pointer border-primary/40 text-primary hover:bg-primary/10 shadow-2xs"
                >
                  <Camera className="w-2.5 h-2.5" />+ Upload / Buka Galeri
                </Button>
              </div>

              {allAvailablePhotos.length > 0 ? (
                <div className="space-y-3">
                  {/* SUB-SECTION 6A: PILIH FOTO COVER REPORT */}
                  <div className="space-y-1.5 p-2 rounded-lg bg-muted/25 border border-border/70">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold text-foreground flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        Foto Cover Depan (Opsional)
                      </Label>
                      {selectedCoverPhotoId && (
                        <button
                          type="button"
                          onClick={() => setSelectedCoverPhotoId(null)}
                          className="text-[9px] text-destructive hover:underline font-semibold cursor-pointer"
                        >
                          Hapus Cover
                        </button>
                      )}
                    </div>

                    <Select
                      value={selectedCoverPhotoId || "NONE"}
                      onValueChange={(val) =>
                        setSelectedCoverPhotoId(val === "NONE" ? null : val)
                      }
                    >
                      <SelectTrigger className="h-7 w-full rounded-md text-[11px] font-medium bg-background">
                        <SelectValue placeholder="— Tanpa Foto Cover —">
                          {selectedCoverPhotoId
                            ? (() => {
                                const p = allAvailablePhotos.find(
                                  (x: any) => x.id === selectedCoverPhotoId,
                                );
                                if (!p) return "— Tanpa Foto Cover —";
                                const isPhotoQC =
                                  p.isQC ||
                                  p.source === "QC" ||
                                  p.category === "QC_INSPECTION";
                                const prefix = isPhotoQC
                                  ? "[QC]"
                                  : `[Produksi${p.category ? ` • ${p.category}` : ""}]`;
                                return `${prefix} ${p.caption || p.fileName || "Foto Terpilih"}`;
                              })()
                            : "— Tanpa Foto Cover —"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE" className="text-[11px]">
                          — Tanpa Foto Cover —
                        </SelectItem>
                        {allAvailablePhotos.map((photo: any, idx: number) => {
                          const isPhotoQC =
                            photo.isQC ||
                            photo.source === "QC" ||
                            photo.category === "QC_INSPECTION";
                          const prefix = isPhotoQC
                            ? "[QC]"
                            : `[Produksi${photo.category ? ` • ${photo.category}` : ""}]`;

                          return (
                            <SelectItem
                              key={photo.id}
                              value={photo.id}
                              className="text-[11px]"
                            >
                              Foto #{idx + 1} {prefix}: {photo.caption || photo.fileName || "Dokumentasi"}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* SUB-SECTION 6B: PILIH FOTO LAMPIRAN INSPEKSI */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                      {/* Filter switcher buttons */}
                      <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-lg border border-border/50">
                        <button
                          type="button"
                          onClick={() => setPhotoFilter("ALL")}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
                            photoFilter === "ALL"
                              ? "bg-background text-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Semua ({allAvailablePhotos.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhotoFilter("PRODUCTION")}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
                            photoFilter === "PRODUCTION"
                              ? "bg-blue-600 text-white shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Produksi ({prodPhotosCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhotoFilter("QC")}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
                            photoFilter === "QC"
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          QC ({qcPhotosCount})
                        </button>
                      </div>

                      {/* Batch actions */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const currentFilteredIds = filteredPhotos.map((p: any) => p.id);
                            setSelectedAttachmentPhotoIds((prev) =>
                              Array.from(new Set([...prev, ...currentFilteredIds])),
                            );
                          }}
                          className="text-[9px] text-primary hover:underline font-semibold cursor-pointer"
                        >
                          Pilih {photoFilter === "ALL" ? "Semua" : "Kategori Ini"}
                        </button>
                        <span className="text-muted-foreground text-[8px]">•</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (photoFilter === "ALL") {
                              setSelectedAttachmentPhotoIds([]);
                            } else {
                              const idsToRemove = new Set(filteredPhotos.map((p: any) => p.id));
                              setSelectedAttachmentPhotoIds((prev) =>
                                prev.filter((id) => !idsToRemove.has(id)),
                              );
                            }
                          }}
                          className="text-[9px] text-muted-foreground hover:text-foreground font-semibold cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                      {filteredPhotos.map((photo: any) => {
                        const isAttached = selectedAttachmentPhotoIds.includes(
                          photo.id,
                        );
                        const isCover = selectedCoverPhotoId === photo.id;
                        const isPhotoQC =
                          photo.isQC ||
                          photo.source === "QC" ||
                          photo.category === "QC_INSPECTION";

                        return (
                          <div
                            key={photo.id}
                            onClick={() => {
                              setSelectedAttachmentPhotoIds((prev) =>
                                prev.includes(photo.id)
                                  ? prev.filter((id) => id !== photo.id)
                                  : [...prev, photo.id],
                              );
                            }}
                            className={`group relative rounded-xl border p-1.5 cursor-pointer transition-all flex flex-col gap-1 ${
                              isAttached
                                ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                                : "border-border/70 opacity-60 hover:opacity-100 hover:bg-muted/20"
                            }`}
                          >
                            <div className="relative w-full aspect-4/3 rounded-lg bg-muted overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photo.url}
                                alt={photo.caption || "Dokumentasi Foto"}
                                className="w-full h-full object-cover"
                              />

                              {/* Source badge (QC vs Produksi) */}
                              <div
                                className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-bold shadow-sm ${
                                  isPhotoQC
                                    ? "bg-emerald-600/90 text-white"
                                    : "bg-blue-600/90 text-white"
                                }`}
                              >
                                {isPhotoQC
                                  ? "QC"
                                  : `Produksi${photo.category ? ` • ${photo.category}` : ""}`}
                              </div>

                              {/* Attachment Badge */}
                              <div
                                className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-0.5 shadow-sm ${
                                  isAttached
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-black/60 text-white/80"
                                }`}
                              >
                                {isAttached ? "✓ Dilampirkan" : "Tidak dilampirkan"}
                              </div>

                              {/* Cover Indicator */}
                              {isCover && (
                                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[8px] font-bold flex items-center gap-0.5 shadow-sm">
                                  <Star className="w-2 h-2 fill-white" /> Cover
                                </div>
                              )}

                              {/* Open full photo button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(photo.url, "_blank");
                                }}
                                title="Buka foto di tab baru"
                                className="absolute bottom-1 right-1 p-1 rounded bg-black/60 hover:bg-black/80 text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            </div>

                            {photo.caption && (
                              <p className="text-[9px] font-medium text-foreground line-clamp-1">
                                {photo.caption}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-[10px] text-muted-foreground text-right font-medium">
                      {selectedAttachmentPhotoIds.length} dari{" "}
                      {allAvailablePhotos.length} foto dilampirkan ke halaman PDF
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 text-center rounded-lg border border-dashed border-border/80 bg-muted/20 space-y-2">
                  <p className="text-[10px] text-muted-foreground">
                    Belum ada foto dokumentasi di proyek ini.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsPhotoDialogOpen(true)}
                    className="h-6 text-[10px] font-bold gap-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md cursor-pointer w-full"
                  >
                    <Camera className="w-3 h-3" />
                    Upload Foto / Buka Galeri
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: WIDE LIVE PDF PREVIEW                       */}
          {/* ========================================================= */}
          <div className="flex-1 h-full overflow-hidden bg-background relative flex flex-col">
            {!open ? null : isPending ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs font-semibold">
                  Memproses data laporan QC...
                </span>
              </div>
            ) : (
              <PDFViewer className="w-full h-full border-0" showToolbar={true}>
                <QCReportPDFDocument data={deferredPdfData} />
              </PDFViewer>
            )}
          </div>
        </div>

        {/* Integrated Progress Photo Upload Modal */}
        <ProgressPhotoDialog
          isOpen={isPhotoDialogOpen}
          onOpenChange={(val) => {
            setIsPhotoDialogOpen(val);
            if (!val) {
              loadData();
            }
          }}
          onPhotoUploaded={loadData}
          projectId={project?.id || ""}
          projectName={project?.projectName || ""}
          unitId={selectedUnitIds.length > 0 ? selectedUnitIds[0] : undefined}
          unitName={
            selectedUnitIds.length > 0
              ? (compiledData?.allUnitsList || []).find(
                  (u: any) => u.id === selectedUnitIds[0],
                )?.name
              : undefined
          }
          category="ALL"
          currentSource="QC"
          readOnly={false}
        />
      </DialogContent>
    </Dialog>
  );
}
