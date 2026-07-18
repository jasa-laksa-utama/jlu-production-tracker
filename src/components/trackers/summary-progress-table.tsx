"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { WeeklyReportPDF } from "./weekly-report-pdf";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] w-full flex items-center justify-center text-xs font-semibold text-muted-foreground bg-muted/20 border border-dashed rounded-xl">
        Memuat PDF Viewer...
      </div>
    ),
  },
);

export function SummaryProgressTable({
  project,
  masterplan,
  units,
}: {
  project: any;
  masterplan: any;
  units: any[];
}) {
  const [showPdf, setShowPdf] = useState(false);

  // Find Fabrication phase to read its weight
  const fabPhase = masterplan.phases.find(
    (p: any) => p.code === "FAB_STRUCT_MECH",
  );
  const fabWeight = fabPhase ? Number(fabPhase.weightPercent || 35) : 35;

  let totalWeightedContribution = 0;
  let totalWeight = 0;

  const rowData = units.map((unit) => {
    // Calc structure average progress
    const sItems = unit.structureItems || [];
    const avgS =
      sItems.length > 0
        ? sItems.reduce(
            (sum: number, i: any) => sum + Number(i.progressPercent || 0),
            0,
          ) / sItems.length
        : 0;

    // Calc mechanical average progress
    const mItems = unit.mechanicalItems || [];
    const avgM =
      mItems.length > 0
        ? mItems.reduce(
            (sum: number, i: any) => sum + Number(i.progressPercent || 0),
            0,
          ) / mItems.length
        : 0;

    // Combined progress based on unitType
    let progress = 0;
    if (unit.unitType === "STRUCTURE") progress = avgS;
    else if (unit.unitType === "MECHANICAL") progress = avgM;
    else progress = (avgS + avgM) / 2; // BOTH

    // Bobot (Weight share of the total Fabrication phase weight)
    const weightShare = fabWeight / units.length;
    const contribution = (progress * weightShare) / 100;

    totalWeight += weightShare;
    totalWeightedContribution += contribution;

    return {
      id: unit.id,
      name: unit.name,
      satuan: unit.satuan,
      volume: unit.volume,
      unitType: unit.unitType,
      weightShare,
      progress,
      contribution,
    };
  });

  return (
    <>
      <Card className="border-border/50 shadow-xl bg-card/60 backdrop-blur-md overflow-hidden rounded-2xl pt-0">
        <CardHeader className="bg-linear-to-r from-primary/5 via-transparent to-primary/5 pt-4 px-6 pb-4 border-b border-border/20 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold gap-1.5 flex items-center">
              <ClipboardList className="w-5 h-5 text-primary" /> Rekapitulasi
              Progres Produksi (Summary Progress)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground/80">
              Daftar prestasi & nilai kontribusi per unit conveyor terhadap
              bobot total Fabrikasi Rangka & Mekanik.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPdf(true)}
            className="h-8 text-xs font-semibold px-3 gap-1.5 rounded-lg border-border/80 hover:bg-primary/5 hover:text-primary hover:border-primary/20 shadow-none cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak PDF
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="rounded-xl border border-border/40 overflow-hidden bg-background/40 mb-6">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <th className="p-3 text-xs font-semibold text-left">
                    Nama Unit Pekerjaan
                  </th>
                  <th className="p-3 text-xs font-semibold text-center w-24">
                    Satuan
                  </th>
                  <th className="p-3 text-xs font-semibold text-center w-24">
                    Vol
                  </th>
                  <th className="p-3 text-xs font-semibold text-center w-32">
                    Bobot (%)
                  </th>
                  <th className="p-3 text-xs font-semibold text-center w-36">
                    Prestasi (%)
                  </th>
                  <th className="p-3 text-xs font-semibold text-right w-36">
                    Kontribusi (%)
                  </th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowData.map((row) => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-muted/5 transition-colors"
                  >
                    <td className="p-3 font-semibold text-xs text-left">
                      {row.name}
                    </td>
                    <td className="p-3 text-center text-xs text-muted-foreground">
                      {row.satuan}
                    </td>
                    <td className="p-3 text-center text-xs text-muted-foreground">
                      {row.volume}
                    </td>
                    <td className="p-3 text-center text-xs font-medium">
                      {row.weightShare.toFixed(2)}%
                    </td>
                    <td className="p-3 text-center text-xs font-semibold text-primary">
                      {row.progress.toFixed(2)}%
                    </td>
                    <td className="p-3 text-right text-xs font-bold text-green-600">
                      {row.contribution.toFixed(2)}%
                    </td>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-bold border-t-2 border-border/80">
                  <td className="p-3 text-xs text-left" colSpan={3}>
                    TOTAL PEKERJAAN FABRIKASI
                  </td>
                  <td className="p-3 text-center text-xs">
                    {totalWeight.toFixed(2)}%
                  </td>
                  <td className="p-3 text-center text-xs text-primary">
                    {((totalWeightedContribution / totalWeight) * 100).toFixed(
                      2,
                    )}
                    %
                  </td>
                  <td className="p-3 text-right text-xs text-green-600">
                    {totalWeightedContribution.toFixed(2)}%
                  </td>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showPdf} onOpenChange={setShowPdf}>
        <DialogContent className="sm:max-w-[850px] md:max-w-[900px] w-full max-h-[95vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary" /> Pratinjau Dokumen PDF
              Weekly Progress Report
            </DialogTitle>
            <DialogDescription>
              Pratinjau laporan mingguan progress conveyor PT. Jasa Laksa Utama.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 rounded-xl overflow-hidden border border-border">
            <PDFViewer className="w-full h-[550px] border-none">
              <WeeklyReportPDF
                project={project}
                masterplan={masterplan}
                units={units}
              />
            </PDFViewer>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
