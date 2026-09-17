"use client";

import React, { useState, useEffect, useTransition, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  Upload,
  Image as ImageIcon,
  Trash2,
  ExternalLink,
  Loader2,
  X,
  Layers,
  Calendar,
  User,
  Search,
  Wrench,
  Hammer,
  Paintbrush,
  Folder,
  FolderOpen,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  HardHat,
  Sparkles,
  Eye,
  ShieldCheck,
  Lock,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  compressImageToWebP,
  formatFileSize,
  CompressionResult,
} from "@/lib/image-compression";
import {
  createProgressPhotoUploadUrl,
  saveProgressPhotoRecord,
  getProgressPhotos,
  deleteProgressPhotoAction,
  getProjectUnitsAndPhasesAction,
} from "@/app/actions/progress-photos";

interface ProgressPhotoDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName?: string;
  unitId?: string;
  unitName?: string;
  phaseId?: string;
  phaseName?: string;
  category?: string;
  currentSource?: "QC" | "PRODUCTION";
  onPhotoUploaded?: () => void;
  // Deep link direct to specific unit and component (e.g. from QC page)
  initialUnit?: any;
  initialComponent?: SelectedComponentTarget;
  readOnly?: boolean;
}

interface QueuedFile {
  originalFile: File;
  compressionResult: CompressionResult;
  caption: string;
}

interface SelectedComponentTarget {
  id: string;
  name: string;
  type: "STRUCTURE" | "MECHANICAL" | "PHASE" | "GENERAL";
  satuan?: string;
  qty?: number | string;
}

export function ProgressPhotoDialog({
  isOpen,
  onOpenChange,
  projectId,
  projectName,
  unitId,
  unitName,
  phaseId,
  phaseName,
  category = "ALL",
  currentSource,
  onPhotoUploaded,
  initialUnit,
  initialComponent,
  readOnly = false,
}: ProgressPhotoDialogProps) {
  const { data: session } = useSession();
  const userRoles = useMemo(() => {
    return (((session?.user as any)?.roles || []) as string[]).map((r) => r.toLowerCase());
  }, [session]);

  const isAdmin = useMemo(
    () => userRoles.some((r) => ["superadmin", "admin"].includes(r)),
    [userRoles],
  );
  const isQCUser = useMemo(
    () => userRoles.some((r) => ["quality control", "qc"].includes(r)),
    [userRoles],
  );
  const isProdUser = useMemo(
    () => userRoles.some((r) => ["production", "produksi"].includes(r)),
    [userRoles],
  );

  // Tab Filter Cepat Level 3: "ALL" | "PRODUCTION" | "QC"
  const [activeFilterTab, setActiveFilterTab] = useState<"ALL" | "PRODUCTION" | "QC">("ALL");

  // Target sumber unggah foto otomatis:
  // 1. Jika dibuka dari QC (currentSource === "QC" atau category === "QC_INSPECTION") -> otomatis milik QC
  // 2. Jika dibuka dari Produksi -> otomatis milik Produksi
  const isQCContext = currentSource === "QC" || category === "QC_INSPECTION";
  const uploadSource: "QC" | "PRODUCTION" = isQCContext ? "QC" : "PRODUCTION";

  const [photos, setPhotos] = useState<any[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Project Units & Phases metadata
  const [projectUnits, setProjectUnits] = useState<any[]>([]);
  const [projectPhases, setProjectPhases] = useState<any[]>([]);

  // Navigation Hierarchy States
  // Level 1: selectedUnit === null
  // Level 2: selectedUnit !== null && selectedComponent === null
  // Level 3: selectedUnit !== null && selectedComponent !== null
  const [selectedUnit, setSelectedUnit] = useState<any | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<SelectedComponentTarget | null>(null);

  // Search keyword for units / components
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Upload Queue state (Level 3)
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [batchCaption, setBatchCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirm State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Role-based delete check
  const canDeletePhoto = (photo: any) => {
    if (readOnly) return false;
    if (isAdmin) return true;
    const isPhotoQC = photo.isQC || photo.category === "QC_INSPECTION";
    if (isPhotoQC) {
      return isQCUser;
    } else {
      return isProdUser;
    }
  };

  // Reset tab filter when component changes
  useEffect(() => {
    setActiveFilterTab("ALL");
  }, [selectedComponent]);

  // Load project units, phases, and photos when dialog opens
  useEffect(() => {
    if (isOpen && projectId) {
      loadProjectMetadata();
      loadPhotos();
      if (initialUnit) {
        setSelectedUnit(initialUnit);
      }
      if (initialComponent) {
        setSelectedComponent(initialComponent);
      }
    } else {
      setSelectedUnit(null);
      setSelectedComponent(null);
      setQueuedFiles([]);
      setBatchCaption("");
      setSearchFilter("");
      setActiveFilterTab("ALL");
    }
  }, [isOpen, projectId, initialUnit, initialComponent]);

  // If opened with default unitId, auto-select that unit
  useEffect(() => {
    if (unitId && projectUnits.length > 0 && !selectedUnit) {
      const match = projectUnits.find((u) => u.id === unitId);
      if (match) {
        setSelectedUnit(match);
      }
    }
  }, [unitId, projectUnits]);

  // Hydrate selectedUnit with full items once projectUnits are loaded
  useEffect(() => {
    if (selectedUnit && projectUnits.length > 0) {
      const fullUnit = projectUnits.find((u) => u.id === selectedUnit.id);
      if (fullUnit && (!selectedUnit.structureItems || selectedUnit.structureItems.length === 0)) {
        setSelectedUnit(fullUnit);
      }
    }
  }, [projectUnits, selectedUnit]);

  const loadProjectMetadata = async () => {
    try {
      const res = await getProjectUnitsAndPhasesAction(projectId);
      if (res.success) {
        setProjectUnits(res.units || []);
        setProjectPhases(res.phases || []);
      }
    } catch (err) {
      console.error("Error loading project metadata:", err);
    }
  };

  const loadPhotos = async () => {
    setIsLoadingPhotos(true);
    try {
      const res = await getProgressPhotos({
        projectId,
        category,
      });
      if (res.success && res.data) {
        setPhotos(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  // Helper: Count photos for a unit
  const getUnitPhotoCount = (uId: string | null) => {
    return photos.filter((p) => {
      if (!p.url) return false;
      return uId ? p.unitId === uId : !p.unitId;
    }).length;
  };

  // Helper: Count photos for a component within a unit
  const getComponentPhotoCount = (
    uId: string | null,
    compName: string,
    compType: string,
    compId?: string,
  ) => {
    return photos.filter((p) => {
      if (!p.url) return false;
      if (uId) {
        if (p.unitId !== uId) return false;
      } else {
        if (p.unitId) return false;
      }
      const cap = p.caption || "";

      // Foto Umum Unit: HANYA foto yang tidak terikat pada komponen atau tahapan tertentu
      if (compName === "Umum Unit" || compName === "Dokumentasi Umum Proyek") {
        return (
          !p.componentId &&
          !p.stage &&
          (!cap.includes("[") || cap.toLowerCase().includes("[umum"))
        );
      }

      // Komponen Spesifik:
      // 1. Cocokkan berdasarkan componentId (paling akurat dari DB)
      if (compId && p.componentId === compId) {
        return true;
      }

      // 2. Cocokkan tag [Nama Komponen] di caption
      if (compName && cap.toLowerCase().includes(`[${compName.toLowerCase()}]`)) {
        return true;
      }

      // 3. Cocokkan componentName jika ada di record
      if (p.componentName && p.componentName.toLowerCase() === compName.toLowerCase()) {
        return true;
      }

      return false;
    }).length;
  };

  // Level 3: Photos belonging to active selected unit & component
  const activeComponentPhotos = useMemo(() => {
    if (!selectedUnit || !selectedComponent) return [];
    const uId = selectedUnit.id === "GENERAL" ? null : selectedUnit.id;

    return photos.filter((p) => {
      if (!p.url) return false;
      if (uId) {
        if (p.unitId !== uId) return false;
      } else {
        if (p.unitId) return false;
      }

      const cap = p.caption || "";
      if (
        selectedComponent.id === "GENERAL_UNIT" ||
        selectedComponent.id === "GENERAL_PROJECT"
      ) {
        return (
          !p.componentId &&
          !p.stage &&
          (!cap.includes("[") || cap.toLowerCase().includes("[umum"))
        );
      }

      // Cocokkan berdasarkan componentId
      if (selectedComponent.id && p.componentId === selectedComponent.id) {
        return true;
      }

      // Cocokkan tag [Nama Komponen] di caption
      if (
        selectedComponent.name &&
        cap.toLowerCase().includes(`[${selectedComponent.name.toLowerCase()}]`)
      ) {
        return true;
      }

      // Cocokkan componentName jika ada di record
      if (
        p.componentName &&
        p.componentName.toLowerCase() === selectedComponent.name.toLowerCase()
      ) {
        return true;
      }

      return false;
    });
  }, [photos, selectedUnit, selectedComponent]);

  // Tab Filter counts for Level 3
  const countAll = activeComponentPhotos.length;
  const countProd = useMemo(
    () => activeComponentPhotos.filter((p) => !p.isQC && p.category !== "QC_INSPECTION").length,
    [activeComponentPhotos],
  );
  const countQC = useMemo(
    () => activeComponentPhotos.filter((p) => p.isQC || p.category === "QC_INSPECTION").length,
    [activeComponentPhotos],
  );

  // Filtered displayed photos based on activeFilterTab
  const displayedComponentPhotos = useMemo(() => {
    if (activeFilterTab === "PRODUCTION") {
      return activeComponentPhotos.filter((p) => !p.isQC && p.category !== "QC_INSPECTION");
    }
    if (activeFilterTab === "QC") {
      return activeComponentPhotos.filter((p) => p.isQC || p.category === "QC_INSPECTION");
    }
    return activeComponentPhotos;
  }, [activeComponentPhotos, activeFilterTab]);

  // Handle file selection and auto-compress
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    toast.loading("Mengompresi foto...", { id: "compressing" });

    const newQueued: QueuedFile[] = [];

    for (const file of files) {
      try {
        const compressed = await compressImageToWebP(file, {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.82,
        });

        newQueued.push({
          originalFile: file,
          compressionResult: compressed,
          caption: "",
        });
      } catch (err) {
        console.error("Compression error:", err);
        toast.error(`Gagal memproses file ${file.name}`);
      }
    }

    toast.dismiss("compressing");
    setQueuedFiles((prev) => [...prev, ...newQueued]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeQueuedFile = (index: number) => {
    setQueuedFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Upload queued files to Supabase Storage & Save DB Records
  const handleUploadAll = async () => {
    if (queuedFiles.length === 0 || !selectedUnit || !selectedComponent) return;

    setIsUploading(true);
    let successCount = 0;

    const targetUnitId = selectedUnit.id === "GENERAL" ? undefined : selectedUnit.id;
    const compTag = `[${selectedComponent.name}]`;

    for (let i = 0; i < queuedFiles.length; i++) {
      const item = queuedFiles[i];
      const file = item.compressionResult.file;

      let captionText = item.caption || batchCaption || "";
      if (selectedComponent.id !== "GENERAL_UNIT" && selectedComponent.id !== "GENERAL_PROJECT") {
        if (!captionText.includes(compTag)) {
          captionText = `${compTag} ${captionText}`.trim();
        }
      }

      try {
        const categoryToSave =
          uploadSource === "QC"
            ? "QC_INSPECTION"
            : selectedComponent.type === "STRUCTURE" || selectedComponent.type === "MECHANICAL"
            ? `FABRICATION_${selectedComponent.type}`
            : "FABRICATION";

        // 1. Get signed upload URL
        const urlRes = await createProgressPhotoUploadUrl(
          projectId,
          file.name,
          targetUnitId,
          categoryToSave,
        );

        if (!urlRes.success || !urlRes.uploadUrl) {
          throw new Error(urlRes.error || "Gagal mendapatkan URL upload");
        }

        // 2. Upload binary to Supabase
        const uploadResponse = await fetch(urlRes.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error("Gagal mengunggah file gambar ke storage");
        }

        const isComponentSpecific =
          selectedComponent.id !== "GENERAL_UNIT" &&
          selectedComponent.id !== "GENERAL_PROJECT";

        // 3. Save database record
        const saveRes = await saveProgressPhotoRecord({
          projectId,
          unitId: targetUnitId,
          componentId: isComponentSpecific ? selectedComponent.id : undefined,
          componentType:
            selectedComponent.type === "STRUCTURE" ||
            selectedComponent.type === "MECHANICAL"
              ? selectedComponent.type
              : undefined,
          category: categoryToSave,
          caption: captionText || undefined,
          url: urlRes.path || urlRes.uploadUrl,
          fileName: file.name,
          fileSize: file.size,
        });

        if (saveRes.success) {
          successCount++;
        }
      } catch (err: any) {
        console.error("Upload item error:", err);
        toast.error(`Gagal mengunggah ${file.name}: ${err.message}`);
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(`${successCount} foto berhasil disimpan untuk ${selectedComponent.name}!`);
      setQueuedFiles([]);
      setBatchCaption("");
      loadPhotos();
      onPhotoUploaded?.();
    }
  };

  const handleDeletePhoto = (photoId: string) => {
    startTransition(async () => {
      const res = await deleteProgressPhotoAction(photoId);
      if (res.success) {
        toast.success("Foto dokumentasi berhasil dihapus.");
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        setDeleteConfirmId(null);
        onPhotoUploaded?.();
      } else {
        toast.error(res.error || "Gagal menghapus foto");
      }
    });
  };

  // Filtered unit list for Level 1
  const filteredUnits = useMemo(() => {
    if (!searchFilter.trim()) return projectUnits;
    const kw = searchFilter.toLowerCase();
    return projectUnits.filter((u) => u.name.toLowerCase().includes(kw));
  }, [projectUnits, searchFilter]);

  // Clean caption text without the [Component] bracket for cleaner display
  const cleanCaptionDisplay = (rawCaption?: string) => {
    if (!rawCaption) return "Tanpa Keterangan";
    return rawCaption.replace(/\[.*?\]\s*/g, "").trim() || rawCaption;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl! max-h-[90vh] flex flex-col p-0 rounded-2xl overflow-hidden shadow-2xl border-border/80">
        {/* ========================================================= */}
        {/* TOP HEADER WITH HIERARCHICAL BREADCRUMB                   */}
        {/* ========================================================= */}
        <DialogHeader className="p-4 pb-3 border-b bg-muted/20 flex flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            {/* Back Button if in Level 2 or Level 3 */}
            {(selectedUnit || selectedComponent) && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (selectedComponent) {
                    setSelectedComponent(null);
                    setQueuedFiles([]);
                  } else if (selectedUnit) {
                    setSelectedUnit(null);
                    setSearchFilter("");
                  }
                }}
                className="h-8 w-8 rounded-lg hover:bg-muted cursor-pointer shrink-0"
                title="Kembali"
              >
                <ArrowLeft className="w-4 h-4 text-foreground" />
              </Button>
            )}

            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <Camera className="w-4 h-4" />
            </div>

            {/* Breadcrumb Path */}
            <div className="flex items-center gap-1.5 text-xs font-semibold overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setSelectedUnit(null);
                  setSelectedComponent(null);
                  setSearchFilter("");
                }}
                className={`cursor-pointer hover:underline truncate ${
                  !selectedUnit ? "text-foreground font-bold" : "text-muted-foreground"
                }`}
              >
                {currentSource === "QC" || category === "QC_INSPECTION"
                  ? "Dokumentasi Foto (QC & Produksi)"
                  : "Unit Conveyor"}
              </button>

              {selectedUnit && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedComponent(null);
                      setQueuedFiles([]);
                    }}
                    className={`cursor-pointer hover:underline truncate ${
                      !selectedComponent ? "text-foreground font-bold" : "text-muted-foreground"
                    }`}
                  >
                    {selectedUnit.name}
                  </button>
                </>
              )}

              {selectedComponent && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-primary font-bold truncate">
                    {selectedComponent.name}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {readOnly ? (
              <Badge
                variant="outline"
                className="text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/40 flex items-center gap-1"
              >
                <Eye className="w-3 h-3" />
                <span>Hanya Lihat</span>
              </Badge>
            ) : null}
            <Badge variant="secondary" className="text-[10px] font-bold">
              {photos.length} Total Foto
            </Badge>
          </div>
        </DialogHeader>

        {/* ========================================================= */}
        {/* MAIN BODY AREA                                            */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* ========================================================= */}
          {/* LEVEL 1: LIST UNIT CONVEYOR                               */}
          {/* ========================================================= */}
          {!selectedUnit && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h3 className="text-xs font-bold text-foreground">
                    Pilih Unit Conveyor
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Pilih unit untuk melihat daftar komponen dan mengelola dokumentasi fotonya.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Cari nama unit..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="h-8 text-xs pl-8 rounded-xl bg-background"
                  />
                </div>
              </div>

              {isLoadingPhotos ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span>Memuat data unit & foto...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {/* Option: Dokumentasi Umum & Non-Unit */}
                  <div
                    onClick={() => {
                      setSelectedUnit({
                        id: "GENERAL",
                        name: "Dokumentasi Umum Proyek",
                        structureItems: [],
                        mechanicalItems: [],
                      });
                      setSearchFilter("");
                    }}
                    className="p-3.5 rounded-xl border border-border/80 bg-card hover:border-primary hover:bg-primary/2 cursor-pointer transition-all flex flex-col justify-between gap-3 shadow-2xs group"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                        <Folder className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                          Umum Proyek & Site
                        </h4>
                        <p className="text-[10px] text-muted-foreground">
                          Dokumentasi umum, site, erection lapangan
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[10px]">
                      <span className="text-muted-foreground font-medium">Non-Unit</span>
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {getUnitPhotoCount(null)} Foto
                      </Badge>
                    </div>
                  </div>

                  {/* List of Conveyor Units */}
                  {filteredUnits.map((unit) => {
                    const photoCount = getUnitPhotoCount(unit.id);
                    const structCount = unit.structureItems?.length || 0;
                    const mechCount = unit.mechanicalItems?.length || 0;

                    return (
                      <div
                        key={unit.id}
                        onClick={() => {
                          setSelectedUnit(unit);
                          setSearchFilter("");
                        }}
                        className="p-3.5 rounded-xl border border-border/80 bg-card hover:border-primary hover:bg-primary/2 cursor-pointer transition-all flex flex-col justify-between gap-3 shadow-2xs group"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                            <Folder className="w-4 h-4" />
                          </div>
                          <div className="overflow-hidden">
                            <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                              {unit.name}
                            </h4>
                            <p className="text-[10px] text-muted-foreground">
                              {structCount + mechCount} Komponen ({structCount} Struktur, {mechCount} Mekanikal)
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[10px]">
                          <span className="text-muted-foreground font-medium flex items-center gap-1">
                            Buka Komponen <ChevronRight className="w-3 h-3" />
                          </span>
                          <Badge
                            variant={photoCount > 0 ? "default" : "outline"}
                            className="text-[10px] font-bold"
                          >
                            {photoCount} Foto
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* LEVEL 2: LIST KOMPONEN & TAHAP DALAM UNIT                 */}
          {/* ========================================================= */}
          {selectedUnit && !selectedComponent && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-primary" />
                    Pilih Komponen / Tahap di {selectedUnit.name}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Klik komponen untuk mengunggah foto baru atau melihat galeri foto komponen tersebut.
                  </p>
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="w-3 h-3 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Cari komponen..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="h-7 text-xs pl-7 rounded-lg bg-background"
                  />
                </div>
              </div>

              {/* SECTION: TAHAPAN UMUM UNIT */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div
                    onClick={() => {
                      setSelectedComponent({
                        id: selectedUnit.id === "GENERAL" ? "GENERAL_PROJECT" : "GENERAL_UNIT",
                        name: selectedUnit.id === "GENERAL" ? "Dokumentasi Umum Proyek" : "Umum Unit",
                        type: "GENERAL",
                      });
                    }}
                    className="p-3 rounded-xl border border-dashed border-border/80 bg-muted/15 hover:border-primary hover:bg-primary/2 cursor-pointer transition-all flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground">
                          {selectedUnit.id === "GENERAL" ? "Foto Umum Proyek" : "Foto Umum Unit"}
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          Foto keseluruhan / assembly tanpa komponen spesifik
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold shrink-0">
                      {getComponentPhotoCount(
                        selectedUnit.id === "GENERAL" ? null : selectedUnit.id,
                        selectedUnit.id === "GENERAL" ? "Dokumentasi Umum Proyek" : "Umum Unit",
                        "GENERAL",
                      )}{" "}
                      Foto
                    </Badge>
                  </div>
                </div>
              </div>

              {/* SECTION: KOMPONEN STRUKTUR */}
              {selectedUnit.structureItems && selectedUnit.structureItems.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-[11px] font-bold text-foreground flex items-center gap-1.5 pb-1 border-b border-border/60">
                    <Hammer className="w-3 h-3 text-blue-600" />
                    Komponen Struktur ({selectedUnit.structureItems.length})
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {selectedUnit.structureItems
                      .filter((item: any) =>
                        !searchFilter || item.name.toLowerCase().includes(searchFilter.toLowerCase()),
                      )
                      .map((item: any) => {
                        const count = getComponentPhotoCount(
                          selectedUnit.id,
                          item.name,
                          "STRUCTURE",
                          item.id,
                        );

                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              setSelectedComponent({
                                id: item.id,
                                name: item.name,
                                type: "STRUCTURE",
                                satuan: item.satuan,
                                qty: item.qty,
                              });
                            }}
                            className="p-2.5 rounded-xl border border-border/70 bg-card hover:border-primary hover:bg-primary/2 cursor-pointer transition-all flex items-center justify-between gap-2 shadow-2xs group"
                          >
                            <div className="overflow-hidden">
                              <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate block">
                                {item.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {item.qty} {item.satuan || "pcs"}
                              </span>
                            </div>
                            <Badge
                              variant={count > 0 ? "default" : "outline"}
                              className="text-[10px] font-bold shrink-0"
                            >
                              {count} Foto
                            </Badge>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* SECTION: KOMPONEN MEKANIKAL */}
              {selectedUnit.mechanicalItems && selectedUnit.mechanicalItems.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-[11px] font-bold text-foreground flex items-center gap-1.5 pb-1 border-b border-border/60">
                    <Wrench className="w-3 h-3 text-emerald-600" />
                    Komponen Mekanikal ({selectedUnit.mechanicalItems.length})
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {selectedUnit.mechanicalItems
                      .filter((item: any) =>
                        !searchFilter || item.name.toLowerCase().includes(searchFilter.toLowerCase()),
                      )
                      .map((item: any) => {
                        const count = getComponentPhotoCount(
                          selectedUnit.id,
                          item.name,
                          "MECHANICAL",
                          item.id,
                        );

                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              setSelectedComponent({
                                id: item.id,
                                name: item.name,
                                type: "MECHANICAL",
                                satuan: item.satuan,
                                qty: item.qty,
                              });
                            }}
                            className="p-2.5 rounded-xl border border-border/70 bg-card hover:border-primary hover:bg-primary/2 cursor-pointer transition-all flex items-center justify-between gap-2 shadow-2xs group"
                          >
                            <div className="overflow-hidden">
                              <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate block">
                                {item.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {item.qty} {item.satuan || "unit"}
                              </span>
                            </div>
                            <Badge
                              variant={count > 0 ? "default" : "outline"}
                              className="text-[10px] font-bold shrink-0"
                            >
                              {count} Foto
                            </Badge>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* LEVEL 3: CRUD FOTO UNTUK KOMPONEN TERPILIH                */}
          {/* ========================================================= */}
          {selectedUnit && selectedComponent && (
            <div className="space-y-4">
              {/* UPLOAD FORM FOR THIS COMPONENT (Hidden in readOnly mode) */}
              {!readOnly && (
                <div className="p-3.5 rounded-2xl border border-dashed border-primary/40 bg-primary/2 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-primary" />
                        Tambah Foto untuk: {selectedComponent.name}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Unit: <strong>{selectedUnit.name}</strong> • Komponen:{" "}
                        <strong>{selectedComponent.type}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFilesSelected}
                      />

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-8 px-3 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-xs gap-1.5 shrink-0"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Pilih Foto Kamera / Galeri
                      </Button>
                    </div>
                  </div>

                  {/* QUEUED FILES PREVIEW */}
                  {queuedFiles.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-border/60">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-foreground">
                          Foto yang akan disimpan ({queuedFiles.length}):
                        </Label>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto pr-1">
                        {queuedFiles.map((item, idx) => (
                          <div
                            key={idx}
                            className="group relative rounded-xl border border-border/70 bg-card overflow-hidden shadow-xs flex flex-col"
                          >
                            <div className="relative aspect-4/3 bg-muted/40 overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.compressionResult.previewUrl}
                                alt="preview"
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => removeQueuedFile(idx)}
                                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-destructive text-white transition-colors cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>

                            <div className="p-1.5 space-y-1 text-[10px]">
                              <div className="flex items-center justify-between text-muted-foreground text-[9px]">
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {formatFileSize(item.compressionResult.compressedSize)}
                                </span>
                                <span>(-{item.compressionResult.savedPercent}%)</span>
                              </div>
                              <Input
                                placeholder="Keterangan..."
                                value={item.caption}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setQueuedFiles((prev) =>
                                    prev.map((f, i) => (i === idx ? { ...f, caption: val } : f)),
                                  );
                                }}
                                className="h-6 text-[10px] px-1.5 rounded-md"
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Batch Caption & Submit */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                        <Input
                          placeholder="Catatan pengerjaan (misal: 'Penyetelan & Pengelasan')"
                          value={batchCaption}
                          onChange={(e) => setBatchCaption(e.target.value)}
                          className="rounded-xl text-xs flex-1 h-8"
                        />

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setQueuedFiles([])}
                            disabled={isUploading}
                            className="rounded-xl text-xs h-8 cursor-pointer"
                          >
                            Batal
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isUploading}
                            onClick={handleUploadAll}
                            className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1.5 shadow-sm h-8"
                          >
                            {isUploading ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Menyimpan...
                              </>
                            ) : (
                              <>
                                <Upload className="w-3.5 h-3.5" />
                                Simpan {queuedFiles.length} Foto
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PHOTO GALLERY FOR THIS COMPONENT */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-border/50">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-primary" />
                    Galeri Foto: {selectedComponent.name}
                  </h4>

                  {/* Fast Filter Tabs: Semua Foto, Produksi, QC */}
                  <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border/60 text-xs shrink-0 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setActiveFilterTab("ALL")}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                        activeFilterTab === "ALL"
                          ? "bg-background text-foreground font-bold shadow-2xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span>Semua Foto</span>
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 font-bold">
                        {countAll}
                      </Badge>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveFilterTab("PRODUCTION")}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                        activeFilterTab === "PRODUCTION"
                          ? "bg-background text-blue-600 dark:text-blue-400 font-bold shadow-2xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Hammer className="w-3 h-3 text-blue-600" />
                      <span>Produksi</span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-1 py-0 h-4 font-bold",
                          activeFilterTab === "PRODUCTION" && "bg-blue-500/15 text-blue-700 dark:text-blue-300",
                        )}
                      >
                        {countProd}
                      </Badge>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveFilterTab("QC")}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                        activeFilterTab === "QC"
                          ? "bg-background text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>QC</span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-1 py-0 h-4 font-bold",
                          activeFilterTab === "QC" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                        )}
                      >
                        {countQC}
                      </Badge>
                    </button>
                  </div>
                </div>

                {activeComponentPhotos.length === 0 ? (
                  <div className="py-12 px-4 text-center text-xs text-muted-foreground bg-muted/10 rounded-2xl border border-dashed border-border/60 flex flex-col items-center justify-center gap-2">
                    <Camera className="w-7 h-7 opacity-30 text-primary" />
                    <p className="font-semibold text-foreground">
                      Belum ada foto dokumentasi untuk {selectedComponent.name}.
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {readOnly
                        ? "Belum ada foto yang diunggah untuk komponen ini."
                        : "Gunakan tombol di atas untuk melampirkan dokumentasi pengerjaan atau inspeksi komponen ini."}
                    </p>
                  </div>
                ) : displayedComponentPhotos.length === 0 ? (
                  <div className="py-10 px-4 text-center text-xs text-muted-foreground bg-muted/10 rounded-2xl border border-dashed border-border/60 flex flex-col items-center justify-center gap-2">
                    <Filter className="w-6 h-6 opacity-40 text-muted-foreground" />
                    <p className="font-semibold text-foreground">
                      Tidak ada foto pada kategori {activeFilterTab === "QC" ? "QC" : "Produksi"}.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveFilterTab("ALL")}
                      className="rounded-xl text-xs h-7 mt-1 cursor-pointer"
                    >
                      Tampilkan Semua Foto ({countAll})
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {displayedComponentPhotos.map((photo) => {
                      const isPhotoQC = photo.isQC || photo.category === "QC_INSPECTION";
                      const canDelete = canDeletePhoto(photo);

                      return (
                        <div
                          key={photo.id}
                          className="group relative rounded-xl border border-border/70 bg-card overflow-hidden shadow-xs flex flex-col hover:border-primary/50 transition-all"
                        >
                          <div
                            onClick={() => window.open(photo.url, "_blank")}
                            title="Buka foto asli di tab baru"
                            className="relative aspect-4/3 bg-muted/40 overflow-hidden cursor-pointer"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo.url}
                              alt={photo.caption || "Foto Progres"}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />

                            {/* Floating Source Badge: QC vs Produksi */}
                            <div className="absolute top-1.5 left-1.5 z-10 pointer-events-none">
                              {isPhotoQC ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-600/90 text-white text-[9px] font-bold shadow-xs backdrop-blur-xs tracking-wide">
                                  <ShieldCheck className="w-2.5 h-2.5" />
                                  <span>QC</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-600/90 text-white text-[9px] font-bold shadow-xs backdrop-blur-xs tracking-wide">
                                  <Hammer className="w-2.5 h-2.5" />
                                  <span>Produksi</span>
                                </span>
                              )}
                            </div>

                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <div className="p-1.5 rounded-full bg-white/90 text-foreground shadow-sm flex items-center gap-1 text-[10px] font-semibold">
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Buka Foto</span>
                              </div>
                            </div>

                            {photo.fileSize && (
                              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[8px] font-mono">
                                {formatFileSize(photo.fileSize)}
                              </span>
                            )}
                          </div>

                          <div className="p-2 space-y-1 flex-1 flex flex-col justify-between text-xs">
                            <p className="font-medium text-foreground text-[11px] line-clamp-2 leading-snug">
                              {cleanCaptionDisplay(photo.caption)}
                            </p>

                            <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] text-muted-foreground">
                              <span className="truncate text-[9px]">
                                {photo.uploadedBy || "Tim"} •{" "}
                                {new Date(photo.createdAt).toLocaleDateString("id-ID", {
                                  day: "2-digit",
                                  month: "short",
                                })}
                              </span>

                              {!readOnly && (
                                canDelete ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmId(photo.id);
                                    }}
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md cursor-pointer shrink-0"
                                    title="Hapus Foto"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                ) : (
                                  <div
                                    className="h-6 w-6 flex items-center justify-center text-muted-foreground/40 cursor-not-allowed shrink-0"
                                    title={
                                      isPhotoQC
                                        ? "Akses Dibatasi: Hanya tim QC atau Admin yang dapat menghapus foto inspeksi QC ini."
                                        : "Akses Dibatasi: Hanya tim Produksi atau Admin yang dapat menghapus foto hasil produksi ini."
                                    }
                                  >
                                    <Lock className="w-3 h-3 text-muted-foreground/50" />
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* FOOTER                                                    */}
        {/* ========================================================= */}
        <DialogFooter className="m-0! p-3.5 border-t bg-muted/10 shrink-0 flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground font-medium">
            {selectedComponent ? (
              <span>
                Melihat foto untuk: <strong>{selectedComponent.name}</strong> ({selectedUnit?.name})
              </span>
            ) : selectedUnit ? (
              <span>
                Pilih komponen di <strong>{selectedUnit.name}</strong>
              </span>
            ) : (
              <span>Pilih unit conveyor untuk mengelola foto</span>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs font-bold px-4 cursor-pointer h-8"
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <Dialog
          open={!!deleteConfirmId}
          onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        >
          <DialogContent className="sm:max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-destructive">
                Hapus Foto Dokumentasi?
              </DialogTitle>
              <DialogDescription className="text-xs">
                Foto ini akan dihapus permanen dari sistem dan storage.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-xl text-xs"
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={() => handleDeletePhoto(deleteConfirmId)}
                className="rounded-xl text-xs font-bold"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                Hapus Permanen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
