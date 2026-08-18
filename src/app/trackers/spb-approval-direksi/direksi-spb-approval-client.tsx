"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Loader2,
  Check,
  X,
  Building2,
  FileText,
  AlertCircle,
  Eye,
  Printer,
  FileImage,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  approveSpbByDireksi,
  rejectSpb,
  approveSPBGudangByDireksi,
  rejectSPBGudang,
  approveVendorSelectionByDireksi,
  rejectVendorSelectionByDireksi,
} from "@/app/actions/spb";
import { getSPBImageUrls } from "@/app/actions/documents";
import { formatJakartaDate } from "@/lib/date-utils";
import { cn, formatRupiah, parseSPBImageUrls } from "@/lib/utils";
import dynamic from "next/dynamic";
import { SPBPDFDocument } from "@/components/trackers/spb-pdf-document";
import { format } from "date-fns";
import { id } from "date-fns/locale";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="h-125 w-full flex flex-col items-center justify-center text-muted-foreground gap-3 bg-zinc-900 border border-zinc-800 rounded-lg animate-pulse">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-semibold text-zinc-400">
          Memuat PDF Viewer...
        </span>
      </div>
    ),
  },
);

interface DireksiSpbApprovalClientProps {
  initialSpbs?: any[];
  initialSpbGudang?: any[];
  initialVendorItems: any[];
}

export function DireksiSpbApprovalClient({
  initialSpbs = [],
  initialSpbGudang = [],
  initialVendorItems = [],
}: DireksiSpbApprovalClientProps) {
  const [activeTab, setActiveTab] = useState("spb");
  const [spbs, setSpbs] = useState<any[]>(initialSpbs);
  const [spbGudangList, setSpbGudangList] = useState<any[]>(initialSpbGudang);
  const [vendorItems, setVendorItems] = useState<any[]>(initialVendorItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog States for SPB Project Approval & Rejection (Direksi)
  const [approvingSpb, setApprovingSpb] = useState<{
    id: string;
    spbNumber: string;
  } | null>(null);
  const [rejectingSpb, setRejectingSpb] = useState<{
    id: string;
    spbNumber: string;
  } | null>(null);
  const [spbRejectReason, setSpbRejectReason] = useState("");
  const [selectedSpb, setSelectedSpb] = useState<any | null>(null);
  const [previewSpb, setPreviewSpb] = useState<any | null>(null);
  const [previewModalImages, setPreviewModalImages] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  // Dialog States for SPB Gudang (Direksi)
  const [approvingSpbGudangItem, setApprovingSpbGudangItem] = useState<{
    id: string;
    spbNumber: string;
  } | null>(null);
  const [rejectingSpbGudangItem, setRejectingSpbGudangItem] = useState<{
    id: string;
    spbNumber: string;
  } | null>(null);
  const [spbGudangRejectReason, setSpbGudangRejectReason] = useState("");

  // Dialog States for Vendor Selection Approval & Rejection (Direksi)
  const [approvingVendorItem, setApprovingVendorItem] = useState<{
    id: string;
    name: string;
    itemType: "PROJECT" | "GUDANG";
    supplierName: string;
    catalogPrice?: number;
    spbNumber: string;
  } | null>(null);
  const [rejectingVendorItem, setRejectingVendorItem] = useState<{
    id: string;
    name: string;
    itemType: "PROJECT" | "GUDANG";
    supplierName: string;
    spbNumber: string;
  } | null>(null);
  const [vendorRejectReason, setVendorRejectReason] = useState("");

  const pageSize = 10;

  const getItemCode = (it: any) => {
    return it.material?.code || it.materialCode || it.itemCode || "-";
  };

  // --- TAB 1: GROUPING SPB PROJECT & SPB GUDANG ---
  const projectsMap: {
    [key: string]: {
      id: string;
      project: any;
      spbs: any[];
      spbGudangs: any[];
    };
  } = {};

  const filteredSpbs = useMemo(() => {
    return spbs.filter((spb) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        (spb.spbNumber || "").toLowerCase().includes(q) ||
        (spb.project?.projectName || "").toLowerCase().includes(q) ||
        (spb.project?.projectNumber || "").toLowerCase().includes(q) ||
        (spb.project?.customer?.name || "").toLowerCase().includes(q) ||
        (spb.project?.customer?.company || "").toLowerCase().includes(q) ||
        (spb.makerName || "").toLowerCase().includes(q) ||
        (spb.items || []).some((it: any) =>
          (it.name || "").toLowerCase().includes(q),
        )
      );
    });
  }, [spbs, searchQuery]);

  const filteredSpbGudang = useMemo(() => {
    return spbGudangList.filter((gudang) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        (gudang.spbNumber || "").toLowerCase().includes(q) ||
        (gudang.makerName || "").toLowerCase().includes(q) ||
        (gudang.project?.projectName || "").toLowerCase().includes(q) ||
        (gudang.project?.projectNumber || "").toLowerCase().includes(q) ||
        (gudang.project?.customer?.name || "").toLowerCase().includes(q) ||
        (gudang.items || []).some((it: any) =>
          (it.name || "").toLowerCase().includes(q),
        )
      );
    });
  }, [spbGudangList, searchQuery]);

  filteredSpbs.forEach((spb) => {
    const projId = spb.projectId || "unassigned";
    if (!projectsMap[projId]) {
      projectsMap[projId] = {
        id: projId,
        project: spb.project || {
          projectName: "Tanpa Proyek",
          projectNumber: "-",
          customer: null,
        },
        spbs: [],
        spbGudangs: [],
      };
    }
    projectsMap[projId].spbs.push(spb);
  });

  filteredSpbGudang.forEach((gudang) => {
    const projId = gudang.projectId || "gudang-utama";
    if (!projectsMap[projId]) {
      projectsMap[projId] = {
        id: projId,
        project: gudang.project || {
          projectName: "Gudang Utama (Stok & Trading)",
          projectNumber: "SPB Gudang",
          customer: null,
        },
        spbs: [],
        spbGudangs: [],
      };
    }
    projectsMap[projId].spbGudangs.push(gudang);
  });

  const projectGroups = Object.values(projectsMap);
  const totalSpbItems = projectGroups.length;
  const totalSpbPages = Math.ceil(totalSpbItems / pageSize) || 1;
  const paginatedProjectGroups = projectGroups.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  // --- TAB 2: FILTERED VENDOR ITEMS ---
  const filteredVendorItems = useMemo(() => {
    return vendorItems.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      const spbNo = (item.spb?.spbNumber || "").toLowerCase();
      const projName = (item.spb?.project?.projectName || "").toLowerCase();
      const custName = (item.spb?.project?.customer?.name || "").toLowerCase();
      const compName = (
        item.spb?.project?.customer?.company || ""
      ).toLowerCase();
      const itemName = (item.name || "").toLowerCase();
      const vendorName = (item.selectedSupplierName || "").toLowerCase();

      return (
        spbNo.includes(q) ||
        projName.includes(q) ||
        custName.includes(q) ||
        compName.includes(q) ||
        itemName.includes(q) ||
        vendorName.includes(q)
      );
    });
  }, [vendorItems, searchQuery]);

  const vendorSpbGroups = useMemo(() => {
    const map: {
      [key: string]: {
        spb: any;
        project: any;
        items: any[];
        itemType: "PROJECT" | "GUDANG";
      };
    } = {};

    filteredVendorItems.forEach((item) => {
      const spbKey =
        item.spb?.id || item.spbId || item.spbGudangId || "unassigned";
      if (!map[spbKey]) {
        map[spbKey] = {
          spb: item.spb || { spbNumber: "SPB" },
          project: item.spb?.project || {
            projectName: "Tanpa Proyek",
            projectNumber: "-",
            customer: null,
          },
          items: [],
          itemType:
            item.itemType ||
            (item.spb?.spbType === "GUDANG" ? "GUDANG" : "PROJECT"),
        };
      }
      map[spbKey].items.push(item);
    });

    return Object.values(map);
  }, [filteredVendorItems]);

  const totalVendorPages = Math.ceil(vendorSpbGroups.length / pageSize) || 1;
  const paginatedVendorSpbGroups = vendorSpbGroups.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  // --- SUBMIT HANDLERS ---

  // 1. SPB Project Handlers (Direksi)
  const handleApproveSpbSubmit = async () => {
    if (!approvingSpb) return;

    setIsSubmitting(true);
    const toastId = toast.loading(
      `Menyetujui SPB Project ${approvingSpb.spbNumber}...`,
    );

    const res = await approveSpbByDireksi(approvingSpb.id);
    setIsSubmitting(false);

    if (res.success) {
      toast.success("SPB Project berhasil disetujui Direksi!", { id: toastId });
      setSpbs((prev) => prev.filter((item) => item.id !== approvingSpb.id));
      setApprovingSpb(null);
    } else {
      toast.error(res.error || "Gagal menyetujui SPB Project.", {
        id: toastId,
      });
    }
  };

  const handleRejectSpbSubmit = async () => {
    if (!rejectingSpb) return;

    if (!spbRejectReason || !spbRejectReason.trim()) {
      toast.error("Alasan penolakan SPB wajib diisi!");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(
      `Menolak SPB Project ${rejectingSpb.spbNumber}...`,
    );

    const res = await rejectSpb(rejectingSpb.id, spbRejectReason.trim());
    setIsSubmitting(false);

    if (res.success) {
      toast.success("SPB Project telah ditolak.", { id: toastId });
      setSpbs((prev) => prev.filter((item) => item.id !== rejectingSpb.id));
      setRejectingSpb(null);
      setSpbRejectReason("");
    } else {
      toast.error(res.error || "Gagal menolak SPB Project.", { id: toastId });
    }
  };

  // 2. SPB Gudang Handlers (Direksi)
  const handleApproveSpbGudangSubmit = async () => {
    if (!approvingSpbGudangItem) return;

    setIsSubmitting(true);
    const toastId = toast.loading(
      `Menyetujui SPB Gudang ${approvingSpbGudangItem.spbNumber} (Final Direksi)...`,
    );

    const res = await approveSPBGudangByDireksi(approvingSpbGudangItem.id);
    setIsSubmitting(false);

    if (res.success) {
      toast.success(res.message, { id: toastId });
      setSpbGudangList((prev) =>
        prev.filter((item) => item.id !== approvingSpbGudangItem.id),
      );
      setApprovingSpbGudangItem(null);
    } else {
      toast.error(res.error || "Gagal menyetujui SPB Gudang", { id: toastId });
    }
  };

  const handleRejectSpbGudangSubmit = async () => {
    if (!rejectingSpbGudangItem) return;

    if (!spbGudangRejectReason || !spbGudangRejectReason.trim()) {
      toast.error("Alasan penolakan (Reject) wajib diisi!");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(
      `Menolak SPB Gudang ${rejectingSpbGudangItem.spbNumber}...`,
    );

    const res = await rejectSPBGudang(
      rejectingSpbGudangItem.id,
      "DIREKSI",
      spbGudangRejectReason.trim(),
    );
    setIsSubmitting(false);

    if (res.success) {
      toast.success(res.message, { id: toastId });
      setSpbGudangList((prev) =>
        prev.filter((item) => item.id !== rejectingSpbGudangItem.id),
      );
      setRejectingSpbGudangItem(null);
      setSpbGudangRejectReason("");
    } else {
      toast.error(res.error || "Gagal menolak SPB Gudang", { id: toastId });
    }
  };

  // 3. Vendor Selection Handlers (Direksi)
  const handleApproveVendorDireksiSubmit = async () => {
    if (!approvingVendorItem) return;

    setIsSubmitting(true);
    const toastId = toast.loading(
      `Menyetujui vendor untuk "${approvingVendorItem.name}"...`,
    );

    const res = await approveVendorSelectionByDireksi(
      approvingVendorItem.id,
      approvingVendorItem.itemType,
    );
    setIsSubmitting(false);

    if (res.success) {
      toast.success(res.message, { id: toastId });
      setVendorItems((prev) =>
        prev.filter((item) => item.id !== approvingVendorItem.id),
      );
      setApprovingVendorItem(null);
    } else {
      toast.error(res.error || "Gagal menyetujui vendor", { id: toastId });
    }
  };

  const handleRejectVendorDireksiSubmit = async () => {
    if (!rejectingVendorItem) return;

    if (!vendorRejectReason || !vendorRejectReason.trim()) {
      toast.error("Alasan penolakan vendor wajib diisi!");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(
      `Menolak vendor untuk "${rejectingVendorItem.name}"...`,
    );

    const res = await rejectVendorSelectionByDireksi(
      rejectingVendorItem.id,
      vendorRejectReason.trim(),
      rejectingVendorItem.itemType,
    );
    setIsSubmitting(false);

    if (res.success) {
      toast.success(res.message, { id: toastId });
      setVendorItems((prev) =>
        prev.filter((item) => item.id !== rejectingVendorItem.id),
      );
      setRejectingVendorItem(null);
      setVendorRejectReason("");
    } else {
      toast.error(res.error || "Gagal menolak vendor", { id: toastId });
    }
  };

  const totalSpbCount = spbs.length + spbGudangList.length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val);
          setCurrentPage(1);
          setSearchQuery("");
        }}
        className="w-full"
      >
        <div className="w-full overflow-x-auto whitespace-nowrap flex-nowrap pb-1 mb-4 no-scrollbar">
          <TabsList className="inline-flex h-10 sm:h-11 items-center justify-start rounded-2xl bg-muted/60 p-1 text-muted-foreground gap-1 border border-border/40 shrink-0">
            <TabsTrigger
              value="spb"
              className="rounded-xl px-3 sm:px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer flex items-center gap-1.5 sm:gap-2"
            >
              <span>Persetujuan SPB</span>
              {totalSpbCount > 0 && (
                <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  {totalSpbCount}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="vendor"
              className="rounded-xl px-3 sm:px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer flex items-center gap-1.5 sm:gap-2"
            >
              <span>Persetujuan Vendor PO</span>
              {vendorItems.length > 0 && (
                <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  {vendorItems.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: PERSETUJUAN SPB (PROJECT & GUDANG) */}
        <TabsContent
          value="spb"
          className="space-y-4 m-0 border-0 p-0 outline-hidden"
        >
          {/* Control Bar: Search & Pagination */}
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
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 rounded-lg cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>
                Halaman {currentPage} dari {totalSpbPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalSpbPages))
                }
                disabled={currentPage === totalSpbPages}
                className="h-8 w-8 rounded-lg cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {paginatedProjectGroups.length === 0 ? (
            <Card className="border border-dashed border-border/60 bg-muted/10 rounded-2xl p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-base font-bold text-foreground">
                Tidak Ada SPB Menunggu Persetujuan Direksi
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Semua dokumen SPB Project dan SPB Gudang telah disetujui atau
                belum diproses oleh tim PPIC/PM.
              </p>
            </Card>
          ) : (
            <Accordion
              type="multiple"
              defaultValue={paginatedProjectGroups.map(
                (g, idx) => g.id || `group-${idx}`,
              )}
              className="space-y-3"
            >
              {paginatedProjectGroups.map((group, idx) => {
                const groupCount = group.spbs.length + group.spbGudangs.length;
                return (
                  <AccordionItem
                    key={group.id || idx}
                    value={group.id || `group-${idx}`}
                    className="border border-border/60 rounded-2xl bg-card overflow-hidden shadow-xs hover:border-primary/30 transition-all border-b-0"
                  >
                    <AccordionTrigger className="p-3.5 sm:p-5 hover:bg-muted/10 hover:no-underline select-none">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full pr-2 sm:pr-4 text-left gap-2 sm:gap-4">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-muted-foreground shrink-0 min-w-5">
                            {idx + 1}.
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                                {group.project.projectNumber || "-"}
                              </span>
                              {group.spbs.length > 0 && (
                                <Badge
                                  variant="outline"
                                  className="bg-blue-500/10 text-blue-700 border-blue-300 text-[10px] font-bold px-1.5 py-0"
                                >
                                  SPB Project ({group.spbs.length})
                                </Badge>
                              )}
                              {group.spbGudangs.length > 0 && (
                                <Badge
                                  variant="outline"
                                  className="bg-purple-500/10 text-purple-700 border-purple-300 text-[10px] font-bold px-1.5 py-0"
                                >
                                  SPB Gudang ({group.spbGudangs.length})
                                </Badge>
                              )}
                              <h3 className="text-xs sm:text-sm font-bold text-foreground">
                                {group.project.projectName}
                              </h3>
                            </div>
                            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5 sm:mt-1">
                              {group.project.customer ? (
                                <>
                                  Customer:{" "}
                                  <span className="text-foreground font-semibold">
                                    {group.project.customer.company ||
                                      group.project.customer.name ||
                                      "-"}
                                  </span>
                                </>
                              ) : (
                                <>
                                  Kategori:{" "}
                                  <span className="text-foreground font-semibold">
                                    Pengadaan & Stok Gudang
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        <span className="text-xs font-semibold text-muted-foreground self-start sm:self-auto shrink-0 bg-muted/20 px-2 py-0.5 rounded-md border border-border/40">
                          {groupCount} Dokumen Menunggu
                        </span>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="border-t border-border/40 bg-muted/5 p-3 sm:p-5 space-y-4 pb-4">
                      {/* 1. Render SPB Project Documents */}
                      {group.spbs.map((spb) => (
                        <div
                          key={spb.id}
                          className="p-3.5 sm:p-4 rounded-xl border border-border/60 bg-background space-y-3 shadow-2xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className="bg-blue-500/10 text-blue-700 border-blue-300 font-bold text-[10px] px-1.5 py-0"
                                >
                                  SPB Project
                                </Badge>
                                <h4 className="text-xs font-semibold text-foreground">
                                  {spb.spbNumber}
                                </h4>
                                <Badge
                                  variant="outline"
                                  className="bg-amber-500/10 text-amber-700 border-amber-300 font-bold text-[10px] px-1.5 py-0"
                                >
                                  Menunggu ACC Direksi
                                </Badge>
                                {spb.deadlineDate && (
                                  <span className="text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                                    • Tenggat:{" "}
                                    {formatJakartaDate(
                                      spb.deadlineDate,
                                      "date",
                                    )}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Diajukan oleh:{" "}
                                <strong className="font-semibold text-foreground">
                                  {spb.makerName || "User"}
                                </strong>{" "}
                                • Tanggal:{" "}
                                {formatJakartaDate(spb.createdAt, "datetime")}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 sm:pt-0">
                              {spb.imageUrl &&
                                (() => {
                                  const parsedUrls = parseSPBImageUrls(
                                    spb.imageUrl,
                                  );
                                  const count = parsedUrls.length;
                                  return (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={async () => {
                                        const res = await getSPBImageUrls(
                                          spb.imageUrl,
                                        );
                                        if (
                                          res.success &&
                                          res.urls &&
                                          res.urls.length > 0
                                        ) {
                                          setPreviewModalImages(res.urls);
                                          setActiveImageIndex(0);
                                        } else {
                                          toast.error(
                                            res.error ||
                                              "Gagal memuat foto lampiran",
                                          );
                                        }
                                      }}
                                      className="h-8 text-[11px] sm:text-xs font-semibold rounded-lg gap-1 border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer px-2.5 sm:px-3 shadow-none"
                                    >
                                      <FileImage className="w-3.5 h-3.5" />{" "}
                                      Lihat Foto {count > 1 ? `(${count})` : ""}
                                    </Button>
                                  );
                                })()}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPreviewSpb(spb)}
                                className="h-8 text-[11px] sm:text-xs font-semibold rounded-lg gap-1 border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer px-2.5 sm:px-3 shadow-none"
                              >
                                <Printer className="w-3.5 h-3.5" /> PDF
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedSpb(spb)}
                                className="h-8 text-[11px] sm:text-xs font-semibold rounded-lg gap-1 border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer px-2.5 sm:px-3 shadow-none"
                              >
                                <Eye className="w-3.5 h-3.5" /> Detail
                              </Button>
                              <Button
                                size="sm"
                                onClick={() =>
                                  setApprovingSpb({
                                    id: spb.id,
                                    spbNumber: spb.spbNumber,
                                  })
                                }
                                className="h-8 text-[11px] sm:text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1 px-2.5 sm:px-3 shadow-none"
                              >
                                <Check className="w-3.5 h-3.5" /> Setujui
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setRejectingSpb({
                                    id: spb.id,
                                    spbNumber: spb.spbNumber,
                                  });
                                  setSpbRejectReason("");
                                }}
                                className="h-8 text-[11px] sm:text-xs font-bold rounded-lg border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 cursor-pointer gap-1 px-2.5 sm:px-3 shadow-none"
                              >
                                <X className="w-3.5 h-3.5" /> Tolak
                              </Button>
                            </div>
                          </div>

                          <div className="overflow-x-auto rounded-lg border border-border/40">
                            <table className="w-full text-left text-xs min-w-130">
                              <thead className="bg-muted/30 text-muted-foreground font-semibold border-b border-border/40">
                                <tr>
                                  <th className="p-2.5 text-center w-10">No</th>
                                  <th className="p-2.5">Kode Barang</th>
                                  <th className="p-2.5">
                                    Nama Material / Barang
                                  </th>
                                  <th className="p-2.5">Tipe / Merk</th>
                                  <th className="p-2.5 text-center">Qty</th>
                                  <th className="p-2.5">Sumber</th>
                                  <th className="p-2.5">Catatan</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/20">
                                {(spb.items || []).map(
                                  (it: any, itemIdx: number) => (
                                    <tr
                                      key={it.id || itemIdx}
                                      className="hover:bg-muted/10"
                                    >
                                      <td className="p-2.5 text-center font-medium text-muted-foreground">
                                        {itemIdx + 1}
                                      </td>
                                      <td className="p-2.5 font-semibold text-primary">
                                        {getItemCode(it)}
                                      </td>
                                      <td className="p-2.5 font-bold text-foreground">
                                        {it.name}
                                      </td>
                                      <td className="p-2.5 text-muted-foreground font-medium">
                                        {it.typeMerk ||
                                          it.material?.typeMerk ||
                                          "-"}
                                      </td>
                                      <td className="p-2.5 text-center font-semibold text-foreground">
                                        {it.qty} {it.unit || "pcs"}
                                      </td>
                                      <td className="p-2.5 text-xs text-muted-foreground font-medium">
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-[10px] font-bold px-1.5 py-0",
                                            it.source === "TRADING"
                                              ? "bg-purple-500/10 text-purple-700 border-purple-300"
                                              : "bg-emerald-500/10 text-emerald-700 border-emerald-300",
                                          )}
                                        >
                                          {it.source === "TRADING"
                                            ? "Trading / Beli"
                                            : "Stok Gudang"}
                                        </Badge>
                                      </td>
                                      <td className="p-2.5 text-muted-foreground">
                                        {it.note || "-"}
                                      </td>
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}

                      {/* 2. Render SPB Gudang Documents */}
                      {group.spbGudangs.map((gudang) => (
                        <div
                          key={gudang.id}
                          className="p-3.5 sm:p-4 rounded-xl border border-purple-500/30 bg-background space-y-3 shadow-2xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className="bg-purple-500/10 text-purple-700 border-purple-300 font-bold text-[10px] px-1.5 py-0"
                                >
                                  SPB Gudang
                                </Badge>
                                <h4 className="text-xs font-bold text-primary">
                                  {gudang.spbNumber}
                                </h4>
                                <Badge
                                  variant="outline"
                                  className="bg-amber-500/10 text-amber-700 border-amber-300 font-bold text-[10px] px-1.5 py-0"
                                >
                                  Menunggu ACC Direksi
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Diajukan oleh:{" "}
                                <strong className="font-semibold text-foreground">
                                  {gudang.makerName ||
                                    "Sistem Produksi / Gudang"}
                                </strong>{" "}
                                • Tanggal:{" "}
                                {formatJakartaDate(
                                  gudang.createdAt,
                                  "datetime",
                                )}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 sm:gap-2 pt-1 sm:pt-0">
                              <Button
                                size="sm"
                                onClick={() =>
                                  setApprovingSpbGudangItem({
                                    id: gudang.id,
                                    spbNumber: gudang.spbNumber,
                                  })
                                }
                                disabled={isSubmitting}
                                className="h-8 text-[11px] sm:text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1 px-3 shadow-none"
                              >
                                <Check className="w-3.5 h-3.5" /> Setujui
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setRejectingSpbGudangItem({
                                    id: gudang.id,
                                    spbNumber: gudang.spbNumber,
                                  });
                                  setSpbGudangRejectReason("");
                                }}
                                disabled={isSubmitting}
                                className="h-8 text-[11px] sm:text-xs font-bold rounded-lg border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 cursor-pointer gap-1 px-3 shadow-none"
                              >
                                <X className="w-3.5 h-3.5" /> Tolak
                              </Button>
                            </div>
                          </div>

                          <div className="overflow-x-auto rounded-lg border border-border/40 bg-background">
                            <table className="w-full text-left text-xs min-w-130">
                              <thead className="bg-muted/30 text-muted-foreground font-semibold border-b border-border/40">
                                <tr>
                                  <th className="p-2.5 text-center w-10">No</th>
                                  <th className="p-2.5">Kode Barang</th>
                                  <th className="p-2.5">
                                    Nama Material / Barang
                                  </th>
                                  <th className="p-2.5">Tipe / Merk</th>
                                  <th className="p-2.5 text-center">Qty</th>
                                  <th className="p-2.5">Sumber</th>
                                  <th className="p-2.5">Catatan</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/20">
                                {(gudang.items || []).map(
                                  (it: any, itemIdx: number) => (
                                    <tr
                                      key={it.id || itemIdx}
                                      className="hover:bg-muted/10"
                                    >
                                      <td className="p-2.5 text-center font-medium text-muted-foreground">
                                        {itemIdx + 1}
                                      </td>
                                      <td className="p-2.5 font-semibold text-primary">
                                        {getItemCode(it)}
                                      </td>
                                      <td className="p-2.5 font-bold text-foreground">
                                        {it.name}
                                      </td>
                                      <td className="p-2.5 text-muted-foreground font-medium">
                                        {it.typeMerk || "-"}
                                      </td>
                                      <td className="p-2.5 text-center font-semibold text-foreground">
                                        {it.qty} {it.unit || "pcs"}
                                      </td>
                                      <td className="p-2.5 text-xs text-muted-foreground font-medium">
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-[10px] font-bold px-1.5 py-0",
                                            it.source === "TRADING"
                                              ? "bg-purple-500/10 text-purple-700 border-purple-300"
                                              : "bg-emerald-500/10 text-emerald-700 border-emerald-300",
                                          )}
                                        >
                                          {it.source === "TRADING"
                                            ? "Trading / Beli"
                                            : "Stok Gudang"}
                                        </Badge>
                                      </td>
                                      <td className="p-2.5 text-xs text-muted-foreground font-medium">
                                        {it.note || "-"}
                                      </td>
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </TabsContent>

        {/* TAB 2: PERSETUJUAN VENDOR PO */}
        <TabsContent value="vendor" className="space-y-4 m-0 outline-none">
          {/* Control Bar: Search & Pagination & Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-card border border-border/60 p-3 sm:p-4 rounded-xl shadow-xs">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari No SPB, proyek, barang..."
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
                className="h-8 text-xs font-semibold rounded-lg gap-1 border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer shadow-none"
              >
                <Loader2
                  className={cn("w-3.5 h-3.5", isSubmitting && "animate-spin")}
                />
                Refresh
              </Button>

              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 rounded-lg cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span>
                  {currentPage} / {totalVendorPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(p + 1, totalVendorPages))
                  }
                  disabled={currentPage === totalVendorPages}
                  className="h-8 w-8 rounded-lg cursor-pointer"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* List of SPBs with Vendor Items */}
          {paginatedVendorSpbGroups.length === 0 ? (
            <Card className="border border-dashed border-border/60 bg-muted/10 rounded-2xl p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-base font-bold text-foreground">
                Tidak Ada Penetapan Vendor Menunggu Persetujuan Direksi
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Semua penetapan supplier vendor telah disetujui atau belum lolos
                persetujuan PPIC.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {paginatedVendorSpbGroups.map((group, groupIdx) => {
                const spbNumber =
                  group.spb?.spbNumber ||
                  (group.itemType === "GUDANG"
                    ? "SPB Gudang"
                    : "SPB Tanpa Nomor");
                const projectName =
                  group.project?.projectName ||
                  (group.itemType === "GUDANG"
                    ? "Pengadaan & Stok Gudang"
                    : "Tanpa Proyek");
                const projectNumber =
                  group.project?.projectNumber ||
                  (group.itemType === "GUDANG" ? "GUDANG" : "-");
                const customerName =
                  group.project?.customer?.name ||
                  group.project?.customer?.company ||
                  "-";

                return (
                  <Card
                    key={groupIdx}
                    className="border border-border/60 rounded-xl overflow-hidden shadow-xs bg-card"
                  >
                    {/* Header Group */}
                    <div className="bg-muted/30 border-b border-border/40 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-bold text-[10px] px-2 py-0.5",
                            group.itemType === "GUDANG"
                              ? "bg-purple-500/10 text-purple-700 border-purple-300"
                              : "bg-blue-500/10 text-blue-700 border-blue-300",
                          )}
                        >
                          {group.itemType === "GUDANG"
                            ? "SPB Gudang"
                            : "SPB Project"}
                        </Badge>
                        <span className="text-xs font-bold text-primary">
                          {spbNumber}
                        </span>
                        <span className="text-muted-foreground/50 hidden sm:inline">
                          •
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          {projectName} ({projectNumber})
                        </span>
                      </div>

                      {group.itemType !== "GUDANG" && (
                        <div className="text-[11px] text-muted-foreground">
                          Customer:{" "}
                          <span className="font-semibold text-foreground">
                            {customerName}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Table of Items */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs min-w-140">
                        <thead className="bg-muted/20 text-muted-foreground font-semibold border-b border-border/40">
                          <tr>
                            <th className="p-3 text-center w-10">No</th>
                            <th className="p-3">Nama Material / Barang</th>
                            <th className="p-3">Tipe / Merk</th>
                            <th className="p-3 text-center">Qty</th>
                            <th className="p-3">Vendor Pilihan</th>
                            <th className="p-3 text-right">Harga Satuan</th>
                            <th className="p-3 text-right">Total Estimasi</th>
                            <th className="p-3">Catatan</th>
                            <th className="p-3 text-center">Aksi Final</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                          {group.items.map((item, itemIdx) => {
                            const unitPrice =
                              Number(item.selectedCatalogPrice) || 0;
                            const totalPrice = (item.qty || 0) * unitPrice;
                            const itemType: "PROJECT" | "GUDANG" =
                              item.itemType || group.itemType || "PROJECT";

                            return (
                              <tr
                                key={item.id || itemIdx}
                                className="hover:bg-muted/10"
                              >
                                <td className="p-3 text-center font-medium text-muted-foreground">
                                  {itemIdx + 1}
                                </td>
                                <td className="p-3 font-bold text-foreground">
                                  {item.name}
                                </td>
                                <td className="p-3 text-muted-foreground font-medium">
                                  {item.typeMerk || "-"}
                                </td>
                                <td className="p-3 text-center font-semibold text-foreground">
                                  {item.qty} {item.unit || "pcs"}
                                </td>
                                <td className="p-3">
                                  <span className="font-bold text-primary">
                                    {item.selectedSupplierName || "-"}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-medium text-foreground">
                                  {unitPrice > 0
                                    ? formatRupiah(unitPrice)
                                    : "-"}
                                </td>
                                <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                  {totalPrice > 0
                                    ? formatRupiah(totalPrice)
                                    : "-"}
                                </td>
                                <td className="p-3 text-xs text-muted-foreground font-medium">
                                  {item.vendorSelectionNote || "-"}
                                </td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        setApprovingVendorItem({
                                          id: item.id,
                                          name: item.name,
                                          itemType: itemType,
                                          supplierName:
                                            item.selectedSupplierName || "-",
                                          catalogPrice:
                                            item.selectedCatalogPrice,
                                          spbNumber: spbNumber,
                                        })
                                      }
                                      disabled={isSubmitting}
                                      className="h-7 text-[11px] font-bold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer px-2.5 shadow-none gap-1"
                                    >
                                      <Check className="w-3 h-3" /> Setujui
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setRejectingVendorItem({
                                          id: item.id,
                                          name: item.name,
                                          itemType: itemType,
                                          supplierName:
                                            item.selectedSupplierName || "-",
                                          spbNumber: spbNumber,
                                        });
                                        setVendorRejectReason("");
                                      }}
                                      disabled={isSubmitting}
                                      className="h-7 text-[11px] font-bold rounded-md border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 cursor-pointer px-2.5 shadow-none gap-1"
                                    >
                                      <X className="w-3 h-3" /> Tolak
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* MODAL APPROVAL KONFIRMASI SPB PROJECT (DIREKSI) */}
      <Dialog
        open={!!approvingSpb}
        onOpenChange={(open) => !open && setApprovingSpb(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-600" /> Persetujuan Final
              SPB Project
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Apakah Anda yakin ingin menyetujui Surat Permintaan Barang{" "}
              <strong>{approvingSpb?.spbNumber}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApprovingSpb(null)}
              disabled={isSubmitting}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleApproveSpbSubmit}
              disabled={isSubmitting}
              className="rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Setujui"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL REJECTION SPB PROJECT (DIREKSI) */}
      <Dialog
        open={!!rejectingSpb}
        onOpenChange={(open) => !open && setRejectingSpb(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <X className="w-5 h-5 text-destructive" /> Tolak SPB Project
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Masukkan alasan penolakan untuk SPB{" "}
              <strong>{rejectingSpb?.spbNumber}</strong>. Alasan ini akan
              tercatat dan dikirimkan ke pembuat SPB.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Textarea
              placeholder="Tulis alasan penolakan di sini (wajib)..."
              value={spbRejectReason}
              onChange={(e) => setSpbRejectReason(e.target.value)}
              className="text-xs rounded-xl min-h-24 resize-none border-border/60 focus-visible:ring-destructive/20"
            />
          </div>
          <DialogFooter className="flex flex-row justify-end gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectingSpb(null)}
              disabled={isSubmitting}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRejectSpbSubmit}
              disabled={isSubmitting || !spbRejectReason.trim()}
              className="rounded-lg text-xs font-bold cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Tolak SPB"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL APPROVAL KONFIRMASI SPB GUDANG (DIREKSI) */}
      <Dialog
        open={!!approvingSpbGudangItem}
        onOpenChange={(open) => !open && setApprovingSpbGudangItem(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-600" /> Persetujuan SPB
              Gudang
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Apakah Anda yakin ingin memberikan persetujuan Direksi untuk SPB
              Gudang <strong>{approvingSpbGudangItem?.spbNumber}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApprovingSpbGudangItem(null)}
              disabled={isSubmitting}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleApproveSpbGudangSubmit}
              disabled={isSubmitting}
              className="rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Setujui"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL REJECTION SPB GUDANG (DIREKSI) */}
      <Dialog
        open={!!rejectingSpbGudangItem}
        onOpenChange={(open) => !open && setRejectingSpbGudangItem(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <X className="w-5 h-5 text-destructive" /> Tolak SPB Gudang
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Masukkan alasan penolakan untuk SPB Gudang{" "}
              <strong>{rejectingSpbGudangItem?.spbNumber}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Textarea
              placeholder="Tulis alasan penolakan di sini (wajib)..."
              value={spbGudangRejectReason}
              onChange={(e) => setSpbGudangRejectReason(e.target.value)}
              className="text-xs rounded-xl min-h-24 resize-none border-border/60 focus-visible:ring-destructive/20"
            />
          </div>
          <DialogFooter className="flex flex-row justify-end gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectingSpbGudangItem(null)}
              disabled={isSubmitting}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRejectSpbGudangSubmit}
              disabled={isSubmitting || !spbGudangRejectReason.trim()}
              className="rounded-lg text-xs font-bold cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Tolak SPB Gudang"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL APPROVAL KONFIRMASI VENDOR SELECTION (DIREKSI) */}
      <Dialog
        open={!!approvingVendorItem}
        onOpenChange={(open) => !open && setApprovingVendorItem(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-600" /> Persetujuan Final
              Vendor PO
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Apakah Anda yakin menyetujui pemilihan vendor berikut untuk
              pengadaan:
            </DialogDescription>
          </DialogHeader>

          {approvingVendorItem && (
            <div className="bg-muted/30 border border-border/60 rounded-xl p-3.5 space-y-2 text-xs my-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipe Dokumen:</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0",
                    approvingVendorItem.itemType === "GUDANG"
                      ? "bg-purple-500/10 text-purple-700 border-purple-300"
                      : "bg-blue-500/10 text-blue-700 border-blue-300",
                  )}
                >
                  {approvingVendorItem.itemType === "GUDANG"
                    ? "SPB Gudang"
                    : "SPB Project"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nomor SPB:</span>
                <span className="font-bold text-primary">
                  {approvingVendorItem.spbNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Material / Barang:
                </span>
                <span className="font-bold text-foreground text-right">
                  {approvingVendorItem.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vendor Pilihan:</span>
                <span className="font-bold text-primary">
                  {approvingVendorItem.supplierName}
                </span>
              </div>
              {approvingVendorItem.catalogPrice ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Harga Penawaran:
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatRupiah(approvingVendorItem.catalogPrice)}
                  </span>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter className="flex flex-row justify-end gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApprovingVendorItem(null)}
              disabled={isSubmitting}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleApproveVendorDireksiSubmit}
              disabled={isSubmitting}
              className="rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Setujui"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL REJECTION VENDOR SELECTION (DIREKSI) */}
      <Dialog
        open={!!rejectingVendorItem}
        onOpenChange={(open) => !open && setRejectingVendorItem(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <X className="w-5 h-5 text-destructive" /> Tolak Pemilihan Vendor
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Tolak penetapan vendor{" "}
              <strong>{rejectingVendorItem?.supplierName}</strong> pada barang{" "}
              <strong>{rejectingVendorItem?.name}</strong> (
              {rejectingVendorItem?.spbNumber}).
            </DialogDescription>
          </DialogHeader>

          <div className="py-3">
            <Textarea
              placeholder="Tulis alasan penolakan vendor di sini (wajib)..."
              value={vendorRejectReason}
              onChange={(e) => setVendorRejectReason(e.target.value)}
              className="text-xs rounded-xl min-h-24 resize-none border-border/60 focus-visible:ring-destructive/20"
            />
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectingVendorItem(null)}
              disabled={isSubmitting}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRejectVendorDireksiSubmit}
              disabled={isSubmitting || !vendorRejectReason.trim()}
              className="rounded-lg text-xs font-bold cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Tolak Vendor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DETAIL DIALOG SPB */}
      <Dialog
        open={!!selectedSpb}
        onOpenChange={(open) => !open && setSelectedSpb(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-5xl rounded-2xl p-4 sm:p-6 max-h-[90vh] flex flex-col overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold text-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-primary">
                Detail SPB ({selectedSpb?.spbNumber})
              </span>
              <Badge className="bg-primary text-primary-foreground font-bold text-xs px-2.5 py-1 rounded-lg shrink-0">
                {selectedSpb?.status === "PENDING_APPROVAL"
                  ? "Menunggu Persetujuan Direksi"
                  : selectedSpb?.status === "APPROVED"
                    ? "Disetujui"
                    : selectedSpb?.status === "REJECTED"
                      ? "Ditolak"
                      : selectedSpb?.status || "Menunggu Persetujuan"}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Informasi rinci Surat Permintaan Barang untuk proyek{" "}
              {selectedSpb?.project?.projectName} (
              {selectedSpb?.project?.projectNumber}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 bg-muted/20 p-3 sm:p-3.5 rounded-xl border border-border/40 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Nomor SPB
                </span>
                <span className="font-bold text-foreground">
                  {selectedSpb?.spbNumber || "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Proyek
                </span>
                <span className="font-bold text-foreground">
                  {selectedSpb?.project?.projectName || "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Customer
                </span>
                <span className="font-bold text-foreground">
                  {selectedSpb?.project?.customer?.company ||
                    selectedSpb?.project?.customer?.name ||
                    "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Diajukan Oleh
                </span>
                <span className="font-bold text-foreground">
                  {selectedSpb?.makerName || "User"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Tanggal Dibuat
                </span>
                <span className="font-bold text-foreground">
                  {selectedSpb?.createdAt
                    ? format(
                        new Date(selectedSpb.createdAt),
                        "dd MMMM yyyy HH:mm",
                        { locale: id },
                      )
                    : "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Status Approval
                </span>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${selectedSpb?.approvedByPpic ? "border-emerald-500 text-emerald-600 bg-emerald-50" : "border-amber-500 text-amber-600 bg-amber-50"}`}
                  >
                    PPIC: {selectedSpb?.approvedByPpic ? "Approved" : "Pending"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${selectedSpb?.approvedByPm ? "border-emerald-500 text-emerald-600 bg-emerald-50" : "border-amber-500 text-amber-600 bg-amber-50"}`}
                  >
                    PM: {selectedSpb?.approvedByPm ? "Approved" : "Pending"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${selectedSpb?.approvedByDireksi ? "border-emerald-500 text-emerald-600 bg-emerald-50" : "border-amber-500 text-amber-600 bg-amber-50"}`}
                  >
                    Direksi:{" "}
                    {selectedSpb?.approvedByDireksi ? "Approved" : "Pending"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground">
                Daftar Material Barang ({selectedSpb?.items?.length || 0} item)
              </h4>
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full text-left text-xs min-w-130">
                  <thead className="bg-muted/40 text-muted-foreground font-extrabold border-b border-border/40">
                    <tr>
                      <th className="p-2.5 text-center w-10">No</th>
                      <th className="p-2.5">Kode Barang</th>
                      <th className="p-2.5">Nama Material</th>
                      <th className="p-2.5">Tipe / Merk</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5">Sumber</th>
                      <th className="p-2.5">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {selectedSpb?.items?.map((it: any, itemIdx: number) => (
                      <tr key={it.id || itemIdx} className="hover:bg-muted/10">
                        <td className="p-2.5 text-center font-bold text-muted-foreground">
                          {itemIdx + 1}
                        </td>
                        <td className="p-2.5 font-semibold text-primary">
                          {getItemCode(it)}
                        </td>
                        <td className="p-2.5 font-bold text-foreground">
                          {it.name}
                        </td>
                        <td className="p-2.5 text-muted-foreground font-medium">
                          {it.typeMerk || it.material?.typeMerk || "-"}
                        </td>
                        <td className="p-2.5 text-center font-semibold text-primary">
                          {it.qty} {it.unit || "pcs"}
                        </td>
                        <td className="p-2.5 text-xs text-muted-foreground font-medium">
                          {it.source === "WAREHOUSE"
                            ? "Gudang"
                            : "Trading / Beli"}
                        </td>
                        <td className="p-2.5 text-muted-foreground">
                          {it.note || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedSpb(null)}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PREVIEW PDF DIALOG */}
      <Dialog
        open={!!previewSpb}
        onOpenChange={(open) => !open && setPreviewSpb(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-4xl h-[90vh] max-h-[90vh] flex flex-col p-4 sm:p-6 bg-zinc-950 border-zinc-800 text-white rounded-2xl">
          <DialogHeader className="flex-none">
            <DialogTitle className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary" /> Preview Dokumen SPB (
              {previewSpb?.spbNumber})
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full h-full min-h-0 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mt-2">
            {previewSpb && (
              <PDFViewer width="100%" height="100%" className="border-none">
                <SPBPDFDocument spb={previewSpb} project={previewSpb.project} />
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

      {/* IMAGE PREVIEW DIALOG */}
      <Dialog
        open={previewModalImages.length > 0}
        onOpenChange={(open) => !open && setPreviewModalImages([])}
      >
        <DialogContent className="w-[95vw] sm:max-w-3xl rounded-2xl p-4 sm:p-6 flex flex-col items-center">
          <DialogHeader className="w-full flex flex-row items-center justify-between">
            <DialogTitle className="text-sm sm:text-base font-bold text-primary flex items-center gap-2">
              <FileImage className="w-5 h-5 text-primary" /> Lampiran Foto SPB{" "}
              {previewModalImages.length > 1
                ? `(${activeImageIndex + 1}/${previewModalImages.length})`
                : ""}
            </DialogTitle>
          </DialogHeader>
          {previewModalImages.length > 0 && (
            <div className="w-full flex flex-col items-center my-2 space-y-3">
              <div className="w-full max-h-[65vh] flex items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-black/5 p-2 relative group">
                <img
                  src={previewModalImages[activeImageIndex]}
                  alt={`Lampiran SPB ${activeImageIndex + 1}`}
                  className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-md"
                />

                {previewModalImages.length > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() =>
                        setActiveImageIndex((prev) =>
                          prev > 0 ? prev - 1 : previewModalImages.length - 1,
                        )
                      }
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100 shadow-md h-9 w-9 cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>

                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() =>
                        setActiveImageIndex((prev) =>
                          prev < previewModalImages.length - 1 ? prev + 1 : 0,
                        )
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100 shadow-md h-9 w-9 cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </>
                )}
              </div>

              {/* Thumbnail Selector */}
              {previewModalImages.length > 1 && (
                <div className="flex items-center gap-2 max-w-full overflow-x-auto p-1">
                  {previewModalImages.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                        activeImageIndex === idx
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Thumb ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="w-full mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewModalImages([])}
              className="rounded-lg text-xs font-semibold cursor-pointer w-full sm:w-auto"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
