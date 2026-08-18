"use client";

import React, { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  PauseCircle,
  CheckCircle2,
  Clock,
  FileText,
  Send,
  Loader2,
  ExternalLink,
  AlertTriangle,
  PenTool,
  UploadCloud,
  FolderOpen,
} from "lucide-react";
import { resolveDrawingRevisionByEngineering } from "@/app/actions/qc";
import {
  createDocumentUploadUrl,
  saveDocumentRecord,
} from "@/app/actions/documents";
import { DocumentManagerDialog } from "@/components/document-manager-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

interface DRManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
  onSuccess?: () => void;
}

export function getProjectDRs(project: any) {
  if (!project)
    return {
      activeCount: 0,
      historyCount: 0,
      uniqueDRs: [],
      pendingDRs: [],
      historyDRs: [],
    };

  const drList: any[] = [];
  const units = (project.conveyorUnits as any[]) || [];

  // 1. From Checkpoints on hold for Drawing Revision
  units.forEach((unit: any) => {
    const unitName = unit.name || `Unit Conveyor ${unit.orderIndex || 1}`;
    (unit.qcCheckpoints || []).forEach((cp: any) => {
      if (
        cp.status === "ON_HOLD" ||
        cp.notes?.toUpperCase().includes("DRAWING REVISION")
      ) {
        const linkedRev =
          (unit.qcRevisions || []).find(
            (r: any) =>
              (r.checkpointId === cp.id ||
                (r.itemId === cp.itemId && r.stage === cp.stage)) &&
              r.status !== "CLOSED",
          ) || (cp.revisions || []).find((r: any) => r.status !== "CLOSED");

        let itemName = "Komponen";
        if (cp.itemType === "STRUCTURE") {
          const item = (unit.structureItems || []).find(
            (i: any) => i.id === cp.itemId,
          );
          if (item) itemName = item.name;
        } else if (cp.itemType === "MECHANICAL") {
          const item = (unit.mechanicalItems || []).find(
            (i: any) => i.id === cp.itemId,
          );
          if (item) itemName = item.name;
        }

        const drNo =
          linkedRev?.drNumber ||
          linkedRev?.ncrNumber ||
          cp.notes?.match(/DR\/[A-Z0-9-/]+/i)?.[0] ||
          `DR/${project.projectNumber || "PRJ"}/${cp.stage}`;

        drList.push({
          id: linkedRev?.id || cp.id,
          checkpointId: cp.id,
          drNumber: drNo,
          unitId: unit.id,
          unitName,
          itemType: cp.itemType,
          itemId: cp.itemId,
          itemName,
          stage: cp.stage,
          drawingRef: linkedRev?.drawingRef || `Drawing Tahap ${cp.stage}`,
          fieldCondition:
            linkedRev?.fieldCondition ||
            linkedRev?.ncrDescription ||
            cp.notes ||
            "Item di-hold menunggu revisi drawing dari Engineering",
          requestedChange:
            linkedRev?.requestedChange || "Revisi / update drawing kerja",
          revisedDocUrl: linkedRev?.revisedDocUrl,
          status: linkedRev?.status || "SUBMITTED_TO_ENG",
          raisedBy: linkedRev?.raisedBy || cp.inspectedBy || "QC Inspector",
          createdAt: linkedRev?.createdAt || cp.inspectedAt || new Date(),
        });
      }
    });
  });

  // 2. From Direct QCRevisions (project & unit level)
  const allQCRevisions = [
    ...((project.qcRevisions as any[]) || []),
    ...units.flatMap((u: any) => u.qcRevisions || []),
  ];

  allQCRevisions.forEach((r: any) => {
    const isDR =
      r.revisionType === "DRAWING_REVISION" ||
      r.revisionType === "DR" ||
      Boolean(r.drNumber) ||
      Boolean(r.ncrNumber?.startsWith("DR/"));

    if (isDR) {
      const drNo =
        r.drNumber || r.ncrNumber || `DR/${project.projectNumber || "PRJ"}`;

      const alreadyAdded = drList.some(
        (ex) =>
          ex.id === r.id ||
          (r.checkpointId && ex.checkpointId === r.checkpointId) ||
          (drNo && ex.drNumber === drNo),
      );

      if (!alreadyAdded) {
        let unitName = "Proyek";
        if (r.unitId) {
          const u = units.find((un: any) => un.id === r.unitId);
          if (u) unitName = u.name || `Unit Conveyor ${u.orderIndex || 1}`;
        }

        drList.push({
          id: r.id,
          checkpointId: r.checkpointId,
          drNumber: drNo,
          unitId: r.unitId,
          unitName,
          itemType: r.level === "MECHANICAL" ? "MECHANICAL" : "STRUCTURE",
          itemId: r.itemId,
          itemName: r.drNumber ? "Request Drawing Revision" : "Komponen Proyek",
          stage: r.resetStage || "DRAWING",
          drawingRef: r.drawingRef || "Drawing Kerja",
          fieldCondition:
            r.fieldCondition || r.ncrDescription || "Perlu revisi drawing",
          requestedChange: r.requestedChange || "Update drawing",
          revisedDocUrl: r.revisedDocUrl,
          status: r.status || "SUBMITTED_TO_ENG",
          raisedBy: r.raisedBy || "QC Inspector",
          createdAt: r.createdAt || new Date(),
        });
      }
    }
  });

  // De-duplicate by DR Number or ID
  const uniqueDRs = Array.from(
    new Map(drList.map((item) => [item.drNumber || item.id, item])).values(),
  ).sort(
    (a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const pendingDRs = uniqueDRs.filter(
    (dr: any) =>
      dr.status === "SUBMITTED_TO_ENG" ||
      dr.status === "OPEN" ||
      dr.status === "ON_HOLD",
  );

  const historyDRs = uniqueDRs.filter(
    (dr: any) =>
      dr.status === "RESOLVED_BY_ENG" ||
      dr.status === "RESOLVED" ||
      dr.status === "CLOSED" ||
      dr.status === "PASSED",
  );

  return {
    activeCount: pendingDRs.length,
    historyCount: historyDRs.length,
    uniqueDRs,
    pendingDRs,
    historyDRs,
  };
}

export function DRManagerDialog({
  open,
  onOpenChange,
  project,
  onSuccess,
}: DRManagerDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedDR, setSelectedDR] = useState<any>(null);
  const [revisedDocUrl, setRevisedDocUrl] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [resolvedNotes, setResolvedNotes] = useState("");
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("active");

  if (!project) return null;

  const { activeCount, uniqueDRs, pendingDRs, historyDRs } =
    getProjectDRs(project);

  const handleOpenResolve = (dr: any) => {
    setSelectedDR(dr);
    setRevisedDocUrl(dr.revisedDocUrl || "");
    setUploadedFileName("");
    setResolvedNotes(dr.resolvedNotes || "");
  };

  const handleDirectFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error("Ukuran file melebihi batas 25MB.");
      e.target.value = "";
      return;
    }

    setIsUploadingFile(true);
    try {
      toast.loading(`Mengunggah gambar revisi ke Document Hub...`, {
        id: "dr-upload",
      });

      const { uploadUrl, path, version, success, error } =
        await createDocumentUploadUrl(
          project.id,
          "PROJECT",
          "DRAWING",
          file.name,
        );

      if (!success || !uploadUrl || !path) {
        throw new Error(error || "Gagal membuat channel upload.");
      }

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadRes.ok)
        throw new Error("Gagal mengunggah file ke cloud storage.");

      const recResult = await saveDocumentRecord({
        projectId: project.id,
        leadId: project.leadId || undefined,
        category: "DRAWING",
        url: path,
        fileName: file.name,
        isExternal: false,
        version: version || 1,
        notes: `Drawing Revisi (${selectedDR?.drNumber || "DR"}) disiapkan oleh Engineering`,
      });

      if (recResult.success) {
        toast.success(
          `Drawing ${file.name} (v${version}) tersimpan di Document Hub!`,
          { id: "dr-upload" },
        );
        setRevisedDocUrl(path);
        setUploadedFileName(file.name);
        router.refresh();
      } else {
        throw new Error("Gagal menyimpan catatan dokumen ke database.");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunggah file drawing", {
        id: "dr-upload",
      });
    } finally {
      setIsUploadingFile(false);
      e.target.value = "";
    }
  };

  const handleResolveDR = () => {
    if (!resolvedNotes.trim()) {
      toast.error("Mohon isi catatan revisi dari Engineering.");
      return;
    }

    startTransition(async () => {
      // Save link to Document Hub if external URL typed
      if (revisedDocUrl.trim() && !uploadedFileName) {
        await saveDocumentRecord({
          projectId: project.id,
          leadId: project.leadId || undefined,
          category: "DRAWING",
          url: revisedDocUrl.trim(),
          fileName: `Drawing Revisi ${selectedDR?.drNumber || "DR"}`,
          isExternal: true,
          version: 1,
          notes: `Link Drawing Revisi dari Engineering: ${resolvedNotes.trim()}`,
        }).catch(() => null);
      }

      const res = await resolveDrawingRevisionByEngineering({
        drId: selectedDR.id,
        revisedDocUrl: revisedDocUrl.trim() || undefined,
        resolvedNotes: resolvedNotes.trim(),
        resolvedBy: "Engineering Team",
      });

      if (res.success) {
        toast.success(
          `Revisi drawing ${selectedDR.drNumber} berhasil disimpan & dirilis ke QC/Produksi!`,
        );
        setSelectedDR(null);
        setRevisedDocUrl("");
        setUploadedFileName("");
        setResolvedNotes("");
        router.refresh();
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || "Gagal menyelesaikan revisi drawing.");
      }
    });
  };

  const renderDRCard = (dr: any) => {
    const isPendingEng =
      dr.status === "SUBMITTED_TO_ENG" ||
      dr.status === "OPEN" ||
      dr.status === "ON_HOLD";
    const isResolvedEng = dr.status === "RESOLVED_BY_ENG";
    const isSelected = selectedDR?.id === dr.id;

    return (
      <div
        key={dr.id}
        className={`p-4 rounded-xl border transition-all space-y-3 ${
          isSelected
            ? "border-amber-500 bg-amber-500/10 shadow-md ring-1 ring-amber-500/30"
            : isPendingEng
              ? "bg-amber-500/5 border-amber-300/80 shadow-xs"
              : isResolvedEng
                ? "bg-blue-500/5 border-blue-200"
                : "bg-card border-border/60"
        }`}
      >
        {/* Item Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs border-b border-border/40 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="secondary"
              className="font-bold text-[10px] bg-muted/80 text-foreground border border-border/40 px-1.5 py-0.5"
            >
              {dr.unitName}
            </Badge>
            <span className="font-bold text-foreground">{dr.drNumber}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground font-medium">
              Ref: {dr.drawingRef}
            </span>
          </div>

          <Badge
            variant="outline"
            className={
              isPendingEng
                ? "bg-amber-500/20 text-amber-800 border-amber-400 font-bold text-xs"
                : isResolvedEng
                  ? "bg-blue-500/20 text-blue-800 border-blue-300 font-bold text-xs"
                  : "bg-emerald-500/10 text-emerald-700 border-emerald-300 font-bold text-xs"
            }
          >
            {isPendingEng
              ? "Menunggu Revisi Engineering"
              : isResolvedEng
                ? "Sudah Direvisi Engineering"
                : "Selesai (Hold Dilepas)"}
          </Badge>
        </div>

        {/* Problem & Requested Change */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-background/80 border border-border/50 space-y-1">
            <span className="font-bold text-amber-800 dark:text-amber-300 text-[11px] block">
              Kondisi Lapangan / Kendala:
            </span>
            <p className="text-muted-foreground leading-relaxed">
              {dr.fieldCondition}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-background/80 border border-border/50 space-y-1">
            <span className="font-bold text-foreground text-[11px] block">
              Usulan Perubahan ke Engineering:
            </span>
            <p className="text-muted-foreground leading-relaxed">
              {dr.requestedChange}
            </p>
          </div>
        </div>

        {/* Uploader & Resolved Info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1">
          <div>
            Pemohon: <strong className="text-foreground">{dr.raisedBy}</strong>{" "}
            pada {format(new Date(dr.createdAt), "dd MMM yyyy HH:mm")}
          </div>

          {isPendingEng ? (
            <Button
              size="sm"
              onClick={() => handleOpenResolve(dr)}
              className="h-7 px-3 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs gap-1"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Tindak Lanjuti Revisi</span>
            </Button>
          ) : (
            <div className="text-right">
              Direvisi oleh:{" "}
              <strong className="text-foreground">
                {dr.resolvedBy || "Engineering"}
              </strong>
              {dr.resolvedNotes && (
                <p className="text-foreground/80 italic text-[11px] mt-0.5">
                  Catatan Eng: "{dr.resolvedNotes}"
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl! rounded-2xl p-6 border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5 border-b border-border/60 pb-4">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <PenTool className="w-5 h-5 text-amber-600" />
              <span>Daftar Request Revisi Drawing (DR)</span>
            </DialogTitle>
            <Badge
              variant="outline"
              className="bg-amber-500/10 text-amber-700 border-amber-300 font-bold text-xs px-2.5 py-1"
            >
              {pendingDRs.length} Menunggu Tindakan
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Proyek:{" "}
            <strong className="text-foreground font-semibold">
              {project.name || project.projectName}
            </strong>{" "}
            ({project.projectNumber || "PRJ"})
          </DialogDescription>
        </DialogHeader>

        {/* Tabs: Request Revisi Aktif vs Riwayat Revisi */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full my-2"
        >
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/60 p-1">
            <TabsTrigger
              value="active"
              className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-2xs cursor-pointer"
            >
              <span>Request Revisi Aktif</span>
              <span
                className={cn(
                  "flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold shadow-2xs",
                  pendingDRs.length > 0
                    ? "bg-primary text-primary-foreground animate-pulse"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {pendingDRs.length}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="history"
              className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-2xs cursor-pointer"
            >
              <span>Riwayat Revisi</span>
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-muted text-muted-foreground px-1.5 text-[10px] font-extrabold">
                {historyDRs.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3 pt-3 outline-hidden">
            {pendingDRs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground border border-dashed rounded-xl bg-muted/10 space-y-2">
                <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-500 opacity-80" />
                <p className="font-semibold text-sm text-foreground">
                  Tidak Ada Request Revisi Aktif
                </p>
                <p className="text-xs text-muted-foreground">
                  Seluruh revisi drawing telah diselesaikan oleh Engineering
                  atau tidak ada request revisi baru dari QC/Produksi.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingDRs.map((dr: any) => renderDRCard(dr))}
              </div>
            )}
          </TabsContent>

          <TabsContent
            value="history"
            className="space-y-3 pt-3 outline-hidden"
          >
            {historyDRs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground border border-dashed rounded-xl bg-muted/10 space-y-2">
                <Clock className="w-9 h-9 mx-auto text-muted-foreground opacity-50" />
                <p className="font-semibold text-sm text-foreground">
                  Belum Ada Riwayat Revisi
                </p>
                <p className="text-xs text-muted-foreground">
                  Belum ada revisi drawing yang pernah diselesaikan pada proyek
                  ini.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {historyDRs.map((dr: any) => renderDRCard(dr))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialog Action Form (When Engineering Clicks 'Tindak Lanjuti Revisi') */}
        {selectedDR && (
          <div className="mt-4 p-4 border border-amber-300 rounded-xl bg-amber-500/5 space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
              <h4 className="font-bold text-sm text-amber-800 flex items-center gap-1.5">
                <PenTool className="w-4 h-4 text-amber-700" />
                Form Tindak Lanjut Revisi Drawing ({selectedDR.drNumber})
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDR(null)}
                className="h-6 text-xs text-muted-foreground hover:text-foreground"
              >
                Batal
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Catatan Revisi Engineering *
                </Label>
                <Textarea
                  placeholder="Jelaskan perubahan drawing yang telah disesuaikan (misal: Ukuran telah diperkecil pada Sheet DWG-002 Rev A)..."
                  className="text-xs min-h-[70px] bg-background"
                  value={resolvedNotes}
                  onChange={(e) => setResolvedNotes(e.target.value)}
                />
              </div>

              {/* Drawing Document Hub Upload & Link Section */}
              <div className="space-y-2 border border-border/60 rounded-xl p-3 bg-card shadow-2xs">
                <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border/40 pb-2">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      Upload / Link Gambar Kerja Revisi (Drawing Document Hub)
                    </span>
                  </Label>

                  <DocumentManagerDialog
                    categories={["DRAWING"]}
                    defaultCategory="DRAWING"
                    ownerId={project.id}
                    ownerType="PROJECT"
                    leadId={project.leadId}
                    globalDriveUrl={project.globalDriveUrl}
                    onUploadSuccess={() => router.refresh()}
                    trigger={
                      <Button
                        variant="outline"
                        size="xs"
                        type="button"
                        className="h-6 px-2 text-[10px] font-semibold gap-1 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 border-blue-300 cursor-pointer"
                      >
                        <FolderOpen className="w-3 h-3 text-blue-600" />
                        <span>Buka Document Hub Drawing</span>
                      </Button>
                    }
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Option A: Direct File Upload */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">
                      A. Upload File Baru (PDF/DWG/Gambar)
                    </Label>
                    <label className="block cursor-pointer">
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                        onChange={handleDirectFileUpload}
                        disabled={isUploadingFile}
                        className="hidden"
                      />
                      <div className="h-9 px-3 border border-dashed border-blue-400 hover:border-blue-600 bg-blue-500/5 hover:bg-blue-500/10 rounded-lg text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center justify-center gap-1.5 transition-colors">
                        {isUploadingFile ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                            <span>Mengupload ke Cloud...</span>
                          </>
                        ) : (
                          <>
                            <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                            <span>Pilih & Upload File Drawing</span>
                          </>
                        )}
                      </div>
                    </label>
                  </div>

                  {/* Option B: External URL Input */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">
                      B. Atau Paste Link (Google Drive / Cloud URL)
                    </Label>
                    <div className="relative">
                      <Input
                        placeholder="https://drive.google.com/file/d/..."
                        className="text-xs h-9 bg-background pr-8"
                        value={revisedDocUrl}
                        onChange={(e) => setRevisedDocUrl(e.target.value)}
                      />
                      {revisedDocUrl && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-2.5 top-2.5 pointer-events-none" />
                      )}
                    </div>
                  </div>
                </div>

                {revisedDocUrl && (
                  <div className="flex items-center justify-between text-[11px] bg-emerald-500/10 border border-emerald-300 text-emerald-800 dark:text-emerald-300 px-3 py-1.5 rounded-lg mt-1">
                    <span className="font-semibold truncate max-w-[85%] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        Dokumen Terhubung: {uploadedFileName || revisedDocUrl}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRevisedDocUrl("");
                        setUploadedFileName("");
                      }}
                      className="text-xs font-bold text-rose-600 hover:underline cursor-pointer ml-2 shrink-0"
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDR(null)}
                className="h-8 text-xs font-medium cursor-pointer"
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleResolveDR}
                disabled={isPending || isUploadingFile}
                className="h-8 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs gap-1.5"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Rilis Drawing Revisi Ke QC/Produksi</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-border/60 pt-4 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer text-xs"
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
