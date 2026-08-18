"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  Hammer,
  Wrench,
  Layers,
  PauseCircle,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { format } from "date-fns";

interface ProductionRevisionQuickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
  onNavigateToItem: (
    tab: "structure" | "mechanical",
    itemId?: string,
    unitId?: string,
  ) => void;
}

export function getProjectActiveRevisions(project: any) {
  if (!project) return [];

  const revisionItems: Array<{
    id: string;
    revisionId?: string;
    unitId?: string;
    unitName: string;
    itemType: "STRUCTURE" | "MECHANICAL";
    itemId?: string;
    itemName: string;
    stage: string;
    revisionType: string;
    number?: string;
    drNumber?: string;
    ncrNumber?: string;
    category?: string;
    description: string;
    status: string;
    raisedBy?: string;
    raisedAt?: Date;
  }> = [];

  const units = (project.conveyorUnits as any[]) || [];

  units.forEach((unit: any) => {
    const unitName = unit.name || `Unit Conveyor ${unit.orderIndex || 1}`;

    const unitCheckpoints = (unit.qcCheckpoints as any[]) || [];
    const activeCheckpoints = unitCheckpoints.filter(
      (cp: any) => cp.status === "FAIL" || cp.status === "ON_HOLD",
    );

    const processCheckpoint = (
      item: any,
      cp: any,
      itemType: "STRUCTURE" | "MECHANICAL",
    ) => {
      if (cp.status === "FAIL" || cp.status === "ON_HOLD") {
        const linkedRev =
          (unit.qcRevisions || []).find(
            (r: any) =>
              (r.checkpointId === cp.id ||
                (r.itemId === item.id && r.stage === cp.stage)) &&
              r.status !== "CLOSED" &&
              r.status !== "RESOLVED" &&
              r.status !== "PASSED",
          ) ||
          (cp.revisions || []).find(
            (r: any) =>
              r.status !== "CLOSED" &&
              r.status !== "RESOLVED" &&
              r.status !== "PASSED",
          );

        const isDR =
          linkedRev?.revisionType === "DRAWING_REVISION" ||
          Boolean(linkedRev?.drNumber) ||
          Boolean(linkedRev?.ncrNumber?.startsWith("DR/")) ||
          cp.status === "ON_HOLD" ||
          (linkedRev?.fieldCondition && !linkedRev?.ncrDescription) ||
          cp.notes?.toUpperCase().includes("DRAWING REVISION");

        const docNo = linkedRev?.drNumber || linkedRev?.ncrNumber;

        revisionItems.push({
          id: cp.id,
          revisionId: linkedRev?.id || cp.id,
          unitId: unit.id,
          unitName,
          itemType,
          itemId: item.id,
          itemName:
            item.name ||
            (itemType === "MECHANICAL"
              ? "Komponen Mekanikal"
              : "Komponen Struktur"),
          stage: cp.stage,
          revisionType: isDR ? "DRAWING_REVISION" : "REVISI_PRODUKSI",
          number: docNo,
          drNumber: linkedRev?.drNumber,
          ncrNumber: linkedRev?.ncrNumber,
          category:
            linkedRev?.ncrCategory ||
            (isDR ? "Revisi Drawing" : "Inspeksi QC"),
          description:
            linkedRev?.fieldCondition ||
            linkedRev?.ncrDescription ||
            cp.notes ||
            (isDR
              ? "Menunggu revisi drawing dari Engineering."
              : "Hasil inspeksi QC membutuhkan perbaikan produksi."),
          status:
            linkedRev?.status || (cp.status === "ON_HOLD" ? "ON_HOLD" : "OPEN"),
          raisedBy: linkedRev?.raisedBy || cp.inspectedBy,
          raisedAt: linkedRev?.createdAt || cp.inspectedAt,
        });
      }
    };

    // 1. Structure Items
    (unit.structureItems || []).forEach((item: any) => {
      const checkpoints = unitCheckpoints.filter(
        (cp: any) => cp.itemType === "STRUCTURE" && cp.itemId === item.id,
      );
      checkpoints.forEach((cp: any) =>
        processCheckpoint(item, cp, "STRUCTURE"),
      );
    });

    // 2. Mechanical Items
    (unit.mechanicalItems || []).forEach((item: any) => {
      const checkpoints = unitCheckpoints.filter(
        (cp: any) => cp.itemType === "MECHANICAL" && cp.itemId === item.id,
      );
      checkpoints.forEach((cp: any) =>
        processCheckpoint(item, cp, "MECHANICAL"),
      );
    });

    // 3. Direct Unit Level QCRevisions (Only if linked to an active FAIL / ON_HOLD checkpoint)
    const unitRevisions = (unit.qcRevisions || []).filter(
      (r: any) =>
        r.status !== "CLOSED" &&
        r.status !== "RESOLVED" &&
        r.status !== "PASSED",
    );

    unitRevisions.forEach((r: any) => {
      // Ignore revision record if its checkpoint is PASS or normal
      if (r.checkpointId) {
        const cp = unitCheckpoints.find((c: any) => c.id === r.checkpointId);
        if (cp && cp.status !== "FAIL" && cp.status !== "ON_HOLD") {
          return;
        }
      } else if (r.itemId && r.resetStage) {
        const cp = unitCheckpoints.find(
          (c: any) => c.itemId === r.itemId && c.stage === r.resetStage,
        );
        if (cp && cp.status !== "FAIL" && cp.status !== "ON_HOLD") {
          return;
        }
      } else {
        // If unlinked unit revision, ignore if no failing/on-hold checkpoint in unit
        if (activeCheckpoints.length === 0 && r.status !== "SUBMITTED_TO_ENG") {
          return;
        }
      }

      const alreadyAdded = revisionItems.some(
        (ex) =>
          ex.revisionId === r.id ||
          (r.checkpointId && ex.id === r.checkpointId) ||
          (r.itemId && ex.itemId === r.itemId && ex.stage === r.resetStage) ||
          (ex.number && (ex.number === r.ncrNumber || ex.number === r.drNumber)),
      );

      if (!alreadyAdded) {
        const isDR =
          r.revisionType === "DRAWING_REVISION" || Boolean(r.drNumber);
        const docNo = r.drNumber || r.ncrNumber;
        revisionItems.push({
          id: r.id,
          revisionId: r.id,
          unitId: unit.id,
          unitName,
          itemType: r.level === "MECHANICAL" ? "MECHANICAL" : "STRUCTURE",
          itemName: isDR ? "Request Drawing Revision" : "Revisi Unit Produksi",
          stage: r.resetStage || "PRODUKSI",
          revisionType: isDR ? "DRAWING_REVISION" : "REVISI_PRODUKSI",
          number: docNo,
          drNumber: r.drNumber,
          ncrNumber: r.ncrNumber,
          category:
            r.ncrCategory || (isDR ? "Revisi Drawing" : "Revisi Produksi"),
          description:
            r.fieldCondition || r.ncrDescription || "Perlu revisi pengerjaan",
          status: r.status,
          raisedBy: r.raisedBy,
          raisedAt: r.createdAt,
        });
      }
    });
  });

  // 4. Direct Project Level QCRevisions
  const projectRevisions = (project.qcRevisions || []).filter(
    (r: any) =>
      r.status !== "CLOSED" && r.status !== "RESOLVED" && r.status !== "PASSED",
  );
  projectRevisions.forEach((r: any) => {
    if (r.checkpointId) {
      const allCheckpoints = units.flatMap((u: any) => u.qcCheckpoints || []);
      const cp = allCheckpoints.find((c: any) => c.id === r.checkpointId);
      if (cp && cp.status !== "FAIL" && cp.status !== "ON_HOLD") {
        return;
      }
    }

    const alreadyAdded = revisionItems.some(
      (ex) =>
        ex.revisionId === r.id ||
        (r.checkpointId && ex.id === r.checkpointId) ||
        (ex.number && (ex.number === r.ncrNumber || ex.number === r.drNumber)),
    );

    if (!alreadyAdded) {
      const isDR = r.revisionType === "DRAWING_REVISION" || Boolean(r.drNumber);
      const docNo = r.drNumber || r.ncrNumber;
      revisionItems.push({
        id: r.id,
        revisionId: r.id,
        unitId: "",
        unitName: "Proyek",
        itemType: r.level === "MECHANICAL" ? "MECHANICAL" : "STRUCTURE",
        itemName: isDR ? "Request Drawing Revision" : "Revisi Proyek",
        stage: r.resetStage || "PRODUKSI",
        revisionType: isDR ? "DRAWING_REVISION" : "REVISI_PRODUKSI",
        number: docNo,
        drNumber: r.drNumber,
        ncrNumber: r.ncrNumber,
        category:
          r.ncrCategory || (isDR ? "Revisi Drawing" : "Revisi Produksi"),
        description:
          r.fieldCondition || r.ncrDescription || "Perlu revisi pengerjaan",
        status: r.status,
        raisedBy: r.raisedBy,
        raisedAt: r.createdAt,
      });
    }
  });

  return Array.from(
    new Map(revisionItems.map((item) => [item.revisionId || item.id, item])).values(),
  );
}

export function ProductionRevisionQuickDialog({
  open,
  onOpenChange,
  project,
  onNavigateToItem,
}: ProductionRevisionQuickDialogProps) {
  if (!project) return null;

  const uniqueItems = getProjectActiveRevisions(project);

  const handleJump = (item: any) => {
    const tab = item.itemType === "MECHANICAL" ? "mechanical" : "structure";
    onNavigateToItem(tab, item.itemId, item.unitId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl! rounded-2xl p-6 border border-border shadow-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-1 border-b border-border/60 pb-4">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <span>Ringkasan Revisi Produksi & Drawing</span>
            </DialogTitle>
            <Badge
              variant="outline"
              className="bg-rose-500/10 text-rose-700 border-rose-300 font-bold text-xs px-2.5 py-1"
            >
              {uniqueItems.length} Komponen Perlu Perhatian
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Proyek:{" "}
            <strong className="text-foreground">{project.projectName}</strong> (
            {project.projectNumber || "PRJ"})
          </DialogDescription>
        </DialogHeader>

        {/* Revision Items List */}
        <div className="space-y-2 my-2">
          {uniqueItems.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border border-dashed rounded-xl bg-muted/10 space-y-2">
              <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-500 opacity-80" />
              <p className="font-semibold text-sm text-foreground">
                Tidak Ada Revisi Aktif
              </p>
              <p className="text-xs text-muted-foreground">
                Seluruh pengerjaan komponen dan tahapan produksi berjalan lancar
                tanpa kendala.
              </p>
            </div>
          ) : (
            uniqueItems.map((rev) => {
              const isMech = rev.itemType === "MECHANICAL";
              const isDR =
                rev.revisionType === "DRAWING_REVISION" ||
                Boolean(rev.drNumber) ||
                Boolean(rev.number?.startsWith("DR/")) ||
                rev.status === "ON_HOLD" ||
                rev.description?.toUpperCase().includes("DRAWING REVISION") ||
                rev.itemName?.includes("Drawing Revision");

              return (
                <div
                  key={rev.id}
                  className="p-3.5 rounded-xl border border-border/70 bg-card hover:border-primary/50 transition-all space-y-2 shadow-xs group"
                >
                  {/* Top Bar: Unit, Badges & Revision Status */}
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs pb-1 border-b border-border/30">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="secondary"
                        className="font-bold text-[10px] bg-muted/80 text-foreground border border-border/40 px-1.5 py-0.5"
                      >
                        {rev.unitName}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          isMech
                            ? "bg-amber-500/10 text-amber-700 border-amber-300 text-[10px] font-bold px-1.5 py-0.5"
                            : "bg-blue-500/10 text-blue-700 border-blue-300 text-[10px] font-bold px-1.5 py-0.5"
                        }
                      >
                        {isMech ? (
                          <Wrench className="w-2.5 h-2.5 mr-1 inline" />
                        ) : (
                          <Hammer className="w-2.5 h-2.5 mr-1 inline" />
                        )}
                        {isMech ? "Mekanikal" : "Struktur"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-zinc-500/10 text-zinc-700 border-zinc-300 text-[10px] font-bold px-1.5 py-0.5"
                      >
                        Tahap: {rev.stage}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {rev.number && (
                        <Badge
                          variant="outline"
                          className={
                            isDR
                              ? "bg-amber-500/10 text-amber-700 border-amber-300 font-bold text-[10px] px-1.5 py-0.5"
                              : "bg-rose-500/10 text-rose-700 border-rose-300 font-bold text-[10px] px-1.5 py-0.5"
                          }
                        >
                          {rev.number}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          isDR
                            ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-400 font-bold text-[10px] px-2 py-0.5"
                            : "bg-red-500/20 text-red-800 dark:text-red-300 border-red-400 font-bold text-[10px] px-2 py-0.5"
                        }
                      >
                        {isDR
                          ? "⏸️ ON HOLD (Revisi Drawing)"
                          : "⚠️ Perlu Revisi Produksi"}
                      </Badge>
                    </div>
                  </div>

                  {/* Body: Component Name, Note & Action */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors leading-tight">
                          {rev.itemName}
                        </h4>
                        <Badge
                          variant="outline"
                          className={
                            isDR
                              ? "bg-amber-500/10 text-amber-700 border-amber-300 text-[9px] px-1.5 py-0 font-bold"
                              : "bg-rose-500/10 text-rose-700 border-rose-300 text-[9px] px-1.5 py-0 font-bold"
                          }
                        >
                          {isDR ? "Revisi Drawing" : "Revisi Produksi"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground bg-muted/20 px-2 py-1 rounded-md border border-border/30 font-medium leading-snug">
                        {rev.description}
                      </p>
                      {rev.raisedBy && (
                        <p className="text-[10px] text-muted-foreground/80">
                          Oleh:{" "}
                          <strong className="text-foreground/80">
                            {rev.raisedBy}
                          </strong>
                          {rev.raisedAt &&
                            ` • ${format(new Date(rev.raisedAt), "dd MMM yyyy HH:mm")}`}
                        </p>
                      )}
                    </div>

                    {/* Action Button */}
                    <Button
                      size="sm"
                      onClick={() => handleJump(rev)}
                      className="h-7 px-3 text-[11px] font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs shrink-0 gap-1"
                    >
                      <span>Buka Komponen</span>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

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
