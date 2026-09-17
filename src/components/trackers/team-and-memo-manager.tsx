"use client";

import React, { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  UserCheck,
  FileText,
  Plus,
  Edit2,
  Trash2,
  FileEdit,
  Loader2,
  Sparkles,
  AlertCircle,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  updateProjectInstructionMemo,
  addDivisionLeaderAction,
  updateDivisionLeaderAction,
  deleteDivisionLeaderAction,
} from "@/app/actions/production";

const COMMON_DIVISIONS = [
  "FABRICATION STRUCTURE",
  "MECHANICAL",
  "ELECTRICAL",
  "CIVIL",
  "PROCUREMENT",
  "ENGINEERING",
  "LOGISTICS & SHIPMENT",
  "ERECTION",
  "COMMISSIONING",
  "QUALITY CONTROL",
];

export function TeamAndMemoManager({
  project,
  onOpenGoodsMemo,
}: {
  project: any;
  onOpenGoodsMemo: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  // Division Leaders from masterplan
  const divisionLeaders = project?.masterplan?.divisionLeaders || [];
  const instructionMemo = project?.productionSetup?.instructionMemo || "";
  const projectMemos = project?.goodsReleaseMemos || [];

  // Modal States for Leader CRUD
  const [leaderModal, setLeaderModal] = useState<{
    isOpen: boolean;
    mode: "ADD" | "EDIT";
    id?: string;
    divisionName: string;
    leaderName: string;
    isCustomDivision: boolean;
  }>({
    isOpen: false,
    mode: "ADD",
    divisionName: "FABRICATION STRUCTURE",
    leaderName: "",
    isCustomDivision: false,
  });

  const [deleteLeaderConfirm, setDeleteLeaderConfirm] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
    division: string;
  }>({
    isOpen: false,
    id: "",
    name: "",
    division: "",
  });

  // Modal States for Instruction Memo CRUD
  const [memoModal, setMemoModal] = useState<{
    isOpen: boolean;
    text: string;
  }>({
    isOpen: false,
    text: "",
  });

  const [deleteMemoConfirm, setDeleteMemoConfirm] = useState(false);

  // 1. Handlers for Division Leaders
  const handleOpenAddLeader = () => {
    setLeaderModal({
      isOpen: true,
      mode: "ADD",
      divisionName: "FABRICATION STRUCTURE",
      leaderName: "",
      isCustomDivision: false,
    });
  };

  const handleOpenEditLeader = (dl: any) => {
    const isCommon = COMMON_DIVISIONS.includes(dl.divisionName?.toUpperCase());
    setLeaderModal({
      isOpen: true,
      mode: "EDIT",
      id: dl.id,
      divisionName: dl.divisionName,
      leaderName: dl.leaderName,
      isCustomDivision: !isCommon,
    });
  };

  const handleSaveLeader = () => {
    if (!leaderModal.divisionName.trim()) {
      toast.error("Nama divisi wajib diisi.");
      return;
    }
    if (!leaderModal.leaderName.trim()) {
      toast.error("Nama leader wajib diisi.");
      return;
    }

    startTransition(async () => {
      if (leaderModal.mode === "ADD") {
        const res = await addDivisionLeaderAction(project.id, {
          divisionName: leaderModal.divisionName.trim(),
          leaderName: leaderModal.leaderName.trim(),
        });
        if (res.success) {
          toast.success("Leader divisi berhasil ditambahkan!");
          setLeaderModal((prev) => ({ ...prev, isOpen: false }));
        } else {
          toast.error(res.error || "Gagal menambahkan leader divisi.");
        }
      } else if (leaderModal.mode === "EDIT" && leaderModal.id) {
        const res = await updateDivisionLeaderAction(leaderModal.id, {
          divisionName: leaderModal.divisionName.trim(),
          leaderName: leaderModal.leaderName.trim(),
        });
        if (res.success) {
          toast.success("Leader divisi berhasil diperbarui!");
          setLeaderModal((prev) => ({ ...prev, isOpen: false }));
        } else {
          toast.error(res.error || "Gagal memperbarui leader divisi.");
        }
      }
    });
  };

  const handleExecuteDeleteLeader = () => {
    if (!deleteLeaderConfirm.id) return;
    startTransition(async () => {
      const res = await deleteDivisionLeaderAction(deleteLeaderConfirm.id);
      if (res.success) {
        toast.success("Leader divisi berhasil dihapus.");
        setDeleteLeaderConfirm((prev) => ({ ...prev, isOpen: false }));
      } else {
        toast.error(res.error || "Gagal menghapus leader divisi.");
      }
    });
  };

  // 2. Handlers for Instruction Memo
  const handleOpenEditMemo = () => {
    setMemoModal({
      isOpen: true,
      text: instructionMemo,
    });
  };

  const handleSaveMemo = () => {
    startTransition(async () => {
      const res = await updateProjectInstructionMemo(
        project.id,
        memoModal.text,
      );
      if (res.success) {
        toast.success(
          memoModal.text.trim()
            ? "Instruksi & Catatan Proyek berhasil disimpan!"
            : "Instruksi & Catatan Proyek berhasil dikosongkan.",
        );
        setMemoModal((prev) => ({ ...prev, isOpen: false }));
      } else {
        toast.error(res.error || "Gagal menyimpan instruksi proyek.");
      }
    });
  };

  const handleExecuteDeleteMemo = () => {
    startTransition(async () => {
      const res = await updateProjectInstructionMemo(project.id, "");
      if (res.success) {
        toast.success("Instruksi & Catatan Proyek berhasil dihapus.");
        setDeleteMemoConfirm(false);
      } else {
        toast.error(res.error || "Gagal menghapus instruksi proyek.");
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* SECTION 1 & 2: TIM & LEADER DIVISI + INSTRUKSI & CATATAN PROYEK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Tim & Leader Divisi */}
        <Card className="rounded-2xl border border-border/70 shadow-sm bg-card/80 backdrop-blur overflow-hidden flex flex-col">
          <CardHeader className="p-4 sm:p-5 border-b bg-muted/20 flex flex-row items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Users className="w-4 h-4" />
                </div>
                <CardTitle className="text-sm font-bold text-foreground">
                  Tim & Leader Divisi ({divisionLeaders.length})
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Penanggung jawab tim lapangan untuk tiap tahapan kerja
              </CardDescription>
            </div>

            <Button
              size="sm"
              onClick={handleOpenAddLeader}
              className="h-8 px-3 rounded-xl gap-1.5 font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Leader
            </Button>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
            {divisionLeaders.length === 0 ? (
              <div className="py-8 px-4 text-center text-xs text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/60 flex flex-col items-center justify-center gap-2 flex-1">
                <Users className="w-8 h-8 opacity-30 text-primary" />
                <p className="font-semibold text-foreground">
                  Belum ada leader divisi yang ditugaskan.
                </p>
                <p className="text-[11px] text-muted-foreground max-w-xs">
                  Klik tombol <b>+ Tambah Leader</b> di atas untuk menambahkan penanggung jawab divisi.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {divisionLeaders.map((dl: any) => (
                  <div
                    key={dl.id}
                    className="p-3 rounded-xl border border-border/60 bg-muted/10 hover:bg-muted/20 transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-extrabold uppercase tracking-wide bg-background border border-border/60"
                        >
                          {dl.divisionName}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-foreground font-bold text-sm">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="truncate">{dl.leaderName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEditLeader(dl)}
                        className="h-7 w-7 text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                        title="Edit Leader"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setDeleteLeaderConfirm({
                            isOpen: true,
                            id: dl.id,
                            name: dl.leaderName,
                            division: dl.divisionName,
                          })
                        }
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                        title="Hapus Leader"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Instruksi & Catatan Proyek */}
        <Card className="rounded-2xl border border-border/70 shadow-sm bg-card/80 backdrop-blur overflow-hidden flex flex-col">
          <CardHeader className="p-4 sm:p-5 border-b bg-muted/20 flex flex-row items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <FileEdit className="w-4 h-4" />
                </div>
                <CardTitle className="text-sm font-bold text-foreground">
                  Instruksi & Catatan Proyek
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Memo teknis dan catatan instruksi lapangan khusus proyek ini
              </CardDescription>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {instructionMemo ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenEditMemo}
                    className="h-8 px-3 rounded-xl gap-1.5 font-bold text-xs text-primary border-primary/30 hover:bg-primary/5 cursor-pointer shadow-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit Catatan
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteMemoConfirm(true)}
                    className="h-8 px-2.5 rounded-xl text-destructive hover:bg-destructive/10 cursor-pointer"
                    title="Hapus / Kosongkan Catatan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={handleOpenEditMemo}
                  className="h-8 px-3 rounded-xl gap-1.5 font-bold text-xs bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Catatan
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
            {instructionMemo ? (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs text-foreground leading-relaxed whitespace-pre-wrap font-sans flex-1">
                {instructionMemo}
              </div>
            ) : (
              <div className="py-8 px-4 text-center text-xs text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/60 flex flex-col items-center justify-center gap-2 flex-1">
                <FileText className="w-8 h-8 opacity-30 text-amber-500" />
                <p className="font-semibold text-foreground">
                  Tidak ada memo instruksi lapangan.
                </p>
                <p className="text-[11px] text-muted-foreground max-w-xs">
                  Klik tombol <b>+ Tambah Catatan</b> di atas untuk menulis arahan khusus atau catatan lapangan.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SECTION 3: MEMO PENGELUARAN BARANG PROYEK */}
      <Card className="rounded-2xl border border-border/70 shadow-sm bg-card/80 backdrop-blur overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <FileText className="w-4 h-4" />
              </div>
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                Memo Pengeluaran Barang Proyek ({projectMemos.length})
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Request barang & pengembalian sisa/alat terikat khusus untuk proyek {project.projectName}
            </CardDescription>
          </div>

          <Button
            type="button"
            onClick={onOpenGoodsMemo}
            className="h-8 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Buat Memo Pengeluaran Barang
          </Button>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {projectMemos.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-xs bg-muted/10 rounded-xl border border-dashed border-border/60 space-y-2">
              <FileText className="w-8 h-8 opacity-30 mx-auto text-emerald-600" />
              <p className="font-semibold text-foreground">
                Belum ada request memo barang untuk proyek ini.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Klik tombol hijau di atas untuk membuat memo pengeluaran barang baru.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {projectMemos.map((memo: any) => (
                <div
                  key={memo.id}
                  className="p-3.5 rounded-xl border border-border/60 bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-muted/20 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-foreground">
                        {memo.memoNumber}
                      </span>
                      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-none text-[10px] font-bold">
                        ✓ Terkirim ke Inventory
                      </Badge>
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      Pemohon: <strong className="text-foreground">{memo.requesterName}</strong> ({memo.division}) • {memo.items?.length || 0} Barang
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onOpenGoodsMemo}
                      className="h-8 px-3 rounded-lg text-xs font-bold border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
                    >
                      Lihat & Kelola Memo
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. MODAL: ADD / EDIT DIVISION LEADER */}
      <Dialog
        open={leaderModal.isOpen}
        onOpenChange={(open) =>
          setLeaderModal((prev) => ({ ...prev, isOpen: open }))
        }
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {leaderModal.mode === "ADD"
                ? "Tambah Leader Divisi"
                : "Edit Leader Divisi"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tentukan divisi kerja dan nama penanggung jawab / leader lapangan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Division Selection / Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nama Divisi</Label>
              {!leaderModal.isCustomDivision ? (
                <div className="space-y-2">
                  <select
                    value={leaderModal.divisionName}
                    onChange={(e) => {
                      if (e.target.value === "CUSTOM") {
                        setLeaderModal((prev) => ({
                          ...prev,
                          isCustomDivision: true,
                          divisionName: "",
                        }));
                      } else {
                        setLeaderModal((prev) => ({
                          ...prev,
                          divisionName: e.target.value,
                        }));
                      }
                    }}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    {COMMON_DIVISIONS.map((div) => (
                      <option key={div} value={div}>
                        {div}
                      </option>
                    ))}
                    <option value="CUSTOM">+ Tulis Divisi Kustom...</option>
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Contoh: ELECTRICAL SYSTEM, PIPING, DLL"
                    value={leaderModal.divisionName}
                    onChange={(e) =>
                      setLeaderModal((prev) => ({
                        ...prev,
                        divisionName: e.target.value.toUpperCase(),
                      }))
                    }
                    className="rounded-xl text-xs uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setLeaderModal((prev) => ({
                        ...prev,
                        isCustomDivision: false,
                        divisionName: "FABRICATION STRUCTURE",
                      }))
                    }
                    className="h-9 px-2.5 text-xs text-muted-foreground rounded-xl"
                  >
                    Batal
                  </Button>
                </div>
              )}
            </div>

            {/* Leader Name Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nama Leader / Penanggung Jawab</Label>
              <Input
                placeholder="Contoh: Suparjo, Sudirjo, dll."
                value={leaderModal.leaderName}
                onChange={(e) =>
                  setLeaderModal((prev) => ({
                    ...prev,
                    leaderName: e.target.value,
                  }))
                }
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setLeaderModal((prev) => ({ ...prev, isOpen: false }))
              }
              className="rounded-xl text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={handleSaveLeader}
              className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Simpan Leader
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. MODAL: DELETE LEADER CONFIRMATION */}
      <Dialog
        open={deleteLeaderConfirm.isOpen}
        onOpenChange={(open) =>
          setDeleteLeaderConfirm((prev) => ({ ...prev, isOpen: open }))
        }
      >
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Hapus Leader Divisi?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Apakah Anda yakin ingin menghapus <b>{deleteLeaderConfirm.name}</b> sebagai leader divisi <b>{deleteLeaderConfirm.division}</b>?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setDeleteLeaderConfirm((prev) => ({ ...prev, isOpen: false }))
              }
              className="rounded-xl text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={handleExecuteDeleteLeader}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. MODAL: EDIT INSTRUCTION MEMO */}
      <Dialog
        open={memoModal.isOpen}
        onOpenChange={(open) =>
          setMemoModal((prev) => ({ ...prev, isOpen: open }))
        }
      >
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileEdit className="w-5 h-5 text-amber-600" />
              Instruksi & Catatan Proyek
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tuliskan instruksi teknis, catatan material khusus, arahan assembly/welding, atau catatan lapangan penting lainnya.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Textarea
              rows={6}
              placeholder="Contoh: Pastikan toleransi diagonal frame under 2mm. Gunakan kawat las E7018 untuk main beam. Prioritaskan fabrikasi unit BC 01 untuk delivery tahap awal..."
              value={memoModal.text}
              onChange={(e) =>
                setMemoModal((prev) => ({ ...prev, text: e.target.value }))
              }
              className="rounded-xl text-xs leading-relaxed font-sans"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setMemoModal((prev) => ({ ...prev, isOpen: false }))
              }
              className="rounded-xl text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={handleSaveMemo}
              className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Simpan Instruksi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. MODAL: DELETE MEMO CONFIRMATION */}
      <Dialog open={deleteMemoConfirm} onOpenChange={setDeleteMemoConfirm}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Hapus Catatan Proyek?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Apakah Anda yakin ingin menghapus seluruh instruksi dan catatan proyek ini?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteMemoConfirm(false)}
              className="rounded-xl text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={handleExecuteDeleteMemo}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
