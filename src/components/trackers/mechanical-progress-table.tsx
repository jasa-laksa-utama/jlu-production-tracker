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
import { Wrench, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { updateMechanicalItemChecklist } from "@/app/actions/conveyor-progress";

// Custom simple Progress bar
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

export function MechanicalProgressTable({ units }: { units: any[] }) {
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
      const res = await updateMechanicalItemChecklist(itemId, {
        [stepField]: !currentValue,
      });

      if (res.success) {
        toast.success("Progress mekanikal berhasil diperbarui!");
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
            <Wrench className="w-5 h-5 text-primary" /> Komponen Mekanis
            (Mechanical Progress)
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground/80">
            Perbarui checklist status pengadaan dan perakitan komponen mekanik
            conveyor. Bobot langkah: Procurement (40%), P.O (10%), Fabrication
            (45%), Packaging (5%).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {units.map((unit) => {
            if (unit.unitType === "STRUCTURE") return null;

            const isExpanded = !!expandedUnits[unit.id];
            const totalItems = unit.mechanicalItems.length;
            const avgProgress =
              totalItems > 0
                ? unit.mechanicalItems.reduce(
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
                      Total item mekanikal: {totalItems}
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
                              Nama Komponen Penggerak
                            </TableHead>
                            <TableHead className="font-semibold text-xs text-center w-28">
                              Procure (40%)
                            </TableHead>
                            <TableHead className="font-semibold text-xs text-center w-28">
                              P.O (10%)
                            </TableHead>
                            <TableHead className="font-semibold text-xs text-center w-28">
                              Fabr (45%)
                            </TableHead>
                            <TableHead className="font-semibold text-xs text-center w-28">
                              Pack (5%)
                            </TableHead>
                            <TableHead className="font-semibold text-xs text-right w-24">
                              Progress
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {unit.mechanicalItems.map((item: any) => (
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
                                    checked={item.procurementDone}
                                    disabled={isPending}
                                    onCheckedChange={() =>
                                      handleToggle(
                                        item.id,
                                        "procurementDone",
                                        item.procurementDone,
                                      )
                                    }
                                  />
                                </div>
                              </td>
                              <td className="text-center">
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={item.poDone}
                                    disabled={isPending}
                                    onCheckedChange={() =>
                                      handleToggle(
                                        item.id,
                                        "poDone",
                                        item.poDone,
                                      )
                                    }
                                  />
                                </div>
                              </td>
                              <td className="text-center">
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={item.fabricationDone}
                                    disabled={isPending}
                                    onCheckedChange={() =>
                                      handleToggle(
                                        item.id,
                                        "fabricationDone",
                                        item.fabricationDone,
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
