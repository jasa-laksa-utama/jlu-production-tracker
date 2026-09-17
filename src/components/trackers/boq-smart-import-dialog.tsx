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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  UploadCloud,
  X,
  FileSpreadsheet,
  Search,
  Trash2,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SmartExcelRow } from "@/lib/boq-excel-utils";
import { BoQItemDisplay } from "@/components/trackers/boq-manager-dialog";

const DEFAULT_UNITS = [
  "pcs",
  "mtr",
  "unit",
  "set",
  "kg",
  "batang",
  "roll",
  "lembar",
  "box",
  "ls",
  "lonjor",
  "sak",
  "can",
  "liter",
  "titik",
  "pack",
  "m2",
  "m3",
];

interface BoQSmartImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsedRows: SmartExcelRow[];
  masterItems: any[];
  dbUnits?: any[];
  onConfirmImport: (items: BoQItemDisplay[]) => void;
}

export function BoQSmartImportDialog({
  open,
  onOpenChange,
  parsedRows,
  masterItems,
  dbUnits = [],
  onConfirmImport,
}: BoQSmartImportDialogProps) {
  const [rows, setRows] = useState<SmartExcelRow[]>([]);
  const [openPopoverId, setOpenPopoverId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Build combined unit options
  const availableUnits = Array.from(
    new Set([
      ...DEFAULT_UNITS,
      ...dbUnits.map((u) => u.name?.toLowerCase()).filter(Boolean),
    ]),
  );

  useEffect(() => {
    if (parsedRows) {
      setRows(JSON.parse(JSON.stringify(parsedRows)));
    }
  }, [parsedRows]);

  const exactCount = rows.filter((r) => r.matchStatus === "EXACT").length;
  const suggestedCount = rows.filter(
    (r) => r.matchStatus === "SUGGESTED",
  ).length;
  const unmatchedCount = rows.filter(
    (r) => r.matchStatus === "UNMATCHED",
  ).length;

  const handleSelectItem = (rowIndex: number, item: any | null) => {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== rowIndex) return r;

        if (!item) {
          return {
            ...r,
            selectedItem: null,
            matchStatus: "UNMATCHED",
            confidence: 0,
            matchReason: "Tidak Diterima",
          };
        }

        const stockUnit = (item.unit?.name || item.unit || "pcs").toLowerCase();

        return {
          ...r,
          selectedItem: item,
          unit: stockUnit,
          matchStatus: "EXACT",
          confidence: 100,
          matchReason: "Dipilih Manual",
        };
      }),
    );
    setOpenPopoverId(null);
  };

  const handleRemoveRow = (rowIndex: number) => {
    setRows((prev) => prev.filter((_, idx) => idx !== rowIndex));
  };

  const handleConfirm = () => {
    const finalItems: BoQItemDisplay[] = [];

    for (const r of rows) {
      if (!r.selectedItem) continue;

      finalItems.push({
        id: Math.random().toString(),
        itemId: r.selectedItem.id,
        itemCode: r.selectedItem.code,
        itemName: r.selectedItem.name,
        itemTypeMerk: r.selectedItem.typeMerk || r.rawType || undefined,
        qty: r.qty,
        unit: (
          r.unit ||
          r.selectedItem.unit?.name ||
          r.selectedItem.unit ||
          "pcs"
        ).toLowerCase(),
        price: r.price || 0,
        note: r.note || "",
      });
    }

    onConfirmImport(finalItems);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] md:max-w-6xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-3xl">
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border/40 bg-muted/20 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold">
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                Deteksi Pintar Import Excel BoQ
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Periksa & konfirmasi pencocokan otomatis barang dari Excel
                dengan Master Data Stok.
              </DialogDescription>
            </div>

            {/* Summary Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px] font-bold px-2.5 py-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                {exactCount} Exact Match
              </Badge>
              {suggestedCount > 0 && (
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[11px] font-bold px-2.5 py-1"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                  {suggestedCount} Perlu Konfirmasi
                </Badge>
              )}
              {unmatchedCount > 0 && (
                <Badge
                  variant="outline"
                  className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[11px] font-bold px-2.5 py-1"
                >
                  <HelpCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                  {unmatchedCount} Tidak Ditemukan
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Interactive Matching Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          <div className="border border-border/60 rounded-xl overflow-hidden shadow-xs bg-background">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-foreground text-xs font-semibold border-b border-border/40">
                  <tr>
                    <th className="p-3 w-10 text-center">No</th>
                    <th className="p-3">Data di Excel</th>
                    <th className="p-3 w-40 text-center">Qty & Satuan</th>
                    <th className="p-3">Pencocokan Master Data</th>
                    <th className="p-3 w-28 text-center">Status</th>
                    <th className="p-3 w-12 text-center">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-6 text-center text-muted-foreground italic"
                      >
                        Semua baris barang telah dihapus.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => {
                      const isExact = row.matchStatus === "EXACT";
                      const isSuggested = row.matchStatus === "SUGGESTED";
                      const isUnmatched = row.matchStatus === "UNMATCHED";

                      const currentUnit = row.unit?.toLowerCase() || "pcs";
                      if (!availableUnits.includes(currentUnit)) {
                        availableUnits.push(currentUnit);
                      }

                      return (
                        <tr
                          key={idx}
                          className={cn(
                            "hover:bg-muted/30 transition-colors",
                            isSuggested && "bg-amber-500/5",
                            isUnmatched && "bg-rose-500/5",
                          )}
                        >
                          <td className="p-3 text-center font-bold text-muted-foreground">
                            {idx + 1}
                          </td>

                          {/* Data Excel */}
                          <td className="p-3">
                            <div className="space-y-0.5">
                              <p className="font-semibold text-foreground">
                                {row.rawName || "-"}
                              </p>
                              <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-2">
                                {row.rawCode && (
                                  <span>
                                    Kode: <strong>{row.rawCode}</strong>
                                  </span>
                                )}
                                {row.rawType && (
                                  <span>
                                    Tipe: <strong>{row.rawType}</strong>
                                  </span>
                                )}
                              </p>
                            </div>
                          </td>

                          {/* Editable Qty & Dropdown Satuan */}
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <Input
                                type="number"
                                min="0.01"
                                step="any"
                                value={row.qty || ""}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setRows((prev) =>
                                    prev.map((r, i) =>
                                      i === idx ? { ...r, qty: val } : r,
                                    ),
                                  );
                                }}
                                className="w-16 h-8 text-center text-xs font-semibold bg-background border-2 border-border/60 rounded-lg px-1 focus-visible:ring-primary/20"
                              />
                              <select
                                value={currentUnit}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setRows((prev) =>
                                    prev.map((r, i) =>
                                      i === idx ? { ...r, unit: val } : r,
                                    ),
                                  );
                                }}
                                className="h-8 w-20 bg-background border-2 border-border/60 rounded-lg text-xs font-bold px-1 cursor-pointer uppercase outline-hidden focus-visible:border-primary/50"
                              >
                                {availableUnits.map((u) => (
                                  <option
                                    key={u}
                                    value={u}
                                    className="text-foreground bg-background font-semibold"
                                  >
                                    {u.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* Target Selection Dropdown */}
                          <td className="p-3">
                            <Popover
                              open={openPopoverId === idx}
                              onOpenChange={(open) =>
                                setOpenPopoverId(open ? idx : null)
                              }
                            >
                              <PopoverTrigger
                                role="combobox"
                                aria-expanded={openPopoverId === idx}
                                className={cn(
                                  "w-full flex items-center justify-between h-auto py-1.5 px-3 text-left font-normal text-xs rounded-lg border-2 bg-background cursor-pointer",
                                  isExact &&
                                    "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50",
                                  isSuggested &&
                                    "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60",
                                  isUnmatched &&
                                    "border-rose-500/40 bg-rose-500/5 hover:border-rose-500/60",
                                )}
                              >
                                {row.selectedItem ? (
                                  <div className="truncate pr-2">
                                    <span className="font-semibold text-foreground">
                                      {row.selectedItem.name}
                                    </span>
                                    <span className="text-[10px] font-medium text-muted-foreground block truncate">
                                      Kode: {row.selectedItem.code || "-"}
                                      {" • Satuan: " +
                                        (
                                          row.selectedItem.unit?.name ||
                                          row.selectedItem.unit ||
                                          "pcs"
                                        ).toUpperCase()}
                                      {row.selectedItem.typeMerk &&
                                        ` • Tipe: ${row.selectedItem.typeMerk}`}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground font-semibold text-xs italic">
                                    -- Pilih Barang Master Data --
                                  </span>
                                )}
                                <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-50 ml-1" />
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-130 max-w-[90vw] p-0 rounded-xl border border-border shadow-xl bg-background"
                                align="start"
                              >
                                <Command>
                                  <CommandInput
                                    placeholder="Cari barang master data..."
                                    onValueChange={setSearchQuery}
                                  />
                                  <CommandList className="max-h-60 overflow-y-auto p-1">
                                    <CommandEmpty className="p-3 text-center text-xs text-muted-foreground">
                                      Barang tidak ditemukan di Master Data.
                                    </CommandEmpty>

                                    {/* Section Candidate Suggestions */}
                                    {row.candidates &&
                                      row.candidates.length > 0 && (
                                        <CommandGroup heading="Rekomendasi Deteksi Pintar">
                                          {row.candidates.map((cand) => {
                                            const stockUnit = (
                                              cand.item.unit?.name ||
                                              cand.item.unit ||
                                              "pcs"
                                            ).toUpperCase();

                                            return (
                                              <CommandItem
                                                key={`cand-${cand.item.id}`}
                                                value={`${cand.item.name} ${cand.item.code}`}
                                                onSelect={() =>
                                                  handleSelectItem(
                                                    idx,
                                                    cand.item,
                                                  )
                                                }
                                                className="flex items-center justify-between py-1.5 px-2.5 cursor-pointer border-b border-border/10 last:border-0 hover:bg-primary/5 rounded-md my-0.5"
                                              >
                                                <div className="flex flex-col">
                                                  <span className="font-bold text-[11.5px] leading-snug">
                                                    {cand.item.name}
                                                  </span>
                                                  <span className="text-[10px] text-muted-foreground leading-tight">
                                                    Kode:{" "}
                                                    {cand.item.code || "-"} •
                                                    Satuan Stok:{" "}
                                                    <strong className="text-foreground">
                                                      {stockUnit}
                                                    </strong>
                                                    {cand.item.typeMerk &&
                                                      ` • Tipe: ${cand.item.typeMerk}`}
                                                  </span>
                                                </div>
                                                <Badge
                                                  variant="secondary"
                                                  className="text-[9.5px] font-black text-amber-600 bg-amber-50 shrink-0 ml-2 py-0 px-1.5"
                                                >
                                                  {cand.reason}
                                                </Badge>
                                              </CommandItem>
                                            );
                                          })}
                                        </CommandGroup>
                                      )}

                                    {/* All Master Items */}
                                    <CommandGroup heading="Seluruh Master Data Barang">
                                      {masterItems
                                        .filter((m) => {
                                          const isCatA =
                                            (m.category || "A").toUpperCase() ===
                                            "A";
                                          if (!isCatA) return false;

                                          if (!searchQuery) return true;
                                          const q = searchQuery.toLowerCase();
                                          return (
                                            m.name?.toLowerCase().includes(q) ||
                                            m.code?.toLowerCase().includes(q) ||
                                            m.typeMerk
                                              ?.toLowerCase()
                                              .includes(q)
                                          );
                                        })
                                        .map((m) => {
                                          const stockUnit = (
                                            m.unit?.name ||
                                            m.unit ||
                                            "pcs"
                                          ).toUpperCase();

                                          return (
                                            <CommandItem
                                              key={m.id}
                                              value={`${m.name} ${m.code}`}
                                              onSelect={() =>
                                                handleSelectItem(idx, m)
                                              }
                                              className="flex flex-col items-start py-1.5 px-2.5 cursor-pointer border-b border-border/10 last:border-0 hover:bg-primary/5 rounded-md my-0.5"
                                            >
                                              <span className="font-bold text-[11.5px] leading-snug">
                                                {m.name}
                                              </span>
                                              <span className="text-[10px] text-muted-foreground leading-tight">
                                                Kode: {m.code || "-"} • Satuan
                                                Stok:{" "}
                                                <strong className="text-foreground">
                                                  {stockUnit}
                                                </strong>
                                                {m.typeMerk &&
                                                  ` • Tipe: ${m.typeMerk}`}
                                              </span>
                                            </CommandItem>
                                          );
                                        })}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </td>

                          {/* Status Badge */}
                          <td className="p-3 text-center">
                            {isExact && (
                              <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20 text-[10px] font-bold">
                                {row.matchReason}
                              </Badge>
                            )}
                            {isSuggested && (
                              <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20 text-[10px] font-bold">
                                {row.matchReason}
                              </Badge>
                            )}
                            {isUnmatched && (
                              <Badge className="bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-500/20 text-[10px] font-bold">
                                {row.matchReason}
                              </Badge>
                            )}
                          </td>

                          {/* Delete Button Action */}
                          <td className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveRow(idx)}
                              className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                              title="Hapus / Gajadi Import Baris Ini"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 sm:p-6 border-t border-border/40 bg-muted/10 flex items-center justify-between gap-3 shrink-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs font-bold"
          >
            Batal
          </Button>

          <Button
            onClick={handleConfirm}
            disabled={rows.filter((r) => r.selectedItem).length === 0}
            className="bg-primary text-white hover:bg-primary/90 text-xs font-bold gap-2 px-5 py-2.5 rounded-xl shadow-sm shadow-primary/20 cursor-pointer"
          >
            Konfirmasi ({rows.filter((r) => r.selectedItem).length} Item)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
