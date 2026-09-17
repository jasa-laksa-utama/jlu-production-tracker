"use client";

import { useState, useMemo, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Layers,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Clock,
  Loader2,
  Check,
  X,
  Eye,
  Package,
} from "lucide-react";
import { SPBSubstitutionCard } from "@/components/trackers/spb-substitution-card";
import { QCReceiptReportPreviewDialog } from "@/components/trackers/qc-receipt-report-preview-dialog";
import {
  approveQCReceiptByEngineering,
  rejectQCReceiptByEngineering,
} from "@/app/actions/qc-receipt-approval";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatJakartaDate } from "@/lib/date-utils";

interface EngineeringSpbApprovalClientProps {
  initialSubstitutions: any[];
  initialQCReceipts?: any[];
}

export function EngineeringSpbApprovalClient({
  initialSubstitutions,
  initialQCReceipts = [],
}: EngineeringSpbApprovalClientProps) {
  const [activeTab, setActiveTab] = useState<"substitution" | "qc_receipt">("substitution");
  const [substitutions, setSubstitutions] = useState(initialSubstitutions);
  const [qcReceipts, setQcReceipts] = useState<any[]>(initialQCReceipts);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [isPending, startTransition] = useTransition();

  // State untuk Preview PDF Laporan QC
  const [previewPO, setPreviewPO] = useState<any | null>(null);

  // State Disposisi Barang Reject per PO & Item
  // { [poId]: { notes: string, dispositions: { [itemId]: { disposition: 'USE_AS_IS' | 'RETURN_TO_VENDOR', notes: string } } } }
  const [poDispositions, setPoDispositions] = useState<
    Record<
      string,
      {
        notes: string;
        dispositions: Record<
          string,
          { disposition: "USE_AS_IS" | "RETURN_TO_VENDOR"; notes: string }
        >;
      }
    >
  >({});

  // State Reject Dialog
  const [rejectDialogState, setRejectDialogState] = useState<{
    open: boolean;
    poId: string;
    poNumber: string;
    reason: string;
  }>({
    open: false,
    poId: "",
    poNumber: "",
    reason: "",
  });

  // State Approve Confirmation Dialog
  const [approvingPO, setApprovingPO] = useState<any | null>(null);

  // Inisialisasi disposisi default untuk item dengan failed > 0
  const getPODispositionState = (po: any) => {
    if (poDispositions[po.id]) return poDispositions[po.id];
    const initialDisps: Record<
      string,
      { disposition: "USE_AS_IS" | "RETURN_TO_VENDOR"; notes: string }
    > = {};

    (po.items || []).forEach((it: any) => {
      if ((Number(it.qtyFailed) || 0) > 0) {
        initialDisps[it.id] = {
          disposition: (it.qcDisposition as any) === "USE_AS_IS" ? "USE_AS_IS" : "USE_AS_IS",
          notes: it.qcDispositionNotes || "",
        };
      }
    });

    return {
      notes: po.qcEngineeringNotes || "",
      dispositions: initialDisps,
    };
  };

  const handleSetItemDisposition = (
    poId: string,
    itemId: string,
    disposition: "USE_AS_IS" | "RETURN_TO_VENDOR"
  ) => {
    setPoDispositions((prev) => {
      const currentPO = prev[poId] || { notes: "", dispositions: {} };
      const currentItem = currentPO.dispositions[itemId] || {
        disposition: "USE_AS_IS",
        notes: "",
      };

      return {
        ...prev,
        [poId]: {
          ...currentPO,
          dispositions: {
            ...currentPO.dispositions,
            [itemId]: {
              ...currentItem,
              disposition,
            },
          },
        },
      };
    });
  };

  const handleSetItemDispositionNotes = (
    poId: string,
    itemId: string,
    notes: string
  ) => {
    setPoDispositions((prev) => {
      const currentPO = prev[poId] || { notes: "", dispositions: {} };
      const currentItem = currentPO.dispositions[itemId] || {
        disposition: "USE_AS_IS",
        notes: "",
      };

      return {
        ...prev,
        [poId]: {
          ...currentPO,
          dispositions: {
            ...currentPO.dispositions,
            [itemId]: {
              ...currentItem,
              notes,
            },
          },
        },
      };
    });
  };

  const handleSetPONotes = (poId: string, notes: string) => {
    setPoDispositions((prev) => {
      const currentPO = prev[poId] || { notes: "", dispositions: {} };
      return {
        ...prev,
        [poId]: {
          ...currentPO,
          notes,
        },
      };
    });
  };

  // Submit Approval Engineering
  const handleApprovePO = (po: any) => {
    const poDispState = getPODispositionState(po);
    const dispositionsArray = Object.entries(poDispState.dispositions).map(
      ([itemId, val]) => ({
        itemId,
        disposition: val.disposition,
        notes: val.notes,
      })
    );

    startTransition(async () => {
      const res = await approveQCReceiptByEngineering({
        poId: po.id,
        notes: poDispState.notes,
        dispositions: dispositionsArray,
      });

      if (res.success) {
        toast.success(res.message || "Approval Engineering berhasil disimpan");
        setQcReceipts((prev) => prev.filter((p) => p.id !== po.id));
        setApprovingPO(null);
      } else {
        toast.error(res.error || "Gagal menyetujui hasil QC");
      }
    });
  };

  // Submit Reject Engineering
  const handleConfirmReject = () => {
    if (!rejectDialogState.reason.trim()) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }

    startTransition(async () => {
      const res = await rejectQCReceiptByEngineering(
        rejectDialogState.poId,
        rejectDialogState.reason
      );

      if (res.success) {
        toast.success(res.message || "Pengajuan QC dikembalikan");
        setQcReceipts((prev) =>
          prev.filter((p) => p.id !== rejectDialogState.poId)
        );
        setRejectDialogState({
          open: false,
          poId: "",
          poNumber: "",
          reason: "",
        });
      } else {
        toast.error(res.error || "Gagal menolak pengajuan");
      }
    });
  };

  // --- TAB 1: Substitusi Filtering & Grouping ---
  const filteredSubstitutions = useMemo(() => {
    return substitutions.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      const spbNo = (item.spb?.spbNumber || "").toLowerCase();
      const projName = (item.spb?.project?.projectName || "").toLowerCase();
      const custName = (item.spb?.project?.customer?.name || "").toLowerCase();
      const compName = (
        item.spb?.project?.customer?.company || ""
      ).toLowerCase();
      const itemName = (item.name || "").toLowerCase();

      return (
        spbNo.includes(q) ||
        projName.includes(q) ||
        custName.includes(q) ||
        compName.includes(q) ||
        itemName.includes(q)
      );
    });
  }, [substitutions, searchQuery]);

  const spbGroups = useMemo(() => {
    const map: { [key: string]: { spb: any; project: any; items: any[] } } = {};

    filteredSubstitutions.forEach((item) => {
      const spbKey = item.spb?.id || item.spbId || "unassigned";
      if (!map[spbKey]) {
        map[spbKey] = {
          spb: item.spb || { spbNumber: "SPB" },
          project: item.spb?.project || { projectName: "Tanpa Proyek" },
          items: [],
        };
      }
      map[spbKey].items.push(item);
    });

    return Object.values(map);
  }, [filteredSubstitutions]);

  // --- TAB 2: QC Receipts Filtering ---
  const filteredQCReceipts = useMemo(() => {
    return qcReceipts.filter((po) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      const poNum = (po.nomorPO || "").toLowerCase();
      const supplier = (po.kepada || po.supplier?.name || "").toLowerCase();
      const project = (po.projek || "").toLowerCase();
      const repNo = (po.qcReportNumber || "").toLowerCase();
      const hasItem = (po.items || []).some((it: any) =>
        (it.namaBarang || "").toLowerCase().includes(q)
      );

      return (
        poNum.includes(q) ||
        supplier.includes(q) ||
        project.includes(q) ||
        repNo.includes(q) ||
        hasItem
      );
    });
  }, [qcReceipts, searchQuery]);

  const totalPages =
    activeTab === "substitution"
      ? Math.ceil(spbGroups.length / pageSize) || 1
      : Math.ceil(filteredQCReceipts.length / pageSize) || 1;

  const activePage = Math.min(currentPage, totalPages);

  const paginatedSpbGroups = useMemo(() => {
    const start = (activePage - 1) * pageSize;
    return spbGroups.slice(start, start + pageSize);
  }, [spbGroups, activePage, pageSize]);

  const paginatedQCReceipts = useMemo(() => {
    const start = (activePage - 1) * pageSize;
    return filteredQCReceipts.slice(start, start + pageSize);
  }, [filteredQCReceipts, activePage, pageSize]);

  return (
    <div className="space-y-4 max-w-full 2xl:max-w-[1920px] mx-auto pb-10">
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as any);
          setCurrentPage(1);
          setSearchQuery("");
        }}
        className="w-full"
      >
        {/* Navigation Tabs Header */}
        <div className="w-full overflow-x-auto whitespace-nowrap flex-nowrap pb-1 mb-3 sm:mb-4 no-scrollbar">
          <TabsList className="inline-flex h-10 items-center justify-start rounded-2xl bg-muted/60 p-1 text-muted-foreground gap-1 border border-border/40 shrink-0">
            {/* Tab 1: Substitusi SPB */}
            <TabsTrigger
              value="substitution"
              className="rounded-xl px-3 sm:px-4 py-1.5 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer flex items-center gap-2"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Substitusi Barang SPB</span>
              {substitutions.length > 0 && (
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  {substitutions.length}
                </span>
              )}
            </TabsTrigger>

            {/* Tab 2: Persetujuan QC Penerimaan Barang */}
            <TabsTrigger
              value="qc_receipt"
              className="rounded-xl px-3 sm:px-4 py-1.5 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer flex items-center gap-2"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>Persetujuan QC Penerimaan Barang</span>
              {qcReceipts.length > 0 && (
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  {qcReceipts.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Search Bar & Pagination Controls */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-card border border-border/60 p-3 sm:p-4 rounded-xl shadow-xs mb-4">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={
                activeTab === "substitution"
                  ? "Cari No SPB, proyek, barang..."
                  : "Cari No PO, supplier, proyek, barang..."
              }
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 h-9 rounded-lg bg-muted/20 border border-border/60 text-xs focus-visible:ring-primary/20"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="h-8 text-xs font-semibold rounded-lg cursor-pointer gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={activePage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground font-semibold">
                  {activePage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={activePage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* TAB 1: Substitusi Barang SPB */}
        <TabsContent value="substitution" className="space-y-4 m-0 border-0 p-0 outline-hidden">
          {spbGroups.length === 0 ? (
            <Card className="rounded-xl border border-dashed p-8 text-center bg-card">
              <Layers className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">
                Tidak ada pengajuan substitusi SPB pending
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Semua pengajuan substitusi material dari tim gudang / purchasing telah diproses.
              </p>
            </Card>
          ) : (
            <Accordion type="multiple" className="space-y-3">
              {paginatedSpbGroups.map((group, idx) => (
                <AccordionItem
                  key={group.spb?.id || idx}
                  value={group.spb?.id || String(idx)}
                  className="border border-border/80 rounded-xl bg-card overflow-hidden shadow-2xs"
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline bg-muted/20 hover:bg-muted/40 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full pr-4 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-primary">
                          {group.spb?.spbNumber || "SPB"}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs font-semibold text-foreground">
                          {group.project?.projectName || "Proyek"}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] font-bold">
                        {group.items.length} Item Menunggu
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 space-y-3 pt-3">
                    {group.items.map((item) => (
                      <SPBSubstitutionCard
                        key={item.id}
                        item={item}
                        onUpdated={() => {
                          setSubstitutions((prev) =>
                            prev.filter((i) => i.id !== item.id)
                          );
                        }}
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        {/* TAB 2: Persetujuan QC Penerimaan Barang (Barang Reject) */}
        <TabsContent value="qc_receipt" className="space-y-4 m-0 border-0 p-0 outline-hidden">
          {filteredQCReceipts.length === 0 ? (
            <Card className="rounded-xl border border-dashed p-8 text-center bg-card">
              <ShieldCheck className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">
                Tidak ada pengujian QC PO yang menunggu disposisi Engineering
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Semua barang reject hasil inspeksi QC telah diverifikasi & disetujui disposisinya.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {paginatedQCReceipts.map((po: any) => {
                const dispState = getPODispositionState(po);
                const items = po.items || [];
                const failedItems = items.filter(
                  (i: any) => (Number(i.qtyFailed) || 0) > 0
                );
                const hasFailedItems = failedItems.length > 0;

                return (
                  <Card
                    key={po.id}
                    className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs hover:border-primary/40 transition-colors"
                  >
                    {/* Header Card PO */}
                    <CardHeader className="p-4 sm:p-5 bg-muted/20 border-b border-border/60">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-primary" />
                              PO: {po.nomorPO}
                            </span>
                            {po.qcReportNumber && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-mono font-bold border-primary/30 text-primary bg-primary/5"
                              >
                                {po.qcReportNumber}
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-400 animate-pulse"
                            >
                              <Clock className="w-3 h-3 mr-1 text-amber-600" />
                              Menunggu Disposisi Engineering (Barang Reject)
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap pt-0.5">
                            <span>
                              Supplier:{" "}
                              <strong className="text-foreground font-semibold">
                                {po.kepada || po.supplier?.name || "-"}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Proyek:{" "}
                              <strong className="text-foreground font-semibold">
                                {po.projek || "Gudang"}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Inspector QC:{" "}
                              <strong className="text-foreground font-semibold">
                                {po.qcApprovedBy || "QC Inspector"}
                              </strong>
                            </span>
                          </div>
                        </div>

                        {/* Tombol Pratinjau PDF */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewPO(po)}
                            className="h-8 text-xs font-semibold rounded-xl cursor-pointer gap-1.5 hover:bg-primary/10 hover:text-primary"
                          >
                            <FileText className="w-3.5 h-3.5 text-primary" />
                            Pratinjau PDF QC
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-5 space-y-4">
                      {/* Tabel Item Barang Hasil QC */}
                      <div className="rounded-xl border border-border/80 overflow-hidden bg-background">
                        <Table>
                          <TableHeader className="bg-muted/30">
                            <TableRow className="h-8 text-[11px] font-bold border-b border-border/60">
                              <TableHead className="w-10 text-center">No</TableHead>
                              <TableHead>Nama Barang & Spesifikasi</TableHead>
                              <TableHead className="w-20 text-center">Qty PO</TableHead>
                              <TableHead className="w-20 text-center text-emerald-600">Lolos</TableHead>
                              <TableHead className="w-20 text-center text-rose-600">Reject</TableHead>
                              <TableHead>Alasan Cacat / Analisa QC</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((it: any, idx: number) => {
                              const pQty = Number(it.qtyPassed) || 0;
                              const rQty = Number(it.qtyFailed) || 0;
                              const isFailed = rQty > 0;

                              return (
                                <TableRow
                                  key={it.id}
                                  className={cn(
                                    "text-xs border-b border-border/40",
                                    isFailed && "bg-rose-500/5"
                                  )}
                                >
                                  <TableCell className="text-center font-mono text-[11px] text-muted-foreground">
                                    {idx + 1}
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-semibold text-foreground">
                                      {it.namaBarang}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {it.ukuran || it.noticeMerkJenis || "-"}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center font-semibold">
                                    {it.qty} {it.satuan || "pcs"}
                                  </TableCell>
                                  <TableCell className="text-center font-bold text-emerald-600">
                                    {pQty} {it.satuan || "pcs"}
                                  </TableCell>
                                  <TableCell className="text-center font-bold text-rose-600">
                                    {rQty} {it.satuan || "pcs"}
                                  </TableCell>
                                  <TableCell>
                                    {isFailed ? (
                                      <div className="space-y-0.5">
                                        <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                                          <AlertTriangle className="w-3 h-3 shrink-0" />
                                          {it.qcDefectReason || "Ditolak oleh QC"}
                                        </span>
                                        {it.qcNotes && (
                                          <p className="text-[10px] text-muted-foreground">
                                            Catatan: {it.qcNotes}
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Lolos Inspeksi
                                      </span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* AREA DISPOSISI BARANG REJECT OLEH ENGINEERING */}
                      {hasFailedItems && (
                        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <h4 className="text-xs font-bold text-foreground">
                              Validasi & Disposisi Barang Reject ({failedItems.length} Item Cacat)
                            </h4>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Sebagai Engineering, tentukan apakah barang reject masih dalam toleransi teknis yang aman untuk digunakan (*Use As-Is / Keep*) atau harus dikembalikan ke vendor (*Retur*).
                          </p>

                          <div className="space-y-3 pt-1">
                            {failedItems.map((fItem: any) => {
                              const curDisp =
                                dispState.dispositions[fItem.id]?.disposition || "USE_AS_IS";
                              const curNotes =
                                dispState.dispositions[fItem.id]?.notes || "";

                              return (
                                <div
                                  key={fItem.id}
                                  className="p-3 bg-background border border-border/80 rounded-xl space-y-2.5 shadow-2xs"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                      <span className="font-bold text-xs text-foreground">
                                        {fItem.namaBarang}
                                      </span>
                                      <span className="text-[11px] text-rose-600 font-semibold ml-2">
                                        (Reject: {fItem.qtyFailed} {fItem.satuan})
                                      </span>
                                      <p className="text-[10px] text-muted-foreground">
                                        Cacat QC: {fItem.qcDefectReason || "-"}
                                      </p>
                                    </div>

                                    {/* Tombol Opsi Disposisi */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleSetItemDisposition(
                                            po.id,
                                            fItem.id,
                                            "USE_AS_IS"
                                          )
                                        }
                                        className={cn(
                                          "px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1",
                                          curDisp === "USE_AS_IS"
                                            ? "bg-amber-500 text-white border-amber-600 shadow-2xs"
                                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                                        )}
                                      >
                                        <Check className="w-3 h-3" />
                                        Disetujui Digunakan (Use As-Is)
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleSetItemDisposition(
                                            po.id,
                                            fItem.id,
                                            "RETURN_TO_VENDOR"
                                          )
                                        }
                                        className={cn(
                                          "px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1",
                                          curDisp === "RETURN_TO_VENDOR"
                                            ? "bg-rose-600 text-white border-rose-700 shadow-2xs"
                                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                                        )}
                                      >
                                        <X className="w-3 h-3" />
                                        Kembalikan (Retur)
                                      </button>
                                    </div>
                                  </div>

                                  {/* Input Catatan Teknis Engineering */}
                                  <div>
                                    <Input
                                      placeholder={
                                        curDisp === "USE_AS_IS"
                                          ? "Contoh alasan: Toleransi ketebalan masih aman untuk struktur penopang..."
                                          : "Contoh alasan retur: Dimensi melengkung tidak dapat dipasang..."
                                      }
                                      value={curNotes}
                                      onChange={(e) =>
                                        handleSetItemDispositionNotes(
                                          po.id,
                                          fItem.id,
                                          e.target.value
                                        )
                                      }
                                      className="h-7 text-xs bg-background"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Catatan Keseluruhan Engineering */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">
                          Catatan Tambahan Engineering (Opsional):
                        </Label>
                        <Textarea
                          rows={2}
                          placeholder="Tulis catatan atau rekomendasi teknis untuk disposisi..."
                          value={dispState.notes}
                          onChange={(e) => handleSetPONotes(po.id, e.target.value)}
                          className="text-xs min-h-[44px] py-1.5"
                        />
                      </div>

                      {/* Tombol Aksi Persetujuan / Penolakan */}
                      <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-3 flex-wrap">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setRejectDialogState({
                              open: true,
                              poId: po.id,
                              poNumber: po.nomorPO,
                              reason: "",
                            })
                          }
                          disabled={isPending}
                          className="h-8 text-xs font-bold text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Tolak & Kembalikan ke QC
                        </Button>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setApprovingPO(po)}
                            disabled={isPending}
                            className="h-8 text-xs font-bold px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-2xs cursor-pointer gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Setujui Disposisi QC
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog Konfirmasi Persetujuan Disposisi Engineering */}
      <Dialog
        open={!!approvingPO}
        onOpenChange={(open) => !open && setApprovingPO(null)}
      >
        <DialogContent className="max-w-lg p-5 sm:p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Konfirmasi Disposisi Hasil QC
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              PO: <span className="font-semibold text-foreground">{approvingPO?.nomorPO}</span>
              {approvingPO?.qcReportNumber && (
                <span className="ml-2 font-mono">({approvingPO.qcReportNumber})</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {approvingPO && (() => {
            const dispState = getPODispositionState(approvingPO);
            const failedItems = (approvingPO.items || []).filter(
              (i: any) => (Number(i.qtyFailed) || 0) > 0
            );

            return (
              <div className="space-y-3 py-2 text-xs">
                <div className="p-3 bg-muted/40 border border-border/60 rounded-xl space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Supplier:</span>
                    <span className="font-semibold text-foreground">
                      {approvingPO.kepada || approvingPO.supplier?.name || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Proyek:</span>
                    <span className="font-semibold text-foreground">
                      {approvingPO.projek || "Gudang"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Jumlah Barang Reject:</span>
                    <span className="font-bold text-rose-600">
                      {failedItems.length} Item
                    </span>
                  </div>
                </div>

                {/* Ringkasan Item Disposisi */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  <span className="font-semibold text-foreground text-[11px] block">
                    Rincian Disposisi Barang Reject:
                  </span>
                  {failedItems.map((fItem: any) => {
                    const d = dispState.dispositions[fItem.id]?.disposition || "USE_AS_IS";
                    const n = dispState.dispositions[fItem.id]?.notes;

                    return (
                      <div
                        key={fItem.id}
                        className="p-2.5 bg-background border border-border/70 rounded-lg space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-foreground truncate">
                            {fItem.namaBarang}
                          </span>
                          {d === "USE_AS_IS" ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400 shrink-0"
                            >
                              Gunakan (Use As-Is)
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-400 shrink-0"
                            >
                              Retur ke Vendor
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                          <span>Reject: <strong className="text-rose-600">{fItem.qtyFailed} {fItem.satuan}</strong></span>
                          {n && <span className="italic truncate max-w-[200px]">"{n}"</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {dispState.notes && (
                  <div className="p-2.5 bg-muted/20 border border-border/60 rounded-lg">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Catatan Engineering:
                    </span>
                    <p className="text-xs text-foreground mt-0.5">{dispState.notes}</p>
                  </div>
                )}

                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Pastikan seluruh disposisi teknis telah sesuai sebelum disetujui. Tindakan ini akan menyelesaikan alur inspeksi QC.
                  </span>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setApprovingPO(null)}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => approvingPO && handleApprovePO(approvingPO)}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Ya, Setujui Disposisi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Penolakan Engineering */}
      <Dialog
        open={rejectDialogState.open}
        onOpenChange={(open) =>
          !open &&
          setRejectDialogState((prev) => ({ ...prev, open: false }))
        }
      >
        <DialogContent className="max-w-md p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-600" />
              Kembalikan Hasil QC ke Inspector
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              PO: <span className="font-semibold text-foreground">{rejectDialogState.poNumber}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label className="text-xs font-semibold">
              Alasan Pengembalian / Revisi:
            </Label>
            <Textarea
              rows={3}
              placeholder="Jelaskan alasan teknis pengembalian (misal: perlu uji lab ulang untuk ketebalan)..."
              value={rejectDialogState.reason}
              onChange={(e) =>
                setRejectDialogState((prev) => ({
                  ...prev,
                  reason: e.target.value,
                }))
              }
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setRejectDialogState((prev) => ({ ...prev, open: false }))
              }
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isPending || !rejectDialogState.reason.trim()}
              onClick={handleConfirmReject}
              className="text-xs font-bold"
            >
              {isPending && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              Kembalikan ke QC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Laporan PDF QC Dialog */}
      {previewPO && (
        <QCReceiptReportPreviewDialog
          open={!!previewPO}
          onOpenChange={(open) => !open && setPreviewPO(null)}
          purchaseOrder={previewPO}
        />
      )}
    </div>
  );
}
