"use client";

import React, { useTransition, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Hammer, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { updateStructureItemChecklist } from "@/app/actions/conveyor-progress";

// Custom simple Progress bar to avoid dependency on progress.tsx
function CustomProgress({ value }: { value: number }) {
  return (
    <div className="w-full bg-muted dark:bg-muted/40 rounded-full h-2 overflow-hidden">
      <div
        className="bg-primary h-full transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function StructureProgressTable({ units }: { units: any[] }) {
  const [isPending, startTransition] = useTransition();
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>(
    units.reduce((acc, u) => ({ ...acc, [u.id]: true }), {}),
  );

  const toggleExpand = (unitId: string) => {
    setExpandedUnits((prev) => ({ ...prev, [unitId]: !prev[unitId] }));
  };

  const handleToggle = (
    itemId: string,
    stepField: string,
    currentValue: boolean,
  ) => {
    startTransition(async () => {
      const res = await updateStructureItemChecklist(itemId, {
        [stepField]: !currentValue,
      });

      if (res.success) {
        toast.success("Progress struktur berhasil diperbarui!");
      } else {
        toast.error(res.error || "Gagal memperbarui progress");
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50 shadow-xl bg-card/60 backdrop-blur-md overflow-hidden rounded-2xl pt-0">
        <CardHeader className="bg-linear-to-r from-primary/5 via-transparent to-primary/5 pt-4 px-6 pb-4 border-b border-border/20">
          <CardTitle className="text-lg font-bold gap-1.5 flex items-center">
            <Hammer className="w-5 h-5 text-primary" /> Fabrikasi Struktur
            (Structure Progress)
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground/80">
            Perbarui checklist status pabrikasi rangka utama conveyor. Bobot
            langkah: C/D (15%), Setting (35%), Welding (40%), Finishing (5%),
            Painting (3.5%), Packaging (1.5%).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {units.map((unit) => {
            if (unit.unitType === "MECHANICAL") return null;

            const isExpanded = !!expandedUnits[unit.id];
            const totalItems = unit.structureItems.length;
            const avgProgress =
              totalItems > 0
                ? unit.structureItems.reduce(
                    (sum: number, item: any) =>
                      sum + Number(item.progressPercent || 0),
                    0,
                  ) / totalItems
                : 0;

            return (
              <div
                key={unit.id}
                className="border border-border/50 rounded-xl overflow-hidden bg-background/20 backdrop-blur-sm"
              >
                {/* Header Collapsible */}
                <div
                  onClick={() => toggleExpand(unit.id)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/10 transition-colors select-none border-b border-border/40"
                >
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground">
                      {unit.name}
                    </h4>
                    <span className="text-xs text-muted-foreground/80">
                      Total item struktur: {totalItems}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-36 hidden sm:block">
                      <CustomProgress value={avgProgress} />
                    </div>
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none font-bold">
                      {avgProgress.toFixed(1)}%
                    </Badge>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Collapsible Content */}
                {isExpanded && (
                  <div className="p-4 bg-background/40">
                    <div className="rounded-xl border border-border/40 overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/40">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="font-semibold text-xs py-3">
                              Nama Item Rangka
                            </TableHead>
                            <TableHead className="font-semibold text-xs text-center w-20">
                              C/D (15%)
                            </TableHead>
                            <TableHead className="font-semibold text-xs text-center w-20">
                              Sett (35%)
                            </TableHead>
                            <TableHead className="font-semibold text-xs text-center w-20">
                              Weld (40%)
                            </TableHead>
                            <TableHead className="font-semibold text-xs text-center w-16">
                              Fin (5%)
                            </TableHead>
                            <TableHead className="font-semibold text-xs text-center w-20">
                              Paint (3.5%)
                            </TableHead>
                            <TableHead className="font-semibold text-xs text-center w-20">
                              Pack (1.5%)
                            </TableHead>
                            <TableHead className="font-semibold text-xs text-right w-24">
                              Progress
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {unit.structureItems.map((item: any) => (
                            <TableRow
                              key={item.id}
                              className="hover:bg-muted/5 transition-colors"
                            >
                              <td className="font-medium text-xs py-3">
                                {item.name}
                              </td>
                              <td className="text-center">
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={item.cuttingDone}
                                    disabled={isPending}
                                    onCheckedChange={() =>
                                      handleToggle(
                                        item.id,
                                        "cuttingDone",
                                        item.cuttingDone,
                                      )
                                    }
                                  />
                                </div>
                              </td>
                              <td className="text-center">
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={item.settingDone}
                                    disabled={isPending}
                                    onCheckedChange={() =>
                                      handleToggle(
                                        item.id,
                                        "settingDone",
                                        item.settingDone,
                                      )
                                    }
                                  />
                                </div>
                              </td>
                              <td className="text-center">
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={item.weldingDone}
                                    disabled={isPending}
                                    onCheckedChange={() =>
                                      handleToggle(
                                        item.id,
                                        "weldingDone",
                                        item.weldingDone,
                                      )
                                    }
                                  />
                                </div>
                              </td>
                              <td className="text-center">
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={item.finishingDone}
                                    disabled={isPending}
                                    onCheckedChange={() =>
                                      handleToggle(
                                        item.id,
                                        "finishingDone",
                                        item.finishingDone,
                                      )
                                    }
                                  />
                                </div>
                              </td>
                              <td className="text-center">
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={item.paintingDone}
                                    disabled={isPending}
                                    onCheckedChange={() =>
                                      handleToggle(
                                        item.id,
                                        "paintingDone",
                                        item.paintingDone,
                                      )
                                    }
                                  />
                                </div>
                              </td>
                              <td className="text-center">
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={item.packagingDone}
                                    disabled={isPending}
                                    onCheckedChange={() =>
                                      handleToggle(
                                        item.id,
                                        "packagingDone",
                                        item.packagingDone,
                                      )
                                    }
                                  />
                                </div>
                              </td>
                              <td className="text-right">
                                <span className="text-xs font-bold text-primary">
                                  {Number(item.progressPercent).toFixed(1)}%
                                </span>
                              </td>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
