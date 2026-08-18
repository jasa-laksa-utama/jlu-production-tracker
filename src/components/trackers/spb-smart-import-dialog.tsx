"use client";

import React, { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Search,
  Trash2,
  Download,
  Loader2,
  Sparkles,
  Plus,
  Minus,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export interface SmartSPBRow {
  id: number;
  originalName: string;
  originalSpec: string;
  originalQty: number;
  originalUnit: string;
  originalNote: string;
  matchedBoqId: string | null;
  matchedBoqCode: string;
  matchedBoqName: string;
  matchedBoqSpec: string;
  matchedBoqUnit: string;
  matchScore: number; // 0 - 100
}

interface SPBSmartImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
  boqItems: any[];
  onConfirmImport: (importedItems: any[]) => void;
}

// Helper akurat untuk mengekstrak spesifikasi barang dari BoQ (itemTypeMerk)
function getBoqSpec(boq: any): string {
  if (!boq) return "-";
  const val =
    boq.itemTypeMerk ||
    boq.typeMerk ||
    boq.spec ||
    boq.material?.typeMerk ||
    boq.material?.spec ||
    boq.materialSpec;
  return val && String(val).trim() !== "" ? String(val).trim() : "-";
}

// Helper akurat untuk mengekstrak kode barang dari BoQ
function getBoqCode(boq: any): string {
  if (!boq) return "";
  return boq.itemCode || boq.code || boq.material?.code || "";
}

// Helper akurat untuk mengekstrak nama barang dari BoQ
function getBoqName(boq: any): string {
  if (!boq) return "";
  return boq.itemName || boq.name || boq.material?.name || "";
}

export function SPBSmartImportDialog({
  open,
  onOpenChange,
  project,
  boqItems = [],
  onConfirmImport,
}: SPBSmartImportDialogProps) {
  const [rows, setRows] = useState<SmartSPBRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openPopoverId, setOpenPopoverId] = useState<number | null>(null);

  // Clean state when closed
  useEffect(() => {
    if (!open) {
      setRows([]);
      setSearchQuery("");
      setOpenPopoverId(null);
    }
  }, [open]);

  // Download Template Excel pre-filled dengan Barang BoQ Proyek
  const handleDownloadTemplate = () => {
    if (!project) {
      toast.error("Pilih proyek terlebih dahulu.");
      return;
    }

    if (!boqItems || boqItems.length === 0) {
      toast.error("Proyek ini belum memiliki data BoQ. Buat/import BoQ terlebih dahulu.");
      return;
    }

    // Build worksheet rows berisikan Kode, Nama, Spesifikasi, Satuan, Total Qty BoQ
    const excelData = boqItems.map((item, idx) => ({
      "No": idx + 1,
      "Kode Barang": getBoqCode(item) || "-",
      "Nama Barang (BoQ)": getBoqName(item),
      "Spesifikasi / Merk": getBoqSpec(item),
      "Satuan": item.unit || "pcs",
      "Total Qty BoQ": item.qty || 0,
      "Qty Diminta (SPB)": "", // Diisi oleh pengguna
      "Catatan / Alasan Permintaan": "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 6 },  // No
      { wch: 18 }, // Kode Barang
      { wch: 35 }, // Nama Barang
      { wch: 45 }, // Spesifikasi
      { wch: 10 }, // Satuan
      { wch: 15 }, // Total Qty BoQ
      { wch: 20 }, // Qty Diminta (SPB)
      { wch: 30 }, // Catatan
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template SPB Proyek");

    const safeProjName = (project.projectName || "Proyek").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Template_SPB_${safeProjName}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    toast.success(`Template Excel SPB untuk ${project.projectName} berhasil diunduh!`);
  };

  // Handle Upload & Read Excel
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (rawJson.length === 0) {
          toast.error("File Excel kosong atau format tidak valid.");
          setIsParsing(false);
          return;
        }

        // Process rows and match with BoQ
        const parsedList: SmartSPBRow[] = [];
        let autoId = 1;

        rawJson.forEach((row) => {
          const rawCode = String(
            row["Kode Barang"] ||
            row["Kode"] ||
            row["kode"] ||
            ""
          ).trim();

          const rawName = String(
            row["Nama Barang (BoQ)"] ||
            row["Nama Barang"] ||
            row["nama_barang"] ||
            row["Item"] ||
            ""
          ).trim();

          const rawSpec = String(
            row["Spesifikasi / Merk"] ||
            row["Spesifikasi"] ||
            row["spesifikasi"] ||
            row["Merk"] ||
            ""
          ).trim();

          const rawQtyStr = String(
            row["Qty Diminta (SPB)"] ||
            row["Qty Diminta"] ||
            row["Qty"] ||
            row["qty"] ||
            "0"
          ).trim();

          const rawUnit = String(
            row["Satuan"] ||
            row["satuan"] ||
            "pcs"
          ).trim();

          const rawNote = String(
            row["Catatan / Alasan Permintaan"] ||
            row["Catatan"] ||
            row["catatan"] ||
            ""
          ).trim();

          const qtyNum = parseFloat(rawQtyStr) || 0;

          if (rawName && qtyNum > 0) {
            let bestMatch: any = null;
            let highestScore = 0;

            const nameNorm = rawName.toLowerCase();

            boqItems.forEach((boq) => {
              const boqName = getBoqName(boq).toLowerCase();
              const boqSpec = getBoqSpec(boq).toLowerCase();
              const boqCode = getBoqCode(boq).toLowerCase();

              let score = 0;
              if (rawCode && boqCode && boqCode === rawCode.toLowerCase()) {
                score += 90;
              }

              if (boqName === nameNorm) {
                score += 70;
                if (rawSpec && rawSpec !== "-" && boqSpec.includes(rawSpec.toLowerCase())) {
                  score += 20;
                }
              } else if (boqName.includes(nameNorm) || nameNorm.includes(boqName)) {
                score += 45;
              }

              if (score > highestScore) {
                highestScore = score;
                bestMatch = boq;
              }
            });

            const matchedSpec = bestMatch ? getBoqSpec(bestMatch) : (rawSpec && rawSpec !== "-" ? rawSpec : "-");
            const matchedCode = bestMatch ? getBoqCode(bestMatch) : rawCode;
            const finalScore = Math.min(100, Math.round(highestScore));

            parsedList.push({
              id: autoId++,
              originalName: rawName,
              originalSpec: rawSpec,
              originalQty: qtyNum,
              originalUnit: rawUnit,
              originalNote: rawNote,
              matchedBoqId: bestMatch?.itemId || bestMatch?.id || null,
              matchedBoqCode: matchedCode,
              matchedBoqName: bestMatch ? getBoqName(bestMatch) : rawName,
              matchedBoqSpec: matchedSpec,
              matchedBoqUnit: bestMatch?.unit || rawUnit,
              matchScore: finalScore,
            });
          }
        });

        if (parsedList.length === 0) {
          toast.warning("Tidak ada baris barang dengan 'Qty Diminta' > 0 yang ditemukan di Excel.");
        } else {
          toast.success(`Berhasil membaca ${parsedList.length} barang pengajuan dari Excel!`);
        }

        setRows(parsedList);
      } catch (err: any) {
        toast.error(`Gagal membaca Excel: ${err.message}`);
      } finally {
        setIsParsing(false);
        e.target.value = "";
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleDeleteRow = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSelectBoQ = (rowId: number, targetBoqItem: any) => {
    if (!targetBoqItem) return;

    const bSpec = getBoqSpec(targetBoqItem);
    const bCode = getBoqCode(targetBoqItem);
    const bName = getBoqName(targetBoqItem);

    setRows((prev) =>
      prev.map((r) => {
        if (r.id === rowId) {
          return {
            ...r,
            matchedBoqId: targetBoqItem.itemId || targetBoqItem.id,
            matchedBoqCode: bCode,
            matchedBoqName: bName,
            matchedBoqSpec: bSpec,
            matchedBoqUnit: targetBoqItem.unit || r.originalUnit,
            matchScore: 100,
          };
        }
        return r;
      })
    );
    setOpenPopoverId(null);
  };

  const handleUpdateQty = (rowId: number, newQty: number) => {
    const validQty = Math.max(0.01, newQty);
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, originalQty: validQty } : r))
    );
  };

  const handleConfirm = () => {
    if (rows.length === 0) return;

    const importedItems = rows.map((r) => ({
      name: r.matchedBoqName || r.originalName,
      typeMerk: r.matchedBoqSpec !== "-" ? r.matchedBoqSpec : r.originalSpec,
      qty: r.originalQty,
      unit: r.matchedBoqUnit || r.originalUnit,
      note: r.originalNote,
      materialId: r.matchedBoqId || null,
      materialCode: r.matchedBoqCode || null,
    }));

    onConfirmImport(importedItems);
    toast.success(`${importedItems.length} item berhasil dimasukkan ke form pengajuan SPB!`);
    onOpenChange(false);
  };

  const filteredRows = rows.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.originalName.toLowerCase().includes(q) ||
      r.matchedBoqName.toLowerCase().includes(q) ||
      r.originalSpec.toLowerCase().includes(q) ||
      r.matchedBoqSpec.toLowerCase().includes(q) ||
      r.matchedBoqCode.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl rounded-2xl p-4 sm:p-6 max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader className="border-b border-border/50 pb-3">
          <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary shrink-0" />
            Smart Import Excel SPB (BoQ Matcher)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground pt-0.5">
            Impor pengajuan SPB dari Excel yang dicocokkan otomatis dengan data BoQ Proyek{" "}
            <span className="font-semibold text-foreground">{project?.projectName || "-"}</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Top Control Bar */}
        <div className="bg-muted/30 p-3 sm:p-4 rounded-xl border border-border/60 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between my-2">
          <div className="space-y-1">
            <span className="text-xs font-bold text-foreground block">
              Step 1: Download Template Pre-filled
            </span>
            <p className="text-[11px] text-muted-foreground">
              Template Excel berisi daftar barang BoQ proyek ini ({boqItems.length} barang).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="h-8.5 text-xs font-semibold rounded-lg border-primary/40 text-primary hover:bg-primary/10 gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download Template ({boqItems.length} BoQ)
            </Button>

            <div className="relative">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                disabled={isParsing}
              />
              <Button
                size="sm"
                className="h-8.5 text-xs font-bold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 cursor-pointer shadow-none"
              >
                {isParsing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4" />
                )}
                Upload Excel Pengajuan
              </Button>
            </div>
          </div>
        </div>

        {/* Table Preview Items */}
        {rows.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0 space-y-2.5 my-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
                  {rows.length} Barang Terdeteksi
                </Badge>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  Periksa pencocokan & sesuaikan Qty pengajuan sebelum dikonfirmasi.
                </span>
              </div>

              <div className="relative w-48 sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cari barang / spesifikasi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2 h-7.5 text-xs rounded-lg border border-border/60 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* List Table */}
            <div className="flex-1 overflow-y-auto border border-border/60 rounded-xl bg-background p-2.5 space-y-2.5 min-h-0">
              {filteredRows.map((r) => {
                const isMatched = r.matchScore >= 50;
                const displaySpec = r.matchedBoqSpec !== "-" ? r.matchedBoqSpec : (r.originalSpec || "-");

                return (
                  <div
                    key={r.id}
                    className="p-3 sm:p-3.5 rounded-xl border border-border/60 bg-card hover:border-primary/30 transition-all text-xs space-y-2"
                  >
                    {/* Header Baris: Nama & Qty Editor */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {r.matchedBoqCode && (
                            <span className="text-[11px] font-bold text-primary bg-primary/10 px-1.5 py-0.2 rounded border border-primary/20 shrink-0">
                              {r.matchedBoqCode}
                            </span>
                          )}
                          <h4 className="font-bold text-foreground text-xs sm:text-sm truncate">
                            {r.originalName}
                          </h4>
                        </div>
                        <div className="text-[11px] text-muted-foreground pt-0.5">
                          Spec: <span className="text-foreground font-medium">{displaySpec}</span>
                        </div>
                      </div>

                      {/* Controls Qty Edit */}
                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                        <span className="text-[11px] text-muted-foreground font-medium">Qty SPB:</span>
                        <div className="flex items-center border border-border/60 rounded-lg overflow-hidden bg-background">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(r.id, r.originalQty - 1)}
                            className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <Input
                            type="number"
                            step="any"
                            min="0.01"
                            value={r.originalQty}
                            onChange={(e) => handleUpdateQty(r.id, parseFloat(e.target.value) || 0)}
                            className="w-16 h-7 border-0 text-center font-bold text-xs p-0 focus-visible:ring-0 rounded-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(r.id, r.originalQty + 1)}
                            className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-xs font-semibold text-foreground uppercase">{r.originalUnit}</span>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRow(r.id)}
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg shrink-0 cursor-pointer ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Searchable Combobox Popover untuk Match BoQ */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] pt-0.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="text-muted-foreground font-medium shrink-0">Match BoQ:</span>
                        
                        <Popover
                          open={openPopoverId === r.id}
                          onOpenChange={(isOpen) => setOpenPopoverId(isOpen ? r.id : null)}
                        >
                          <PopoverTrigger className="h-8 justify-between text-left text-xs font-normal w-full max-w-lg rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 cursor-pointer px-3 py-1 flex items-center shrink-0">
                            <span className="truncate font-medium">
                              {r.matchedBoqId
                                ? `${r.matchedBoqCode ? `[${r.matchedBoqCode}] ` : ""}${r.matchedBoqName} ${r.matchedBoqSpec !== "-" ? `| Spec: ${r.matchedBoqSpec}` : ""}`
                                : "-- Pilih Barang BoQ Cocok --"}
                            </span>
                            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                          </PopoverTrigger>
                          <PopoverContent className="w-85 sm:w-125 p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Cari kode, nama barang, spesifikasi..." className="h-9 text-xs" />
                              <CommandList className="max-h-60 overflow-y-auto">
                                <CommandEmpty className="p-3 text-xs text-muted-foreground text-center">
                                  Tidak ada barang BoQ yang cocok.
                                </CommandEmpty>
                                <CommandGroup heading={`Daftar Barang BoQ (${boqItems.length})`}>
                                  {boqItems.map((boq) => {
                                    const bName = getBoqName(boq);
                                    const bSpec = getBoqSpec(boq);
                                    const bCode = getBoqCode(boq);
                                    const isSelected = r.matchedBoqId === (boq.itemId || boq.id);

                                    return (
                                      <CommandItem
                                        key={boq.id || boq.itemId}
                                        value={`${bCode} ${bName} ${bSpec}`}
                                        onSelect={() => handleSelectBoQ(r.id, boq)}
                                        className="text-xs cursor-pointer flex items-center justify-between p-2"
                                      >
                                        <div className="flex flex-col min-w-0 pr-2">
                                          <div className="flex items-center gap-1.5">
                                            {bCode && (
                                              <span className="text-[10px] font-bold text-primary bg-primary/10 px-1 py-0.1 rounded border border-primary/20">
                                                {bCode}
                                              </span>
                                            )}
                                            <span className="font-semibold text-foreground truncate">{bName}</span>
                                          </div>
                                          <span className="text-[11px] text-muted-foreground truncate mt-0.5">
                                            Spec: <span className="text-foreground/80 font-medium">{bSpec}</span> ({boq.qty} {boq.unit})
                                          </span>
                                        </div>
                                        {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {isMatched ? (
                        <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 font-semibold text-[10px] gap-1 px-2 py-0.5 shrink-0 self-start sm:self-auto">
                          <CheckCircle2 className="w-3 h-3" />
                          Match ({r.matchScore}%)
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/10 text-amber-700 border-amber-300 font-semibold text-[10px] gap-1 px-2 py-0.5 shrink-0 self-start sm:self-auto">
                          <AlertTriangle className="w-3 h-3" />
                          Pilih BoQ Manual
                        </Badge>
                      )}
                    </div>

                    {r.originalNote && (
                      <div className="text-[10px] text-muted-foreground italic bg-muted/20 px-2 py-1 rounded border border-border/40">
                        Catatan Excel: {r.originalNote}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="mt-2 border-t border-border/50 pt-3 flex justify-between items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-lg text-xs font-semibold cursor-pointer"
          >
            Batal
          </Button>

          {rows.length > 0 && (
            <Button
              size="sm"
              onClick={handleConfirm}
              className="rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 cursor-pointer shadow-none"
            >
              <CheckCircle2 className="w-4 h-4" />
              Konfirmasi & Masukkan ({rows.length} Barang) ke SPB
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
