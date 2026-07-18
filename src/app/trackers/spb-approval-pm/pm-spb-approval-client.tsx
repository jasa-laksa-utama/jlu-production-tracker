"use client";

import { useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Check,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  User,
  Calendar,
  Briefcase,
  Loader2,
  AlertCircle,
  Eye,
  Printer,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { approveSpbByPm, rejectSpb } from "@/app/actions/spb";
import { approveBoQByPm, rejectBoQ } from "@/app/actions/boq-approval";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/utils";
import dynamic from "next/dynamic";
import { SPBPDFDocument } from "@/components/trackers/spb-pdf-document";
import { BoQPDFDocument } from "@/components/trackers/boq-pdf-document";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] w-full flex flex-col items-center justify-center text-muted-foreground gap-3 bg-zinc-900 border border-zinc-800 rounded-lg animate-pulse">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-semibold text-zinc-400">Memuat PDF Viewer...</span>
      </div>
    ),
  },
);

interface PmSpbApprovalClientProps {
  initialSpbs: any[];
  initialBoqs: any[];
}

export function PmSpbApprovalClient({
  initialSpbs,
  initialBoqs,
}: PmSpbApprovalClientProps) {
  const [spbs, setSpbs] = useState<any[]>(initialSpbs);
  const [boqs, setBoqs] = useState<any[]>(initialBoqs);
  const [activeTab, setActiveTab] = useState("spb");
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(
    null,
  );
  const [expandedBoqProjectId, setExpandedBoqProjectId] = useState<string | null>(
    null,
  );

  // Search & Pagination states
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detail Dialog state
  const [selectedSpb, setSelectedSpb] = useState<any | null>(null);
  const [previewSpb, setPreviewSpb] = useState<any | null>(null);
  const [selectedBoq, setSelectedBoq] = useState<any | null>(null);
  const [previewBoq, setPreviewBoq] = useState<any | null>(null);

  // Approval Dialog states
  const [approvingSpbId, setApprovingSpbId] = useState<string | null>(null);
  const [approvingBoqId, setApprovingBoqId] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // Rejection Dialog states
  const [rejectingSpbId, setRejectingSpbId] = useState<string | null>(null);
  const [rejectingBoqId, setRejectingBoqId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  const handleApproveSubmit = async () => {
    if (!approvingSpbId) return;

    setIsApproving(true);
    const toastId = toast.loading("Memproses persetujuan SPB...");
    try {
      const res = await approveSpbByPm(approvingSpbId);
      if (res.success) {
        setSpbs((prev) => prev.filter((item) => item.id !== approvingSpbId));
        toast.success("SPB berhasil disetujui!", { id: toastId });
        setApprovingSpbId(null);
        setSelectedSpb(null); // close detail dialog
      } else {
        toast.error(res.error || "Gagal menyetujui SPB.", { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan sistem saat menyetujui SPB.", {
        id: toastId,
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) {
      toast.error("Alasan penolakan harus diisi!");
      return;
    }
    if (!rejectingSpbId) return;

    setIsRejecting(true);
    const toastId = toast.loading("Memproses penolakan SPB...");
    try {
      const res = await rejectSpb(rejectingSpbId, rejectReason);
      if (res.success) {
        setSpbs((prev) => prev.filter((item) => item.id !== rejectingSpbId));
        toast.success("SPB berhasil ditolak.", { id: toastId });
        setRejectingSpbId(null);
        setRejectReason("");
        setSelectedSpb(null); // close detail dialog
      } else {
        toast.error(res.error || "Gagal menolak SPB.", { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan sistem saat menolak SPB.", {
        id: toastId,
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const handleApproveBoqSubmit = async () => {
    if (!approvingBoqId) return;
    setIsApproving(true);
    const toastId = toast.loading("Memproses persetujuan BoQ...");
    try {
      const res = await approveBoQByPm(approvingBoqId);
      if (res.success) {
        setBoqs((prev) => prev.filter((item) => item.id !== approvingBoqId));
        toast.success("BoQ berhasil disetujui!", { id: toastId });
        setApprovingBoqId(null);
        setSelectedBoq(null);
      } else {
        toast.error(res.error || "Gagal menyetujui BoQ.", { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan sistem saat menyetujui BoQ.", { id: toastId });
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectBoqSubmit = async () => {
    if (!rejectingBoqId) return;
    if (!rejectReason.trim()) {
      toast.error("Alasan penolakan harus diisi!");
      return;
    }
    setIsRejecting(true);
    const toastId = toast.loading("Memproses penolakan BoQ...");
    try {
      const res = await rejectBoQ(rejectingBoqId, rejectReason);
      if (res.success) {
        setBoqs((prev) => prev.filter((item) => item.id !== rejectingBoqId));
        toast.success("BoQ berhasil ditolak.", { id: toastId });
        setRejectingBoqId(null);
        setRejectReason("");
        setSelectedBoq(null);
      } else {
        toast.error(res.error || "Gagal menolak BoQ.", { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan sistem saat menolak BoQ.", { id: toastId });
    } finally {
      setIsRejecting(false);
    }
  };

  // Group SPBs by Project
  const projectsMap: { [key: string]: { project: any; spbs: any[] } } = {};

  // Filter SPBs first
  const filteredSpbs = spbs.filter((spb) => {
    const q = searchQuery.toLowerCase();
    return (
      spb.spbNumber.toLowerCase().includes(q) ||
      (spb.project?.projectName || "").toLowerCase().includes(q) ||
      (spb.project?.projectNumber || "").toLowerCase().includes(q) ||
      (spb.project?.customer?.name || "").toLowerCase().includes(q) ||
      spb.items.some((it: any) => it.name.toLowerCase().includes(q))
    );
  });

  filteredSpbs.forEach((spb) => {
    const projId = spb.projectId || "unassigned";
    if (!projectsMap[projId]) {
      projectsMap[projId] = {
        project: spb.project || {
          projectName: "Tanpa Proyek",
          projectNumber: "-",
        },
        spbs: [],
      };
    }
    projectsMap[projId].spbs.push(spb);
  });

  const projectGroups = Object.values(projectsMap);
  const totalItems = projectGroups.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedProjectGroups = projectGroups.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  // Group BoQs by Project
  const boqProjectsMap: { [key: string]: { project: any; boqs: any[] } } = {};

  // Filter BoQs
  const filteredBoqs = boqs.filter((boq) => {
    const q = searchQuery.toLowerCase();
    return (
      (boq.boqNumber || "").toLowerCase().includes(q) ||
      (boq.project?.projectName || "").toLowerCase().includes(q) ||
      (boq.project?.projectNumber || "").toLowerCase().includes(q) ||
      (boq.project?.customer?.name || "").toLowerCase().includes(q) ||
      (boq.project?.customer?.company || "").toLowerCase().includes(q) ||
      (boq.boqMakerName || "").toLowerCase().includes(q)
    );
  });

  filteredBoqs.forEach((boq) => {
    const projId = boq.projectId || "unassigned";
    if (!boqProjectsMap[projId]) {
      boqProjectsMap[projId] = {
        project: boq.project || {
          projectName: "Tanpa Proyek",
          projectNumber: "-",
        },
        boqs: [],
      };
    }
    boqProjectsMap[projId].boqs.push(boq);
  });

  const boqProjectGroups = Object.values(boqProjectsMap);
  const totalBoqItems = boqProjectGroups.length;
  const totalBoqPages = Math.ceil(totalBoqItems / pageSize) || 1;
  const paginatedBoqProjectGroups = boqProjectGroups.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <div className="space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val);
          setCurrentPage(1);
          setSearchQuery("");
          setExpandedProjectId(null);
          setExpandedBoqProjectId(null);
        }}
        className="w-full"
      >
        <TabsList className="grid w-[400px] grid-cols-2 bg-muted/65 p-1 rounded-2xl mb-6">
          <TabsTrigger
            value="spb"
            className="text-xs font-bold py-2 px-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Persetujuan SPB</span>
            {spbs.length > 0 && (
              <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-black text-white shadow-xs">
                {spbs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="boq"
            className="text-xs font-bold py-2 px-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Persetujuan BoQ</span>
            {boqs.length > 0 && (
              <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-purple-600 px-1 text-[9px] font-black text-white shadow-xs">
                {boqs.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="spb" className="space-y-4 m-0 border-0 p-0 outline-hidden">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card border border-border/60 p-4 rounded-2xl shadow-xs">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari SPB, proyek, customer..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 h-10 rounded-xl bg-muted/20 border-2 border-border/60 text-xs font-semibold focus-visible:ring-primary/20"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg cursor-pointer"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>
                Halaman {currentPage} dari {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg cursor-pointer"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {paginatedProjectGroups.length === 0 ? (
            <Card className="border border-dashed border-border/80 rounded-2xl p-12 text-center bg-card shadow-xs">
              <CardContent className="flex flex-col items-center justify-center gap-3">
                <FileText className="w-12 h-12 text-muted-foreground opacity-30" />
                <h3 className="font-bold text-base text-foreground">
                  Tidak Ada Antrean Persetujuan SPB
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Semua dokumen Surat Permintaan Barang (SPB) telah diproses atau
                  tidak ada pengajuan baru dari divisi Engineering.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {paginatedProjectGroups.map(({ project, spbs }, idx) => {
                const isExpanded = expandedProjectId === project.id;
                const globalIndex = idx + 1 + (currentPage - 1) * pageSize;
                return (
                  <Card
                    key={project.id || "unassigned"}
                    className="border border-border/60 rounded-2xl overflow-hidden hover:shadow-md transition-all duration-200"
                  >
                    <CardHeader
                      className="p-6 pb-4 bg-muted/15 cursor-pointer flex flex-row items-center justify-between gap-4"
                      onClick={() =>
                        setExpandedProjectId(isExpanded ? null : project.id)
                      }
                    >
                      <div className="space-y-1">
                        <CardTitle className="text-base font-bold text-foreground">
                          {globalIndex}. {project.projectName || "Tanpa Proyek"}
                        </CardTitle>
                        <CardDescription className="text-xs font-semibold text-muted-foreground">
                          No. Proyek: {project.projectNumber || "-"} | Customer:{" "}
                          {project.customer?.company || project.customer?.name || "-"}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 font-bold px-3 py-1 text-xs rounded-full">
                          {spbs.length} SPB Menunggu
                        </Badge>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="p-6 pt-4 divide-y divide-border/40">
                        {spbs.map((spb, spbIdx) => (
                          <div
                            key={spb.id}
                            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 first:pt-2 last:pb-2"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-foreground text-xs">
                                  {spbIdx + 1}. {spb.spbNumber}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  •
                                </span>
                                <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />{" "}
                                  {format(new Date(spb.createdAt), "dd MMM yyyy HH:mm", {
                                    locale: id,
                                  })}
                                </span>
                              </div>
                              <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-4">
                                <span>
                                  Maker: <strong>{spb.makerName || "Engineering"}</strong>
                                </span>
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                                <span>
                                  Total Barang: <strong>{spb.items.length} Item</strong>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPreviewSpb(spb)}
                                className="h-7 text-xs font-semibold px-2.5 gap-1 cursor-pointer border-border/80 hover:bg-primary/5 hover:text-primary hover:border-primary/20 rounded-lg shadow-none"
                              >
                                <Printer className="w-3 h-3" /> Cetak
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedSpb(spb)}
                                className="h-7 text-xs font-semibold px-2.5 gap-1 cursor-pointer border-border/80 hover:bg-orange-500/5 hover:text-orange-600 hover:border-orange-500/20 rounded-lg shadow-none"
                              >
                                <Eye className="w-3 h-3" /> Detail & Proses
                              </Button>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="boq" className="space-y-4 m-0 border-0 p-0 outline-hidden">
          {/* Search & Pagination controls */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card border border-border/60 p-4 rounded-2xl shadow-xs">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari BoQ, proyek, customer..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 h-10 rounded-xl bg-muted/20 border-2 border-border/60 text-xs font-semibold focus-visible:ring-primary/20"
              />
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg cursor-pointer"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>
                Halaman {currentPage} dari {totalBoqPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg cursor-pointer"
                onClick={() => setCurrentPage((p) => Math.min(totalBoqPages, p + 1))}
                disabled={currentPage === totalBoqPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {paginatedBoqProjectGroups.length === 0 ? (
            <Card className="border border-dashed border-border/80 rounded-2xl p-12 text-center bg-card shadow-xs">
              <CardContent className="flex flex-col items-center justify-center gap-3">
                <FileText className="w-12 h-12 text-muted-foreground opacity-30" />
                <h3 className="font-bold text-base text-foreground">
                  Tidak Ada Antrean Persetujuan BoQ
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Semua dokumen Bill of Quantities (BoQ) telah diproses atau belum diajukan oleh Engineering.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {paginatedBoqProjectGroups.map(({ project, boqs: projectBoqs }, idx) => {
                const isExpanded = expandedBoqProjectId === project.id;
                const globalIndex = idx + 1 + (currentPage - 1) * pageSize;
                return (
                  <Card
                    key={project.id || "unassigned"}
                    className="border border-border/60 rounded-2xl overflow-hidden hover:shadow-md transition-all duration-200"
                  >
                    <CardHeader
                      className="p-6 pb-4 bg-muted/15 cursor-pointer flex flex-row items-center justify-between gap-4"
                      onClick={() =>
                        setExpandedBoqProjectId(isExpanded ? null : project.id)
                      }
                    >
                      <div className="space-y-1">
                        <CardTitle className="text-base font-bold text-foreground">
                          {globalIndex}. {project.projectName || "Tanpa Proyek"}
                        </CardTitle>
                        <CardDescription className="text-xs font-semibold text-muted-foreground">
                          No. Proyek: {project.projectNumber || "-"} | Customer:{" "}
                          {project.customer?.company || project.customer?.name || "-"}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 font-bold px-3 py-1 text-xs rounded-full">
                          {projectBoqs.length} BoQ Menunggu
                        </Badge>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="p-6 pt-4 divide-y divide-border/40">
                        {projectBoqs.map((boq, boqIdx) => {
                          const totalVal = boq.boqItems.reduce(
                            (acc: number, it: any) => acc + it.qty * Number(it.price || 0),
                            0
                          );
                          return (
                            <div
                              key={boq.id}
                              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 first:pt-2 last:pb-2"
                            >
                              <div className="space-y-1.5 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-foreground text-xs">
                                    {boqIdx + 1}. {boq.boqNumber}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    •
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />{" "}
                                    {format(new Date(boq.createdAt), "dd MMM yyyy HH:mm", {
                                      locale: id,
                                    })}
                                  </span>
                                </div>
                                <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-4">
                                  <span>
                                    Maker: <strong>{boq.boqMakerName || "Engineering"}</strong>
                                  </span>
                                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                                  <span>
                                    Total Nilai BoQ: <strong className="text-primary">{formatRupiah(totalVal)}</strong>
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedBoq(boq)}
                                  className="h-7 text-xs font-semibold px-2.5 gap-1 cursor-pointer border-border/80 hover:bg-orange-500/5 hover:text-orange-600 hover:border-orange-500/20 rounded-lg shadow-none"
                                >
                                  <Eye className="w-3 h-3" /> Detail & Proses
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!selectedSpb}
        onOpenChange={(open) => !open && setSelectedSpb(null)}
      >
        <DialogContent className="sm:max-w-[750px] max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-background">
          <DialogHeader className="p-6 pb-4 shrink-0 border-b border-border/50">
            <div className="flex items-center justify-between w-full pr-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600 border border-orange-500/20 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Detail SPB: {selectedSpb?.spbNumber}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground font-medium mt-0.5">
                    Proyek: {selectedSpb?.project?.projectName} (
                    {selectedSpb?.project?.projectNumber})
                  </DialogDescription>
                </div>
              </div>
              <Badge className="bg-amber-500/10 text-amber-700 border-none shadow-none text-[10px] font-bold rounded-lg px-2.5 py-1">
                Menunggu PM
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 bg-muted/5">
            <div className="border border-border/40 rounded-xl overflow-x-auto shadow-xs bg-card">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/30 text-xs font-semibold text-muted-foreground border-b border-border/30">
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Nama Material</th>
                    <th className="p-3 w-40">Tipe / Merk</th>
                    <th className="p-3 text-center w-28">Kuantitas</th>
                    <th className="p-3 text-center w-36">Sumber Barang</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSpb?.items.map((item: any, idx: number) => (
                    <tr
                      key={item.id}
                      className="border-b border-border/10 last:border-0 hover:bg-muted/5 transition-colors"
                    >
                      <td className="p-3 text-center text-foreground font-bold">
                        {idx + 1}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-foreground">
                          {item.name}
                        </div>
                        {item.note && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Note: {item.note}
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-medium text-foreground/80">
                        {item.typeMerk || "-"}
                      </td>
                      <td className="p-3 text-center font-bold text-foreground">
                        {item.qty} {item.unit}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          className={
                            item.source === "WAREHOUSE"
                              ? "bg-blue-500/10 text-blue-600 border-none shadow-none text-[9px] font-black rounded"
                              : "bg-orange-500/10 text-orange-600 border-none shadow-none text-[9px] font-black rounded"
                          }
                        >
                          {item.source === "WAREHOUSE"
                            ? "GUDANG"
                            : "TRADING / BELI"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-4 bg-muted/10 border-t border-border/30 flex justify-end gap-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectingSpbId(selectedSpb?.id)}
              className="cursor-pointer font-bold border-red-200 hover:bg-red-50 hover:text-red-700 text-red-600 rounded-lg flex items-center gap-1.5 h-9"
            >
              <X className="w-4 h-4" />
              Tolak SPB
            </Button>
            <Button
              size="sm"
              onClick={() => setApprovingSpbId(selectedSpb?.id)}
              className="cursor-pointer font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 h-9"
            >
              <Check className="w-4 h-4" />
              Setujui SPB
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedBoq}
        onOpenChange={(open) => !open && setSelectedBoq(null)}
      >
        <DialogContent className="sm:max-w-[750px] max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-background">
          <DialogHeader className="p-6 pb-4 shrink-0 border-b border-border/50">
            <div className="flex items-center justify-between w-full pr-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Detail BoQ: {selectedBoq?.boqNumber}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground font-medium mt-0.5">
                    Proyek: {selectedBoq?.project?.projectName} ({selectedBoq?.project?.projectNumber})
                  </DialogDescription>
                </div>
              </div>
              <Badge className="bg-amber-500/10 text-amber-700 border-none shadow-none text-[10px] font-bold rounded-lg px-2.5 py-1">
                Menunggu PM
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 bg-muted/5">
            <div className="border border-border/40 rounded-xl overflow-x-auto shadow-xs bg-card">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/30 text-xs font-semibold text-muted-foreground border-b border-border/30">
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Kode Barang</th>
                    <th className="p-3">Nama Material</th>
                    <th className="p-3 text-center w-28">Kuantitas</th>
                    <th className="p-3 text-right w-36">Harga Satuan</th>
                    <th className="p-3 text-right w-36">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBoq?.boqItems.map((item: any, idx: number) => {
                    const priceVal = Number(item.price || 0);
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-border/10 last:border-0 hover:bg-muted/5 transition-colors"
                      >
                        <td className="p-3 text-center text-foreground font-bold">
                          {idx + 1}
                        </td>
                        <td className="p-3 font-semibold text-primary">
                          {item.item?.code || "-"}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-foreground">
                            {item.item?.name || "-"}
                          </div>
                          {item.note && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Note: {item.note}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center font-bold text-foreground">
                          {item.qty} {item.unit}
                        </td>
                        <td className="p-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                          {formatRupiah(priceVal)}
                        </td>
                        <td className="p-3 text-right font-bold text-foreground">
                          {formatRupiah(item.qty * priceVal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-4 bg-muted/10 border-t border-border/30 flex justify-between items-center shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewBoq(selectedBoq)}
              className="cursor-pointer font-bold border-orange-200 hover:bg-orange-50 hover:text-orange-700 text-orange-600 rounded-lg flex items-center gap-1.5 h-9"
            >
              <Printer className="w-4 h-4" />
              Preview PDF
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectingBoqId(selectedBoq?.id)}
                className="cursor-pointer font-bold border-red-200 hover:bg-red-50 hover:text-red-700 text-red-600 rounded-lg flex items-center gap-1.5 h-9"
              >
                <X className="w-4 h-4" />
                Tolak BoQ
              </Button>
              <Button
                size="sm"
                onClick={() => setApprovingBoqId(selectedBoq?.id)}
                className="cursor-pointer font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 h-9"
              >
                <Check className="w-4 h-4" />
                Setujui BoQ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!approvingSpbId}
        onOpenChange={(open) => !open && setApprovingSpbId(null)}
      >
        <DialogContent className="sm:max-w-[420px] rounded-2xl border border-border shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <Check className="w-5 h-5 text-emerald-600" />
              Setujui Dokumen SPB
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Apakah Anda yakin ingin menyetujui pengajuan dokumen SPB ini?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" disabled={isApproving} onClick={() => setApprovingSpbId(null)} className="cursor-pointer font-semibold rounded-lg">Batal</Button>
            <Button disabled={isApproving} onClick={handleApproveSubmit} className="cursor-pointer font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5">
              {isApproving && <Loader2 className="w-4 h-4 animate-spin" />} Ya, Setujui
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!approvingBoqId}
        onOpenChange={(open) => !open && setApprovingBoqId(null)}
      >
        <DialogContent className="sm:max-w-[420px] rounded-2xl border border-border shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <Check className="w-5 h-5 text-emerald-600" />
              Setujui Dokumen BoQ
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Apakah Anda yakin ingin menyetujui pengajuan dokumen BoQ ini?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" disabled={isApproving} onClick={() => setApprovingBoqId(null)} className="cursor-pointer font-semibold rounded-lg">Batal</Button>
            <Button disabled={isApproving} onClick={handleApproveBoqSubmit} className="cursor-pointer font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5">
              {isApproving && <Loader2 className="w-4 h-4 animate-spin" />} Ya, Setujui
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!rejectingSpbId}
        onOpenChange={(open) => !open && setRejectingSpbId(null)}
      >
        <DialogContent className="sm:max-w-[420px] rounded-2xl border border-border shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Tolak Pengajuan SPB
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Masukkan alasan penolakan dokumen SPB ini.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">Alasan Penolakan</label>
            <Input placeholder="Contoh: Stok tidak memadai..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="rounded-xl border-border bg-background shadow-xs text-sm" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={isRejecting} onClick={() => setRejectingSpbId(null)} className="cursor-pointer font-semibold rounded-lg">Batal</Button>
            <Button variant="destructive" disabled={isRejecting} onClick={handleRejectSubmit} className="cursor-pointer font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-1.5">
              {isRejecting && <Loader2 className="w-4 h-4 animate-spin" />} Tolak SPB
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!rejectingBoqId}
        onOpenChange={(open) => !open && setRejectingBoqId(null)}
      >
        <DialogContent className="sm:max-w-[420px] rounded-2xl border border-border shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Tolak Pengajuan BoQ
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Masukkan alasan penolakan dokumen BoQ ini.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">Alasan Penolakan</label>
            <Input placeholder="Contoh: Kode salah..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="rounded-xl border-border bg-background shadow-xs text-sm" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={isRejecting} onClick={() => setRejectingBoqId(null)} className="cursor-pointer font-semibold rounded-lg">Batal</Button>
            <Button variant="destructive" disabled={isRejecting} onClick={handleRejectBoqSubmit} className="cursor-pointer font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-1.5">
              {isRejecting && <Loader2 className="w-4 h-4 animate-spin" />} Tolak BoQ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Preview SPB PDF */}
      <Dialog
        open={!!previewSpb}
        onOpenChange={(open) => !open && setPreviewSpb(null)}
      >
        <DialogContent className="max-w-4xl! h-[90vh] flex flex-col p-6 rounded-2xl bg-zinc-950 border border-zinc-800 text-white">
          <DialogHeader className="flex-none">
            <DialogTitle className="text-base font-bold text-white">
              Pratinjau Cetak SPB
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Pratinjau dokumen PDF Surat Permintaan Barang ({previewSpb?.spbNumber || "-"}).
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 w-full overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 mt-4 relative">
            {previewSpb && (
              <PDFViewer width="100%" height="100%" showToolbar={true} className="border-0">
                <SPBPDFDocument spb={previewSpb} project={previewSpb?.project} />
              </PDFViewer>
            )}
          </div>
          <DialogFooter className="mt-4 flex-none">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewSpb(null)}
              className="cursor-pointer font-semibold rounded-lg bg-transparent text-white border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Preview BoQ PDF */}
      <Dialog
        open={!!previewBoq}
        onOpenChange={(open) => !open && setPreviewBoq(null)}
      >
        <DialogContent className="max-w-4xl! h-[90vh] flex flex-col p-6 rounded-2xl bg-zinc-950 border border-zinc-800 text-white">
          <DialogHeader className="flex-none">
            <DialogTitle className="text-base font-bold text-white">
              Pratinjau Cetak BoQ
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Pratinjau dokumen PDF Bill of Quantities ({previewBoq?.boqNumber || "-"}).
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 w-full overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 mt-4 relative">
            {previewBoq && (
              <PDFViewer width="100%" height="100%" showToolbar={true} className="border-0">
                <BoQPDFDocument
                  project={{
                    ...previewBoq,
                    projectName: previewBoq.project?.projectName,
                    projectNumber: previewBoq.project?.projectNumber,
                    customer: previewBoq.project?.customer,
                  }}
                  items={previewBoq.boqItems.map((it: any) => ({
                    itemId: it.itemId,
                    itemCode: it.item?.code || "",
                    itemName: it.item?.name || "",
                    itemTypeMerk: it.item?.typeMerk || "",
                    qty: it.qty,
                    unit: it.unit,
                    price: Number(it.price || 0),
                    note: it.note || "",
                  }))}
                />
              </PDFViewer>
            )}
          </div>
          <DialogFooter className="mt-4 flex-none">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewBoq(null)}
              className="cursor-pointer font-semibold rounded-lg bg-transparent text-white border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
