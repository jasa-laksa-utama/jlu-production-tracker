"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { formatJakartaDate } from "@/lib/date-utils";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Check,
  X,
  FileText,
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2,
  AlertCircle,
  Eye,
  Printer,
  Wrench,
  Calendar,
  FileImage,
  ShoppingCart,
  Building2,
} from "lucide-react";
import { getSPBImageUrl, getSPBImageUrls } from "@/app/actions/documents";
import { parseSPBImageUrls, cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  approveSpbByPpic,
  rejectSpb,
  approveSPBGudangByPpic,
  rejectSPBGudang,
  approveVendorSelectionByPpic,
  rejectVendorSelectionByPpic,
} from "@/app/actions/spb";
import { approveBoQByPpic, rejectBoQ } from "@/app/actions/boq-approval";
import { approveSPJByPpic, rejectSPJ } from "@/app/actions/spj";
import {
  approveGoodsReleaseMemo,
  rejectGoodsReleaseMemo,
} from "@/app/actions/goods-memo";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/utils";
import dynamic from "next/dynamic";
import { SPBPDFDocument } from "@/components/trackers/spb-pdf-document";
import { SPJPDFDocument } from "@/components/trackers/spj-pdf-document";
import { BoQPDFDocument } from "@/components/trackers/boq-pdf-document";
import { SPBSubstitutionCard } from "@/components/trackers/spb-substitution-card";

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

interface PpicSpbApprovalClientProps {
  initialSpbs: any[];
  initialBoqs: any[];
  initialSpjs?: any[];
  initialMemos?: any[];
  initialSubstitutions?: any[];
  initialSpbGudang?: any[];
  initialVendorItems?: any[];
  masterItems?: any[];
}

export function PpicSpbApprovalClient({
  initialSpbs,
  initialBoqs,
  initialSpjs = [],
  initialMemos = [],
  initialSubstitutions = [],
  initialSpbGudang = [],
  initialVendorItems = [],
  masterItems = [],
}: PpicSpbApprovalClientProps) {
  const [spbs, setSpbs] = useState<any[]>(initialSpbs);
  const [boqs, setBoqs] = useState<any[]>(initialBoqs);
  const [spjs, setSpjs] = useState<any[]>(initialSpjs);
  const [memos, setMemos] = useState<any[]>(initialMemos);
  const [substitutions, setSubstitutions] =
    useState<any[]>(initialSubstitutions);
  const [spbGudangList, setSpbGudangList] = useState<any[]>(initialSpbGudang);
  const [vendorItems, setVendorItems] = useState<any[]>(initialVendorItems);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const masterItemMap = useMemo(() => {
    const byId: Record<string, string> = {};
    const byName: Record<string, string> = {};
    if (Array.isArray(masterItems)) {
      masterItems.forEach((it: any) => {
        if (it.id && it.code) byId[it.id] = it.code;
        if (it.name && it.code) byName[it.name.trim().toLowerCase()] = it.code;
      });
    }
    return { byId, byName };
  }, [masterItems]);

  const getItemCode = (it: any) => {
    if (it.materialCode) return it.materialCode;
    if (it.material?.code) return it.material.code;
    if (it.itemCode) return it.itemCode;
    if (it.code) return it.code;
    if (it.materialId && masterItemMap.byId[it.materialId]) {
      return masterItemMap.byId[it.materialId];
    }
    if (it.name) {
      const clean = it.name.trim().toLowerCase();
      if (masterItemMap.byName[clean]) {
        return masterItemMap.byName[clean];
      }
    }
    return "-";
  };

  const handleApproveSpbGudangPpic = async (
    spbId: string,
    spbNumber: string,
  ) => {
    setIsSubmitting(true);
    const toastId = toast.loading(`Menyetujui SPB Gudang ${spbNumber}...`);

    const res = await approveSPBGudangByPpic(spbId);
    setIsSubmitting(false);

    if (res.success) {
      toast.success(res.message, { id: toastId });
      setSpbGudangList((prev) => prev.filter((item) => item.id !== spbId));
    } else {
      toast.error(res.error || "Gagal menyetujui SPB Gudang", { id: toastId });
    }
  };

  const handleRejectSpbGudangPpic = async (
    spbId: string,
    spbNumber: string,
    reason: string,
  ) => {
    if (!reason || !reason.trim()) {
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(`Menolak SPB Gudang ${spbNumber}...`);

    const res = await rejectSPBGudang(spbId, "PPIC", reason);
    setIsSubmitting(false);

    if (res.success) {
      toast.success(res.message, { id: toastId });
      setSpbGudangList((prev) => prev.filter((item) => item.id !== spbId));
    } else {
      toast.error(res.error || "Gagal menolak SPB Gudang", { id: toastId });
    }
  };

  const [activeTab, setActiveTab] = useState("spb");

  // Search & Pagination states
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detail Dialog states
  const [selectedSpb, setSelectedSpb] = useState<any | null>(null);
  const [previewSpb, setPreviewSpb] = useState<any | null>(null);

  const [selectedBoq, setSelectedBoq] = useState<any | null>(null);
  const [previewBoq, setPreviewBoq] = useState<any | null>(null);

  const [selectedSpj, setSelectedSpj] = useState<any | null>(null);
  const [previewSpj, setPreviewSpj] = useState<any | null>(null);

  // Memo Detail & Approval states
  const [selectedMemo, setSelectedMemo] = useState<any | null>(null);
  const [approvingMemoId, setApprovingMemoId] = useState<string | null>(null);
  const [rejectingMemoId, setRejectingMemoId] = useState<string | null>(null);
  const [memoRejectReason, setMemoRejectReason] = useState("");

  // Approval Dialog states
  const [approvingSpbId, setApprovingSpbId] = useState<string | null>(null);
  const [approvingBoqId, setApprovingBoqId] = useState<string | null>(null);
  const [approvingSpjId, setApprovingSpjId] = useState<string | null>(null);
  const [approvingSpbGudangItem, setApprovingSpbGudangItem] = useState<{
    id: string;
    spbNumber: string;
  } | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // Vendor Approval & Rejection states
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

  // Rejection Dialog states for SPB, BoQ, SPJ, SPB Gudang
  const [rejectingSpbId, setRejectingSpbId] = useState<string | null>(null);
  const [rejectingBoqId, setRejectingBoqId] = useState<string | null>(null);
  const [rejectingSpjId, setRejectingSpjId] = useState<string | null>(null);
  const [rejectingSpbGudangItem, setRejectingSpbGudangItem] = useState<{
    id: string;
    spbNumber: string;
  } | null>(null);
  const [spbGudangRejectReason, setSpbGudangRejectReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  const handleApproveVendorPpicSubmit = async () => {
    if (!approvingVendorItem) return;

    setIsSubmitting(true);
    const toastId = toast.loading(
      `Menyetujui Vendor (${approvingVendorItem.supplierName}) untuk "${approvingVendorItem.name}"...`,
    );

    const res = await approveVendorSelectionByPpic(
      approvingVendorItem.id,
      undefined,
      approvingVendorItem.itemType,
    );
    setIsSubmitting(false);

    if (res.success) {
      toast.success(res.message, { id: toastId });
      setVendorItems((prev) =>
        prev.filter((it) => it.id !== approvingVendorItem.id),
      );
      setApprovingVendorItem(null);
    } else {
      toast.error(res.error || "Gagal menyetujui vendor", { id: toastId });
    }
  };

  const handleRejectVendorPpicSubmit = async () => {
    if (!rejectingVendorItem) return;

    if (!vendorRejectReason || !vendorRejectReason.trim()) {
      toast.error("Alasan penolakan vendor wajib diisi!");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(
      `Menolak Vendor untuk "${rejectingVendorItem.name}"...`,
    );

    const res = await rejectVendorSelectionByPpic(
      rejectingVendorItem.id,
      vendorRejectReason.trim(),
      rejectingVendorItem.itemType,
    );
    setIsSubmitting(false);

    if (res.success) {
      toast.success(res.message, { id: toastId });
      setVendorItems((prev) =>
        prev.filter((it) => it.id !== rejectingVendorItem.id),
      );
      setRejectingVendorItem(null);
      setVendorRejectReason("");
    } else {
      toast.error(res.error || "Gagal menolak vendor", { id: toastId });
    }
  };

  const handleApproveSpbGudangSubmit = async () => {
    if (!approvingSpbGudangItem) return;

    setIsSubmitting(true);
    const toastId = toast.loading(
      `Menyetujui SPB Gudang ${approvingSpbGudangItem.spbNumber}...`,
    );

    const res = await approveSPBGudangByPpic(approvingSpbGudangItem.id);
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
      "PPIC",
      spbGudangRejectReason,
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
  const [previewModalImages, setPreviewModalImages] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  const handleApproveSubmit = async () => {
    if (!approvingSpbId) return;

    setIsApproving(true);
    const toastId = toast.loading("Memproses persetujuan SPB...");
    try {
      const res = await approveSpbByPpic(approvingSpbId);
      if (res.success) {
        setSpbs((prev) => prev.filter((item) => item.id !== approvingSpbId));
        toast.success("SPB berhasil disetujui!", { id: toastId });
        setApprovingSpbId(null);
        setSelectedSpb(null);
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
        setSelectedSpb(null);
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
      const res = await approveBoQByPpic(approvingBoqId);
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
      toast.error("Terjadi kesalahan sistem saat menyetujui BoQ.", {
        id: toastId,
      });
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
      toast.error("Terjadi kesalahan sistem saat menolak BoQ.", {
        id: toastId,
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const handleApproveSpjSubmit = async () => {
    if (!approvingSpjId) return;
    setIsApproving(true);
    const toastId = toast.loading("Memproses persetujuan SPJ...");
    try {
      const res = await approveSPJByPpic(approvingSpjId);
      if (res.success) {
        setSpjs((prev) => prev.filter((item) => item.id !== approvingSpjId));
        toast.success("SPJ berhasil disetujui!", { id: toastId });
        setApprovingSpjId(null);
        setSelectedSpj(null);
      } else {
        toast.error(res.error || "Gagal menyetujui SPJ.", { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan sistem saat menyetujui SPJ.", {
        id: toastId,
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectSpjSubmit = async () => {
    if (!rejectingSpjId) return;
    if (!rejectReason.trim()) {
      toast.error("Alasan penolakan harus diisi!");
      return;
    }
    setIsRejecting(true);
    const toastId = toast.loading("Memproses penolakan SPJ...");
    try {
      const res = await rejectSPJ(rejectingSpjId, rejectReason);
      if (res.success) {
        setSpjs((prev) => prev.filter((item) => item.id !== rejectingSpjId));
        toast.success("SPJ berhasil ditolak.", { id: toastId });
        setRejectingSpjId(null);
        setRejectReason("");
        setSelectedSpj(null);
      } else {
        toast.error(res.error || "Gagal menolak SPJ.", { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan sistem saat menolak SPJ.", {
        id: toastId,
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const handleApproveMemo = async (memoId: string) => {
    setIsApproving(true);
    const toastId = toast.loading("Memproses persetujuan Memo Pengeluaran...");
    try {
      const res = await approveGoodsReleaseMemo(memoId);
      if (res.success) {
        setMemos((prev) => prev.filter((item) => item.id !== memoId));
        toast.success("Memo Pengeluaran Barang berhasil disetujui PPIC.", {
          id: toastId,
        });
        setApprovingMemoId(null);
        setSelectedMemo(null);
      } else {
        toast.error(res.error || "Gagal menyetujui memo.", { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan sistem saat menyetujui memo.", {
        id: toastId,
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectMemo = async () => {
    if (!rejectingMemoId) return;
    if (!memoRejectReason.trim()) {
      toast.error("Alasan penolakan memo harus diisi!");
      return;
    }
    setIsRejecting(true);
    const toastId = toast.loading("Memproses penolakan Memo Pengeluaran...");
    try {
      const res = await rejectGoodsReleaseMemo(
        rejectingMemoId,
        memoRejectReason,
      );
      if (res.success) {
        setMemos((prev) => prev.filter((item) => item.id !== rejectingMemoId));
        toast.success("Memo Pengeluaran Barang telah ditolak.", {
          id: toastId,
        });
        setRejectingMemoId(null);
        setMemoRejectReason("");
        setSelectedMemo(null);
      } else {
        toast.error(res.error || "Gagal menolak memo.", { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan sistem saat menolak memo.", {
        id: toastId,
      });
    } finally {
      setIsRejecting(false);
    }
  };

  // Group all SPBs (SPB Project + SPB Gudang) by Project
  const projectsMap: {
    [key: string]: {
      id: string;
      project: any;
      spbs: any[];
      spbGudangs: any[];
    };
  } = {};

  const filteredSpbs = spbs.filter((spb) => {
    const q = searchQuery.toLowerCase();
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

  const filteredSpbGudang = spbGudangList.filter((gudang) => {
    const q = searchQuery.toLowerCase();
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
  const totalItems = projectGroups.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedProjectGroups = projectGroups.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  // Group BoQs by Project
  const boqProjectsMap: { [key: string]: { project: any; boqs: any[] } } = {};
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

  // Group SPJs by Project
  const spjProjectsMap: { [key: string]: { project: any; spjs: any[] } } = {};
  const filteredSpjs = spjs.filter((spj) => {
    const q = searchQuery.toLowerCase();
    return (
      (spj.spjNumber || "").toLowerCase().includes(q) ||
      (spj.project?.projectName || "").toLowerCase().includes(q) ||
      (spj.project?.projectNumber || "").toLowerCase().includes(q) ||
      (spj.project?.customer?.name || "").toLowerCase().includes(q) ||
      (spj.project?.customer?.company || "").toLowerCase().includes(q) ||
      (spj.makerName || "").toLowerCase().includes(q)
    );
  });

  filteredSpjs.forEach((spj) => {
    const projId = spj.projectId || "unassigned";
    if (!spjProjectsMap[projId]) {
      spjProjectsMap[projId] = {
        project: spj.project || {
          projectName: "Tanpa Proyek",
          projectNumber: "-",
        },
        spjs: [],
      };
    }
    spjProjectsMap[projId].spjs.push(spj);
  });

  const spjProjectGroups = Object.values(spjProjectsMap);
  const totalSpjItems = spjProjectGroups.length;
  const totalSpjPages = Math.ceil(totalSpjItems / pageSize) || 1;
  const paginatedSpjProjectGroups = spjProjectGroups.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  // Filter & Paginate Substitutions
  const filteredSubstitutions = substitutions.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const spbNum = (item.spb?.spbNumber || "").toLowerCase();
    const projName = (item.spb?.project?.projectName || "").toLowerCase();
    const custName = (item.spb?.project?.customer?.name || "").toLowerCase();
    const compName = (item.spb?.project?.customer?.company || "").toLowerCase();
    const origName = (item.originalName || item.name || "").toLowerCase();
    const subName = (item.substitutedName || "").toLowerCase();

    return (
      spbNum.includes(q) ||
      projName.includes(q) ||
      custName.includes(q) ||
      compName.includes(q) ||
      origName.includes(q) ||
      subName.includes(q)
    );
  });

  const totalSubItems = filteredSubstitutions.length;
  const totalSubPages = Math.ceil(totalSubItems / pageSize) || 1;
  const paginatedSubstitutions = filteredSubstitutions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  // Filter & Paginate Vendor Selections (SPB Project + SPB Gudang)
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
  const activeVendorPage = Math.min(currentPage, totalVendorPages);
  const paginatedVendorSpbGroups = useMemo(() => {
    const start = (activeVendorPage - 1) * pageSize;
    return vendorSpbGroups.slice(start, start + pageSize);
  }, [vendorSpbGroups, activeVendorPage, pageSize]);

  return (
    <div className="space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val);
          setCurrentPage(1);
          setSearchQuery("");
        }}
        className="w-full"
      >
        {/* Mobile-scrollable TabsList with precise brand accents */}
        <div className="w-full overflow-x-auto whitespace-nowrap flex-nowrap pb-1 mb-4 sm:mb-6 no-scrollbar">
          <TabsList className="inline-flex h-10 sm:h-11 items-center justify-start rounded-2xl bg-muted/60 p-1 text-muted-foreground gap-1 border border-border/40 shrink-0">
            <TabsTrigger
              value="spb"
              className="rounded-xl px-3 sm:px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer flex items-center gap-1.5 sm:gap-2"
            >
              <span>Persetujuan SPB</span>
              {spbs.length + spbGudangList.length > 0 && (
                <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  {spbs.length + spbGudangList.length}
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
            <TabsTrigger
              value="spj"
              className="rounded-xl px-3 sm:px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer flex items-center gap-1.5 sm:gap-2"
            >
              <span>Persetujuan SPJ</span>
              {spjs.length > 0 && (
                <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  {spjs.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="boq"
              className="rounded-xl px-3 sm:px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer flex items-center gap-1.5 sm:gap-2"
            >
              <span>Persetujuan BoQ</span>
              {boqs.length > 0 && (
                <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  {boqs.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="memo"
              className="rounded-xl px-3 sm:px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer flex items-center gap-1.5 sm:gap-2"
            >
              <span>Memo Pengeluaran</span>
              {memos.length > 0 && (
                <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  {memos.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="substitution"
              className="rounded-xl px-3 sm:px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer flex items-center gap-1.5 sm:gap-2"
            >
              <span>Substitusi Barang SPB</span>
              {substitutions.length > 0 && (
                <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  {substitutions.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: PERSETUJUAN SPB (ACCENT: BLUE) */}
        <TabsContent
          value="spb"
          className="space-y-4 m-0 border-0 p-0 outline-hidden"
        >
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
                Halaman {currentPage} dari {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
                disabled={currentPage === totalPages}
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
                Tidak Ada SPB Menunggu Persetujuan PPIC
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Semua dokumen SPB Proyek dan SPB Gudang telah disetujui atau
                belum diajukan oleh tim engineering/gudang.
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
                const totalSpbCount =
                  group.spbs.length + group.spbGudangs.length;
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
                          {totalSpbCount} Dokumen Menunggu
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
                                <h4 className="text-xs font-bold text-foreground">
                                  {spb.spbNumber}
                                </h4>
                                <Badge
                                  variant="outline"
                                  className="bg-amber-500/10 text-amber-700 border-amber-300 font-bold text-[10px] px-1.5 py-0"
                                >
                                  Menunggu ACC PPIC
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
                                onClick={() => setApprovingSpbId(spb.id)}
                                className="h-8 text-[11px] sm:text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1 px-2.5 sm:px-3 shadow-none"
                              >
                                <Check className="w-3.5 h-3.5" /> Setujui
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRejectingSpbId(spb.id)}
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
                                  Menunggu ACC PPIC
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

        {/* TAB 2: PERSETUJUAN SPJ (PRIMARY ACCENT) */}
        <TabsContent
          value="spj"
          className="space-y-4 m-0 border-0 p-0 outline-hidden"
        >
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card border border-border/60 p-4 rounded-2xl shadow-xs">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari SPJ, pekerjaan, customer..."
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
                Halaman {currentPage} dari {totalSpjPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalSpjPages))
                }
                disabled={currentPage === totalSpjPages}
                className="h-8 w-8 rounded-lg cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {paginatedSpjProjectGroups.length === 0 ? (
            <Card className="border border-dashed border-border/60 bg-muted/10 rounded-2xl p-12 text-center">
              <Wrench className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-base font-bold text-foreground">
                Tidak Ada SPJ Menunggu Persetujuan PPIC
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Semua Surat Permintaan Jasa (SPJ) telah disetujui atau belum
                diajukan.
              </p>
            </Card>
          ) : (
            <Accordion
              type="multiple"
              defaultValue={paginatedSpjProjectGroups.map(
                (g, idx) => g.project?.id || `group-spj-${idx}`,
              )}
              className="space-y-3"
            >
              {paginatedSpjProjectGroups.map((group, idx) => (
                <AccordionItem
                  key={group.project.id || idx}
                  value={group.project.id || `group-spj-${idx}`}
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
                            <h3 className="text-xs sm:text-sm font-bold text-foreground">
                              {group.project.projectName}
                            </h3>
                          </div>
                          <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5 sm:mt-1">
                            Customer:{" "}
                            {group.project.customer?.company ||
                              group.project.customer?.name ||
                              "-"}
                          </p>
                        </div>
                      </div>

                      <span className="text-xs font-semibold text-muted-foreground self-start sm:self-auto shrink-0">
                        {group.spjs.length} SPJ Menunggu
                      </span>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="border-t border-border/40 bg-muted/5 p-3 sm:p-5 space-y-3 pb-4">
                    {group.spjs.map((spj) => (
                      <div
                        key={spj.id}
                        className="p-3.5 sm:p-4 rounded-xl border border-border/60 bg-background space-y-3 shadow-2xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                          <div>
                            <h4 className="text-xs font-bold text-foreground">
                              {spj.spjNumber}
                            </h4>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Pengaju:{" "}
                              <strong className="font-semibold text-foreground">
                                {spj.makerName || "User"}
                              </strong>{" "}
                              • Tanggal:{" "}
                              {format(
                                new Date(spj.createdAt),
                                "dd MMM yyyy HH:mm",
                                { locale: id },
                              )}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 sm:pt-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPreviewSpj(spj)}
                              className="h-8 text-[11px] sm:text-xs font-semibold rounded-lg gap-1 border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer px-2.5 sm:px-3 shadow-none"
                            >
                              <Printer className="w-3.5 h-3.5" /> PDF
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedSpj(spj)}
                              className="h-8 text-[11px] sm:text-xs font-semibold rounded-lg gap-1 border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer px-2.5 sm:px-3 shadow-none"
                            >
                              <Eye className="w-3.5 h-3.5" /> Detail
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setApprovingSpjId(spj.id)}
                              className="h-8 text-[11px] sm:text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1 px-2.5 sm:px-3 shadow-none"
                            >
                              <Check className="w-3.5 h-3.5" /> Setujui
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRejectingSpjId(spj.id)}
                              className="h-8 text-[11px] sm:text-xs font-bold rounded-lg border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 cursor-pointer gap-1 px-2.5 sm:px-3 shadow-none"
                            >
                              <X className="w-3.5 h-3.5" /> Tolak
                            </Button>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-border/40">
                          <table className="w-full text-left text-xs min-w-125">
                            <thead className="bg-muted/30 text-muted-foreground font-semibold border-b border-border/40">
                              <tr>
                                <th className="p-2.5 text-center w-10">No</th>
                                <th className="p-2.5">Nama Jasa / Pekerjaan</th>
                                <th className="p-2.5 text-center">Qty</th>
                                <th className="p-2.5">Catatan</th>
                                <th className="p-2.5 text-center">
                                  Status Item
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                              {spj.items
                                .slice(0, 5)
                                .map((it: any, itemIdx: number) => (
                                  <tr key={it.id} className="hover:bg-muted/10">
                                    <td className="p-2.5 text-center font-medium text-muted-foreground">
                                      {itemIdx + 1}
                                    </td>
                                    <td className="p-2.5 font-bold text-foreground">
                                      {it.name}
                                    </td>
                                    <td className="p-2.5 text-center font-semibold text-foreground">
                                      {it.qty} {it.unit || "ls"}
                                    </td>
                                    <td className="p-2.5 text-muted-foreground">
                                      {it.note || "-"}
                                    </td>
                                    <td className="p-2.5 text-center">
                                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                        Menunggu
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                          {spj.items.length > 5 && (
                            <button
                              type="button"
                              onClick={() => setSelectedSpj(spj)}
                              className="w-full py-2 text-center text-xs font-bold text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 border-t border-border/40 transition-colors cursor-pointer"
                            >
                              +{spj.items.length - 5} more
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        {/* TAB 3: PERSETUJUAN BOQ (PRIMARY ACCENT) */}
        <TabsContent
          value="boq"
          className="space-y-4 m-0 border-0 p-0 outline-hidden"
        >
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
                Halaman {currentPage} dari {totalBoqPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalBoqPages))
                }
                disabled={currentPage === totalBoqPages}
                className="h-8 w-8 rounded-lg cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {paginatedBoqProjectGroups.length === 0 ? (
            <Card className="border border-dashed border-border/60 bg-muted/10 rounded-2xl p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-base font-bold text-foreground">
                Tidak Ada BoQ Menunggu Persetujuan PPIC
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Semua Bill of Quantities (BoQ) telah disetujui atau belum
                diajukan oleh tim engineering.
              </p>
            </Card>
          ) : (
            <Accordion
              type="multiple"
              defaultValue={paginatedBoqProjectGroups.map(
                (g, idx) => g.project?.id || `group-boq-${idx}`,
              )}
              className="space-y-3"
            >
              {paginatedBoqProjectGroups.map((group, idx) => (
                <AccordionItem
                  key={group.project.id || idx}
                  value={group.project.id || `group-boq-${idx}`}
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
                            <h3 className="text-xs sm:text-sm font-bold text-foreground">
                              {group.project.projectName}
                            </h3>
                          </div>
                          <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5 sm:mt-1">
                            Customer:{" "}
                            {group.project.customer?.company ||
                              group.project.customer?.name ||
                              "-"}
                          </p>
                        </div>
                      </div>

                      <span className="text-xs font-semibold text-muted-foreground self-start sm:self-auto shrink-0">
                        {group.boqs.length} BoQ Menunggu
                      </span>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="border-t border-border/40 bg-muted/5 p-3 sm:p-5 space-y-3 pb-4">
                    {group.boqs.map((boq) => (
                      <div
                        key={boq.id}
                        className="p-3.5 sm:p-4 rounded-xl border border-border/60 bg-background space-y-3 shadow-2xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                          <div>
                            <h4 className="text-xs font-bold text-foreground">
                              {boq.boqNumber}
                            </h4>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Pembuat:{" "}
                              <strong className="font-semibold text-foreground">
                                {boq.boqMakerName || "Engineering"}
                              </strong>{" "}
                              • Tanggal:{" "}
                              {format(
                                new Date(boq.createdAt),
                                "dd MMM yyyy HH:mm",
                                { locale: id },
                              )}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 sm:pt-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPreviewBoq(boq)}
                              className="h-8 text-[11px] sm:text-xs font-semibold rounded-lg gap-1 border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer px-2.5 sm:px-3 shadow-none"
                            >
                              <Printer className="w-3.5 h-3.5" /> PDF
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedBoq(boq)}
                              className="h-8 text-[11px] sm:text-xs font-semibold rounded-lg gap-1 border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer px-2.5 sm:px-3 shadow-none"
                            >
                              <Eye className="w-3.5 h-3.5" /> Detail
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setApprovingBoqId(boq.id)}
                              className="h-8 text-[11px] sm:text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1 px-2.5 sm:px-3 shadow-none"
                            >
                              <Check className="w-3.5 h-3.5" /> Setujui
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRejectingBoqId(boq.id)}
                              className="h-8 text-[11px] sm:text-xs font-bold rounded-lg border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 cursor-pointer gap-1 px-2.5 sm:px-3 shadow-none"
                            >
                              <X className="w-3.5 h-3.5" /> Tolak
                            </Button>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-border/40">
                          <table className="w-full text-left text-xs min-w-137.5">
                            <thead className="bg-muted/30 text-muted-foreground font-semibold border-b border-border/40">
                              <tr>
                                <th className="p-2.5 text-center w-10">No</th>
                                <th className="p-2.5">Material</th>
                                <th className="p-2.5">Tipe / Merk</th>
                                <th className="p-2.5 text-center">Qty</th>
                                <th className="p-2.5 text-right">
                                  Harga Satuan
                                </th>
                                <th className="p-2.5 text-right">
                                  Total Subtotal
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                              {boq.boqItems
                                ?.slice(0, 5)
                                .map((it: any, itemIdx: number) => (
                                  <tr key={it.id} className="hover:bg-muted/10">
                                    <td className="p-2.5 text-center font-medium text-muted-foreground">
                                      {itemIdx + 1}
                                    </td>
                                    <td className="p-2.5 font-bold text-foreground">
                                      {it.item?.name || "-"}
                                    </td>
                                    <td className="p-2.5 text-muted-foreground font-medium">
                                      {it.item?.typeMerk ||
                                        it.item?.code ||
                                        "-"}
                                    </td>
                                    <td className="p-2.5 text-center font-semibold text-foreground">
                                      {it.qty} {it.unit || "pcs"}
                                    </td>
                                    <td className="p-2.5 text-right font-medium">
                                      {formatRupiah(Number(it.price || 0))}
                                    </td>
                                    <td className="p-2.5 text-right font-bold text-foreground">
                                      {formatRupiah(
                                        Number(it.qty || 0) *
                                          Number(it.price || 0),
                                      )}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                          {boq.boqItems && boq.boqItems.length > 5 && (
                            <button
                              type="button"
                              onClick={() => setSelectedBoq(boq)}
                              className="w-full py-2 text-center text-xs font-bold text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 border-t border-border/40 transition-colors cursor-pointer"
                            >
                              +{boq.boqItems.length - 5} more
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        {/* TAB 4: PERSETUJUAN MEMO PENGELUARAN BARANG (PRIMARY ACCENT) */}
        <TabsContent
          value="memo"
          className="space-y-4 m-0 border-0 p-0 outline-hidden"
        >
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card border border-border/60 p-4 rounded-2xl shadow-xs">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nomor memo, proyek, pemohon..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-muted/20 border-2 border-border/60 text-xs font-semibold focus-visible:ring-primary/20"
              />
            </div>
          </div>

          {memos.length === 0 ? (
            <Card className="border border-dashed border-border/60 bg-muted/10 rounded-2xl p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-base font-bold text-foreground">
                Tidak Ada Memo Pengeluaran Menunggu Persetujuan PPIC
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Semua pengajuan Memo Pengeluaran Barang dari divisi Produksi
                telah diproses.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {memos
                .filter((memo: any) => {
                  const q = searchQuery.toLowerCase();
                  return (
                    (memo.memoNumber || "").toLowerCase().includes(q) ||
                    (memo.requesterName || "").toLowerCase().includes(q) ||
                    (memo.project?.projectName || "")
                      .toLowerCase()
                      .includes(q) ||
                    (memo.project?.projectNumber || "")
                      .toLowerCase()
                      .includes(q)
                  );
                })
                .map((memo: any) => (
                  <Card
                    key={memo.id}
                    className="border border-border/60 rounded-2xl bg-card overflow-hidden shadow-xs hover:border-primary/30 transition-all p-5 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded border border-border/60">
                            {memo.memoNumber}
                          </span>
                          {memo.project && (
                            <span className="text-xs font-semibold text-muted-foreground">
                              {memo.project.projectNumber} •{" "}
                              {memo.project.projectName}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Pemohon:{" "}
                          <strong className="text-foreground">
                            {memo.requesterName}
                          </strong>{" "}
                          ({memo.division}) • Tanggal:{" "}
                          {formatJakartaDate(memo.createdAt, "datetime")}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRejectingMemoId(memo.id);
                            setMemoRejectReason("");
                          }}
                          className="h-8 text-xs font-bold text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 cursor-pointer rounded-lg shadow-none"
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Tolak Memo
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setApprovingMemoId(memo.id);
                            handleApproveMemo(memo.id);
                          }}
                          disabled={isApproving}
                          className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer rounded-lg shadow-none"
                        >
                          {isApproving && approvingMemoId === memo.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          ) : (
                            <Check className="w-3.5 h-3.5 mr-1" />
                          )}
                          Setujui Memo
                        </Button>
                      </div>
                    </div>

                    {/* Table of items requested */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-foreground">
                        Daftar Barang Diminta ({memo.items?.length || 0} Item)
                      </h4>
                      <div className="overflow-x-auto rounded-xl border border-border/40 bg-muted/5">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-muted/40 text-muted-foreground font-extrabold border-b border-border/40">
                            <tr>
                              <th className="p-2.5 text-center w-10">No</th>
                              <th className="p-2.5">Nama Barang</th>
                              <th className="p-2.5 text-center">Tipe</th>
                              <th className="p-2.5 text-center">
                                Jumlah Diminta
                              </th>
                              <th className="p-2.5">Catatan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/20">
                            {memo.items
                              ?.slice(0, 5)
                              .map((it: any, itemIdx: number) => (
                                <tr
                                  key={it.id || itemIdx}
                                  className="hover:bg-muted/10"
                                >
                                  <td className="p-2.5 text-center font-extrabold text-muted-foreground">
                                    {itemIdx + 1}
                                  </td>
                                  <td className="p-2.5 font-bold text-foreground">
                                    {it.itemName}
                                    {it.itemCode && (
                                      <span className="text-muted-foreground font-normal ml-1">
                                        ({it.itemCode})
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <Badge className="text-[10px] font-bold border-none bg-primary/10 text-primary">
                                      {it.itemType === "NON_CONSUMABLE"
                                        ? "🛠️ Alat / Equipment"
                                        : "📦 Sekali Pakai"}
                                    </Badge>
                                  </td>
                                  <td className="p-2.5 text-center font-extrabold text-primary">
                                    {it.qtyRequested} {it.unit}
                                  </td>
                                  <td className="p-2.5 text-muted-foreground italic">
                                    {it.notes || "-"}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {memo.items && memo.items.length > 5 && (
                          <button
                            type="button"
                            onClick={() => setSelectedMemo(memo)}
                            className="w-full py-2 text-center text-xs font-bold text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 border-t border-border/40 transition-colors cursor-pointer"
                          >
                            +{memo.items.length - 5} more
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 5: PERSETUJUAN SUBSTITUSI BARANG (PRIMARY ACCENT) */}
        <TabsContent
          value="substitution"
          className="space-y-4 m-0 border-0 p-0 outline-hidden"
        >
          <div className="flex flex-col gap-2 bg-card border border-border/60 p-4 rounded-2xl shadow-xs">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary" />
              Persetujuan Substitusi Barang SPB / PO
            </h3>
            <p className="text-xs text-muted-foreground">
              Daftar pengajuan penggantian merk/spesifikasi barang pada SPB yang
              telah disetujui Engineering dan membutuhkan persetujuan PPIC.
            </p>
          </div>

          {/* Search & Pagination Bar */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card border border-border/60 p-4 rounded-2xl shadow-xs">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari No SPB, proyek, customer, PT..."
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
                Halaman {currentPage} dari {totalSubPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalSubPages))
                }
                disabled={currentPage === totalSubPages}
                className="h-8 w-8 rounded-lg cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {paginatedSubstitutions.length === 0 ? (
            <Card className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-8 text-center">
              <p className="text-sm font-semibold text-muted-foreground">
                {substitutions.length === 0
                  ? "Tidak ada pengajuan substitusi barang yang menunggu persetujuan PPIC saat ini."
                  : "Tidak ada pengajuan substitusi barang yang sesuai dengan pencarian."}
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {paginatedSubstitutions.map((item: any, index: number) => {
                const globalIndex = (currentPage - 1) * pageSize + index + 1;
                const customerName = item.spb?.project?.customer?.name || "-";
                const companyName = item.spb?.project?.customer?.company || "-";
                return (
                  <Card
                    key={item.id}
                    className="rounded-2xl border border-border/60 p-4 space-y-3 bg-card shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="secondary"
                          className="font-bold text-[11px] px-2 py-0.5 border border-border/60"
                        >
                          No. {globalIndex}
                        </Badge>
                        <span className="font-bold text-primary">
                          {item.spb?.spbNumber || "SPB"}
                        </span>
                        <span className="text-muted-foreground/60">•</span>
                        <span className="font-semibold text-foreground">
                          {item.spb?.project?.projectName || "Proyek"}
                        </span>
                        <span className="text-muted-foreground/60">•</span>
                        <span className="text-muted-foreground">
                          Customer:{" "}
                          <strong className="text-foreground font-semibold">
                            {customerName}
                          </strong>
                        </span>
                        <span className="text-muted-foreground/60">•</span>
                        <span className="text-muted-foreground">
                          PT:{" "}
                          <strong className="text-foreground font-semibold">
                            {companyName}
                          </strong>
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-amber-500/10 text-amber-600 border-amber-300 font-semibold text-[10px] shrink-0 self-start sm:self-auto"
                      >
                        Menunggu PPIC
                      </Badge>
                    </div>
                    <SPBSubstitutionCard
                      item={item}
                      index={globalIndex}
                      onUpdated={() => window.location.reload()}
                    />
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB: PERSETUJUAN VENDOR PO (PPIC STAGE 1) */}
        <TabsContent
          value="vendor"
          className="space-y-4 m-0 border-0 p-0 outline-hidden"
        >
          {/* Control Bar: Search & Pagination */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card border border-border/60 p-4 rounded-2xl shadow-xs">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari SPB, proyek, vendor, barang..."
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
                disabled={activeVendorPage === 1}
                className="h-8 w-8 rounded-lg cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>
                Halaman {activeVendorPage} dari {totalVendorPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalVendorPages))
                }
                disabled={activeVendorPage === totalVendorPages}
                className="h-8 w-8 rounded-lg cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Accordion Grouped List Content */}
          {paginatedVendorSpbGroups.length === 0 ? (
            <Card className="border border-dashed border-border/60 bg-muted/10 rounded-2xl p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-base font-bold text-foreground">
                Tidak Ada Pengajuan Vendor Menunggu Persetujuan PPIC
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Semua dokumen pengajuan vendor SPB Proyek dan SPB Gudang telah
                disetujui atau belum diajukan oleh tim purchasing.
              </p>
            </Card>
          ) : (
            <Accordion
              type="multiple"
              defaultValue={paginatedVendorSpbGroups.map(
                (g, idx) => g.spb?.id || `vendor-group-${idx}`,
              )}
              className="space-y-3"
            >
              {paginatedVendorSpbGroups.map((group, idx) => {
                const globalIndex = (activeVendorPage - 1) * pageSize + idx + 1;
                const isGudang = group.itemType === "GUDANG";
                const customerName =
                  group.project?.customer?.company ||
                  group.project?.customer?.name ||
                  "-";

                return (
                  <AccordionItem
                    key={group.spb.id || idx}
                    value={group.spb.id || `vendor-group-${idx}`}
                    className="border border-border/60 rounded-2xl bg-card overflow-hidden shadow-xs hover:border-primary/30 transition-all border-b-0"
                  >
                    <AccordionTrigger className="p-3 sm:p-5 hover:bg-muted/10 hover:no-underline select-none">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full pr-1.5 sm:pr-4 text-left gap-2 sm:gap-4">
                        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
                          <span className="text-xs sm:text-sm font-bold text-muted-foreground shrink-0 min-w-4 sm:min-w-5 mt-0.5 sm:mt-0">
                            {globalIndex}.
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <span className="text-xs font-bold text-primary bg-primary/10 px-2 sm:px-2.5 py-0.5 rounded border border-primary/20">
                                {group.spb?.spbNumber || "SPB"}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-bold px-1.5 sm:px-2 py-0.5",
                                  isGudang
                                    ? "bg-purple-500/10 text-purple-700 border-purple-300"
                                    : "bg-blue-500/10 text-blue-700 border-blue-300",
                                )}
                              >
                                {isGudang ? "SPB Gudang" : "SPB Project"}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="bg-amber-500/10 text-amber-700 border-amber-300 font-bold text-[10px] px-1.5 sm:px-2 py-0.5"
                              >
                                Menunggu ACC PPIC
                              </Badge>
                              <span className="text-muted-foreground/60">
                                •
                              </span>
                              <h3 className="text-xs sm:text-sm font-bold text-foreground">
                                {group.project?.projectName || "Proyek"}
                              </h3>
                            </div>
                            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-1 leading-relaxed">
                              {isGudang ? (
                                <>
                                  Diajukan oleh:{" "}
                                  <strong className="font-semibold text-foreground">
                                    {group.spb?.makerName || "Gudang Utama"}
                                  </strong>{" "}
                                  <span className="hidden sm:inline">•</span>{" "}
                                  <br className="sm:hidden" />
                                  Tanggal:{" "}
                                  {formatJakartaDate(
                                    group.spb?.createdAt,
                                    "datetime",
                                  )}
                                </>
                              ) : (
                                <>
                                  Customer:{" "}
                                  <strong className="font-semibold text-foreground">
                                    {customerName}
                                  </strong>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground self-start sm:self-auto shrink-0 bg-muted/20 px-2 py-0.5 rounded-md border border-border/40">
                          {group.items.length} Barang
                        </span>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="border-t border-border/40 bg-muted/5 p-3 sm:p-5 space-y-3 pb-4">
                      <div className="overflow-x-auto rounded-lg border border-border/40 bg-background">
                        <table className="w-full text-left text-xs min-w-160">
                          <thead className="bg-muted/30 text-muted-foreground font-semibold border-b border-border/40">
                            <tr>
                              <th className="p-2.5 text-center w-10">No</th>
                              <th className="p-2.5">Nama Material / Barang</th>
                              <th className="p-2.5">Tipe / Merk</th>
                              <th className="p-2.5 text-center">Qty</th>
                              <th className="p-2.5">
                                Vendor Pilihan (Purchasing)
                              </th>
                              <th className="p-2.5 text-right">Harga Satuan</th>
                              <th className="p-2.5 text-right">
                                Total Estimasi
                              </th>
                              <th className="p-2.5">Catatan</th>
                              <th className="p-2.5 text-center w-44">
                                Aksi PPIC
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/20">
                            {group.items.map((item: any, itemIdx: number) => {
                              let candidateName =
                                item.selectedSupplierName || "-";
                              let candidates = item.candidateSuppliers || [];
                              if (typeof candidates === "string") {
                                try {
                                  candidates = JSON.parse(candidates);
                                } catch (e) {
                                  candidates = [];
                                }
                              }
                              if (
                                candidateName === "-" &&
                                Array.isArray(candidates) &&
                                candidates.length > 0
                              ) {
                                candidateName =
                                  candidates[0].supplierName ||
                                  candidates[0].name ||
                                  "-";
                              }

                              const catalogPrice =
                                item.selectedCatalogPrice !== null &&
                                item.selectedCatalogPrice !== undefined
                                  ? Number(item.selectedCatalogPrice)
                                  : candidates[0]?.catalogPrice || 0;

                              return (
                                <tr
                                  key={item.id || itemIdx}
                                  className="hover:bg-muted/10 transition-colors"
                                >
                                  <td className="p-2.5 text-center font-medium text-muted-foreground">
                                    {itemIdx + 1}
                                  </td>
                                  <td className="p-2.5 font-bold text-foreground">
                                    {item.name}
                                  </td>
                                  <td className="p-2.5 text-muted-foreground font-medium">
                                    {item.typeMerk || "-"}
                                  </td>
                                  <td className="p-2.5 text-center font-semibold text-foreground whitespace-nowrap">
                                    {item.qty} {item.unit || "pcs"}
                                  </td>
                                  <td className="p-2.5">
                                    <Badge
                                      variant="outline"
                                      className="bg-indigo-500/10 text-indigo-700 border-indigo-300 font-bold text-[10px] px-1.5 py-0"
                                    >
                                      {candidateName}
                                    </Badge>
                                  </td>
                                  <td className="p-2.5 text-right font-medium text-foreground whitespace-nowrap">
                                    {catalogPrice > 0
                                      ? formatRupiah(catalogPrice)
                                      : "-"}
                                  </td>
                                  <td className="p-2.5 text-right font-bold text-primary whitespace-nowrap">
                                    {catalogPrice > 0
                                      ? formatRupiah(catalogPrice * item.qty)
                                      : "-"}
                                  </td>
                                  <td className="p-2.5 text-xs text-muted-foreground font-medium max-w-40 truncate">
                                    {item.vendorSelectionNote || "-"}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          setRejectingVendorItem({
                                            id: item.id,
                                            name: item.name,
                                            itemType: isGudang
                                              ? "GUDANG"
                                              : "PROJECT",
                                            supplierName: candidateName,
                                            spbNumber:
                                              group.spb?.spbNumber || "SPB",
                                          })
                                        }
                                        disabled={isSubmitting}
                                        className="h-7 text-[11px] font-bold rounded-lg border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 cursor-pointer px-2"
                                      >
                                        <X className="w-3.5 h-3.5 mr-1" /> Tolak
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          setApprovingVendorItem({
                                            id: item.id,
                                            name: item.name,
                                            itemType: isGudang
                                              ? "GUDANG"
                                              : "PROJECT",
                                            supplierName: candidateName,
                                            catalogPrice,
                                            spbNumber:
                                              group.spb?.spbNumber || "SPB",
                                          })
                                        }
                                        disabled={isSubmitting}
                                        className="h-7 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer px-2 shadow-none"
                                      >
                                        <Check className="w-3.5 h-3.5 mr-1" />{" "}
                                        Setujui
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </TabsContent>
      </Tabs>

      {/* DETAIL DIALOG SPB */}
      <Dialog
        open={!!selectedSpb}
        onOpenChange={(open) => !open && setSelectedSpb(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-5xl! rounded-2xl p-4 sm:p-6 max-h-[90vh] flex flex-col overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold text-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-primary">
                Detail SPB ({selectedSpb?.spbNumber})
              </span>
              <Badge className="bg-primary text-primary-foreground font-bold text-xs px-2.5 py-1 rounded-lg shrink-0">
                {selectedSpb?.status === "PENDING_APPROVAL"
                  ? "Menunggu Persetujuan"
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
                  Status PPIC / PM
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
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

      {/* DETAIL DIALOG SPJ */}
      <Dialog
        open={!!selectedSpj}
        onOpenChange={(open) => !open && setSelectedSpj(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-3xl rounded-2xl p-4 sm:p-6 max-h-[90vh] flex flex-col overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold text-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-emerald-600">
                Detail SPJ ({selectedSpj?.spjNumber})
              </span>
              <Badge className="bg-emerald-600 text-white font-bold text-xs px-2.5 py-1 rounded-lg shrink-0">
                {selectedSpj?.status === "PENDING_APPROVAL"
                  ? "Menunggu Persetujuan"
                  : selectedSpj?.status === "APPROVED"
                    ? "Disetujui"
                    : selectedSpj?.status === "REJECTED"
                      ? "Ditolak"
                      : selectedSpj?.status || "Menunggu Persetujuan"}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Informasi rinci Surat Permintaan Jasa untuk proyek{" "}
              {selectedSpj?.project?.projectName} (
              {selectedSpj?.project?.projectNumber}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 bg-muted/20 p-3 sm:p-3.5 rounded-xl border border-border/40 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Nomor SPJ
                </span>
                <span className="font-bold text-foreground">
                  {selectedSpj?.spjNumber || "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Proyek
                </span>
                <span className="font-bold text-foreground">
                  {selectedSpj?.project?.projectName || "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Customer
                </span>
                <span className="font-bold text-foreground">
                  {selectedSpj?.project?.customer?.company ||
                    selectedSpj?.project?.customer?.name ||
                    "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Pengaju
                </span>
                <span className="font-bold text-foreground">
                  {selectedSpj?.makerName || "User"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Tanggal Dibuat
                </span>
                <span className="font-bold text-foreground">
                  {selectedSpj?.createdAt
                    ? format(
                        new Date(selectedSpj.createdAt),
                        "dd MMMM yyyy HH:mm",
                        { locale: id },
                      )
                    : "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Status PPIC / PM
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${selectedSpj?.approvedByPpic ? "border-emerald-500 text-emerald-600 bg-emerald-50" : "border-amber-500 text-amber-600 bg-amber-50"}`}
                  >
                    PPIC: {selectedSpj?.approvedByPpic ? "Approved" : "Pending"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${selectedSpj?.approvedByPm ? "border-emerald-500 text-emerald-600 bg-emerald-50" : "border-amber-500 text-amber-600 bg-amber-50"}`}
                  >
                    PM: {selectedSpj?.approvedByPm ? "Approved" : "Pending"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground">
                Daftar Pekerjaan / Jasa ({selectedSpj?.items?.length || 0} item)
              </h4>
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full text-left text-xs min-w-125">
                  <thead className="bg-muted/40 text-muted-foreground font-extrabold border-b border-border/40">
                    <tr>
                      <th className="p-2.5 text-center w-10">No</th>
                      <th className="p-2.5">Nama Jasa / Pekerjaan</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5">Catatan</th>
                      <th className="p-2.5 text-center">Status Item</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {selectedSpj?.items?.map((it: any, itemIdx: number) => (
                      <tr key={it.id || itemIdx} className="hover:bg-muted/10">
                        <td className="p-2.5 text-center font-bold text-muted-foreground">
                          {itemIdx + 1}
                        </td>
                        <td className="p-2.5 font-bold text-foreground">
                          {it.name}
                        </td>
                        <td className="p-2.5 text-center font-bold text-emerald-600">
                          {it.qty} {it.unit || "ls"}
                        </td>
                        <td className="p-2.5 text-muted-foreground">
                          {it.note || "-"}
                        </td>
                        <td className="p-2.5 text-center">
                          <Badge className="bg-amber-500/10 text-amber-700 border-none font-bold text-[10px]">
                            {it.status || "PENDING"}
                          </Badge>
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
              onClick={() => setSelectedSpj(null)}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DETAIL DIALOG BOQ */}
      <Dialog
        open={!!selectedBoq}
        onOpenChange={(open) => !open && setSelectedBoq(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-3xl rounded-2xl p-4 sm:p-6 max-h-[90vh] flex flex-col overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold text-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-primary">
                Detail BoQ ({selectedBoq?.boqNumber})
              </span>
              <Badge className="bg-primary text-primary-foreground font-bold text-xs px-2.5 py-1 rounded-lg shrink-0">
                {selectedBoq?.boqStatus === "PENDING_APPROVAL"
                  ? "Menunggu Persetujuan"
                  : selectedBoq?.boqStatus === "APPROVED"
                    ? "Disetujui"
                    : selectedBoq?.boqStatus === "REJECTED"
                      ? "Ditolak"
                      : selectedBoq?.boqStatus || "Menunggu Persetujuan"}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Informasi rinci Bill of Quantities untuk proyek{" "}
              {selectedBoq?.project?.projectName} (
              {selectedBoq?.project?.projectNumber}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 bg-muted/20 p-3 sm:p-3.5 rounded-xl border border-border/40 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Nomor BoQ
                </span>
                <span className="font-bold text-foreground">
                  {selectedBoq?.boqNumber || "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Proyek
                </span>
                <span className="font-bold text-foreground">
                  {selectedBoq?.project?.projectName || "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Customer
                </span>
                <span className="font-bold text-foreground">
                  {selectedBoq?.project?.customer?.company ||
                    selectedBoq?.project?.customer?.name ||
                    "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Pembuat
                </span>
                <span className="font-bold text-foreground">
                  {selectedBoq?.boqMakerName || "Engineering"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Tanggal Dibuat
                </span>
                <span className="font-bold text-foreground">
                  {selectedBoq?.createdAt
                    ? format(
                        new Date(selectedBoq.createdAt),
                        "dd MMMM yyyy HH:mm",
                        { locale: id },
                      )
                    : "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Status PPIC / PM
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${selectedBoq?.boqApprovedByPpic ? "border-emerald-500 text-emerald-600 bg-emerald-50" : "border-amber-500 text-amber-600 bg-amber-50"}`}
                  >
                    PPIC:{" "}
                    {selectedBoq?.boqApprovedByPpic ? "Approved" : "Pending"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${selectedBoq?.boqApprovedByPm ? "border-emerald-500 text-emerald-600 bg-emerald-50" : "border-amber-500 text-amber-600 bg-amber-50"}`}
                  >
                    PM: {selectedBoq?.boqApprovedByPm ? "Approved" : "Pending"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground">
                Daftar Material / BoQ ({selectedBoq?.boqItems?.length || 0}{" "}
                item)
              </h4>
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full text-left text-xs min-w-137.5">
                  <thead className="bg-muted/40 text-muted-foreground font-extrabold border-b border-border/40">
                    <tr>
                      <th className="p-2.5 text-center w-10">No</th>
                      <th className="p-2.5">Material</th>
                      <th className="p-2.5">Tipe / Merk</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Harga Satuan</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {selectedBoq?.boqItems?.map((it: any, itemIdx: number) => (
                      <tr key={it.id || itemIdx} className="hover:bg-muted/10">
                        <td className="p-2.5 text-center font-bold text-muted-foreground">
                          {itemIdx + 1}
                        </td>
                        <td className="p-2.5 font-bold text-foreground">
                          {it.item?.name || "-"}
                        </td>
                        <td className="p-2.5 text-muted-foreground font-medium">
                          {it.item?.typeMerk || it.item?.code || "-"}
                        </td>
                        <td className="p-2.5 text-center font-bold text-primary">
                          {it.qty} {it.unit || "pcs"}
                        </td>
                        <td className="p-2.5 text-right font-medium">
                          {formatRupiah(Number(it.price || 0))}
                        </td>
                        <td className="p-2.5 text-right font-bold text-foreground">
                          {formatRupiah(
                            Number(it.qty || 0) * Number(it.price || 0),
                          )}
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
              onClick={() => setSelectedBoq(null)}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* APPROVAL CONFIRMATION DIALOG SPB */}
      <Dialog
        open={!!approvingSpbId}
        onOpenChange={(open) => !open && setApprovingSpbId(null)}
      >
        <DialogContent className="w-[92vw] sm:max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-600" /> Confirm Approval
              SPB
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Apakah Anda yakin ingin menyetujui dokumen Surat Permintaan Barang
              (SPB) ini?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApprovingSpbId(null)}
              disabled={isApproving}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleApproveSubmit}
              disabled={isApproving}
              className="rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              {isApproving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Setujui SPB"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REJECTION REASON DIALOG SPB */}
      <Dialog
        open={!!rejectingSpbId}
        onOpenChange={(open) => !open && setRejectingSpbId(null)}
      >
        <DialogContent className="w-[92vw] sm:max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" /> Tolak
              Permintaan SPB
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Tuliskan alasan penolakan dokumen SPB ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              placeholder="e.g. Stok material di gudang sudah melebihi batas / data tidak valid"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="text-xs rounded-xl"
            />
          </div>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectingSpbId(null)}
              disabled={isRejecting}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRejectSubmit}
              disabled={isRejecting}
              className="rounded-lg text-xs font-bold cursor-pointer"
            >
              {isRejecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Tolak SPB"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* APPROVAL CONFIRMATION DIALOG SPJ */}
      <Dialog
        open={!!approvingSpjId}
        onOpenChange={(open) => !open && setApprovingSpjId(null)}
      >
        <DialogContent className="w-[92vw] sm:max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-600" /> Confirm Approval
              SPJ
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Apakah Anda yakin ingin menyetujui Surat Permintaan Jasa (SPJ)
              ini?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApprovingSpjId(null)}
              disabled={isApproving}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleApproveSpjSubmit}
              disabled={isApproving}
              className="rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              {isApproving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Setujui SPJ"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REJECTION REASON DIALOG SPJ */}
      <Dialog
        open={!!rejectingSpjId}
        onOpenChange={(open) => !open && setRejectingSpjId(null)}
      >
        <DialogContent className="w-[92vw] sm:max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" /> Tolak
              Permintaan SPJ
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Tuliskan alasan penolakan Surat Permintaan Jasa (SPJ) ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              placeholder="e.g. Alokasi budget jasa tidak mencukupi / spesifikasi belum sesuai"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="text-xs rounded-xl"
            />
          </div>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectingSpjId(null)}
              disabled={isRejecting}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRejectSpjSubmit}
              disabled={isRejecting}
              className="rounded-lg text-xs font-bold cursor-pointer"
            >
              {isRejecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Tolak SPJ"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* APPROVAL CONFIRMATION DIALOG BOQ */}
      <Dialog
        open={!!approvingBoqId}
        onOpenChange={(open) => !open && setApprovingBoqId(null)}
      >
        <DialogContent className="w-[92vw] sm:max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <Check className="w-5 h-5 text-primary" /> Confirm Approval BoQ
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Apakah Anda yakin ingin menyetujui dokumen Bill of Quantities
              (BoQ) ini?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApprovingBoqId(null)}
              disabled={isApproving}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleApproveBoqSubmit}
              disabled={isApproving}
              className="rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
            >
              {isApproving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Setujui BoQ"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REJECTION REASON DIALOG BOQ */}
      <Dialog
        open={!!rejectingBoqId}
        onOpenChange={(open) => !open && setRejectingBoqId(null)}
      >
        <DialogContent className="w-[92vw] sm:max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" /> Tolak
              Permintaan BoQ
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Tuliskan alasan penolakan dokumen BoQ ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              placeholder="e.g. Spesifikasi barang tidak sesuai / harga melebihi estimasi"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="text-xs rounded-xl"
            />
          </div>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectingBoqId(null)}
              disabled={isRejecting}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRejectBoqSubmit}
              disabled={isRejecting}
              className="rounded-lg text-xs font-bold cursor-pointer"
            >
              {isRejecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Tolak BoQ"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* APPROVAL CONFIRMATION DIALOG SPB GUDANG */}
      <Dialog
        open={!!approvingSpbGudangItem}
        onOpenChange={(open) => !open && setApprovingSpbGudangItem(null)}
      >
        <DialogContent className="w-[92vw] sm:max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-600" /> Confirm Approval
              SPB Gudang
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Apakah Anda yakin ingin menyetujui dokumen Surat Permintaan Barang
              Gudang (
              <strong className="text-foreground">
                {approvingSpbGudangItem?.spbNumber}
              </strong>
              )?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
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
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Setujui SPB Gudang"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REJECTION REASON DIALOG SPB GUDANG */}
      <Dialog
        open={!!rejectingSpbGudangItem}
        onOpenChange={(open) => !open && setRejectingSpbGudangItem(null)}
      >
        <DialogContent className="w-[92vw] sm:max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" /> Tolak SPB
              Gudang
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Tuliskan alasan penolakan dokumen SPB Gudang (
              <strong className="text-foreground">
                {rejectingSpbGudangItem?.spbNumber}
              </strong>
              ).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Textarea
              placeholder="Masukkan alasan penolakan (misal: Qty barang tidak valid / stok mencukupi)..."
              value={spbGudangRejectReason}
              onChange={(e) => setSpbGudangRejectReason(e.target.value)}
              className="text-xs rounded-xl min-h-[90px] resize-y"
            />
          </div>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
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
              disabled={isSubmitting}
              className="rounded-lg text-xs font-bold cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Tolak SPB Gudang"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Preview SPB PDF */}
      <Dialog
        open={!!previewSpb}
        onOpenChange={(open) => !open && setPreviewSpb(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-4xl h-[90vh] flex flex-col p-4 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-800 text-white">
          <DialogHeader className="flex-none">
            <DialogTitle className="text-sm sm:text-base font-bold text-white">
              Pratinjau Cetak SPB
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Pratinjau dokumen PDF Surat Permintaan Barang (
              {previewSpb?.spbNumber || "-"}).
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 w-full overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 mt-4 relative">
            {previewSpb && (
              <PDFViewer
                width="100%"
                height="100%"
                showToolbar={true}
                className="border-0"
              >
                <SPBPDFDocument
                  spb={previewSpb}
                  project={previewSpb?.project}
                />
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

      {/* Dialog Preview SPJ PDF */}
      <Dialog
        open={!!previewSpj}
        onOpenChange={(open) => !open && setPreviewSpj(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-4xl h-[90vh] flex flex-col p-4 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-800 text-white">
          <DialogHeader className="flex-none">
            <DialogTitle className="text-sm sm:text-base font-bold text-white">
              Pratinjau Cetak SPJ
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Pratinjau dokumen PDF Surat Permintaan Jasa (
              {previewSpj?.spjNumber || "-"}).
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 w-full overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 mt-4 relative">
            {previewSpj && (
              <PDFViewer
                width="100%"
                height="100%"
                showToolbar={true}
                className="border-0"
              >
                <SPJPDFDocument
                  spj={previewSpj}
                  project={previewSpj?.project}
                />
              </PDFViewer>
            )}
          </div>
          <DialogFooter className="mt-4 flex-none">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewSpj(null)}
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
        <DialogContent className="w-[95vw] sm:max-w-4xl h-[90vh] flex flex-col p-4 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-800 text-white">
          <DialogHeader className="flex-none">
            <DialogTitle className="text-base font-bold text-white">
              Pratinjau Cetak BoQ
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Pratinjau dokumen PDF Bill of Quantities (
              {previewBoq?.boqNumber || "-"}).
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 w-full overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 mt-4 relative">
            {previewBoq && (
              <PDFViewer
                width="100%"
                height="100%"
                showToolbar={true}
                className="border-0"
              >
                <BoQPDFDocument
                  project={{
                    ...previewBoq,
                    projectName: previewBoq.project?.projectName,
                    projectNumber: previewBoq.project?.projectNumber,
                    customer: previewBoq.project?.customer,
                  }}
                  items={previewBoq.boqItems?.map((it: any) => ({
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

      {/* REJECTION REASON DIALOG MEMO */}
      <Dialog
        open={!!rejectingMemoId}
        onOpenChange={(open) => !open && setRejectingMemoId(null)}
      >
        <DialogContent className="w-[92vw] sm:max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" /> Tolak Memo
              Pengeluaran Barang
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Tuliskan alasan penolakan pengajuan memo pengeluaran barang ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              placeholder="e.g. SPB belum lengkap / barang tidak sesuai peruntukan"
              value={memoRejectReason}
              onChange={(e) => setMemoRejectReason(e.target.value)}
              className="text-xs rounded-xl"
            />
          </div>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectingMemoId(null)}
              disabled={isRejecting}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRejectMemo}
              disabled={isRejecting}
              className="rounded-lg text-xs font-bold cursor-pointer"
            >
              {isRejecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Tolak Memo"
              )}
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

      {/* APPROVAL CONFIRMATION DIALOG VENDOR PPIC */}
      <Dialog
        open={!!approvingVendorItem}
        onOpenChange={(open) => !open && setApprovingVendorItem(null)}
      >
        <DialogContent className="w-[92vw] sm:max-w-md rounded-2xl p-4 sm:p-6 space-y-3">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-600 shrink-0" /> Konfirmasi
              Persetujuan Vendor (PPIC)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Apakah Anda yakin ingin menyetujui pengajuan vendor berikut untuk
              dilanjutkan ke tahap Persetujuan Direksi?
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/30 p-3.5 rounded-xl border border-border/50 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dokumen SPB:</span>
              <span className="font-bold text-foreground">
                {approvingVendorItem?.spbNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipe Dokumen:</span>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-bold px-1.5 py-0",
                  approvingVendorItem?.itemType === "GUDANG"
                    ? "bg-purple-500/10 text-purple-700 border-purple-300"
                    : "bg-blue-500/10 text-blue-700 border-blue-300",
                )}
              >
                {approvingVendorItem?.itemType === "GUDANG"
                  ? "SPB Gudang"
                  : "SPB Project"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nama Barang:</span>
              <span className="font-semibold text-foreground">
                {approvingVendorItem?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vendor:</span>
              <span className="font-bold text-primary">
                {approvingVendorItem?.supplierName}
              </span>
            </div>
            {approvingVendorItem?.catalogPrice ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Harga Satuan:</span>
                <span className="font-bold text-foreground">
                  {formatRupiah(approvingVendorItem.catalogPrice)}
                </span>
              </div>
            ) : null}
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
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
              onClick={handleApproveVendorPpicSubmit}
              disabled={isSubmitting}
              className="rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Setujui
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REJECTION REASON DIALOG VENDOR PPIC */}
      <Dialog
        open={!!rejectingVendorItem}
        onOpenChange={(open) => !open && setRejectingVendorItem(null)}
      >
        <DialogContent className="w-[92vw] sm:max-w-md rounded-2xl p-4 sm:p-6 space-y-3">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />{" "}
              Tolak Pengajuan Vendor
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Tuliskan alasan penolakan vendor untuk item{" "}
              <strong>{rejectingVendorItem?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1">
            <label className="text-xs font-bold text-foreground block">
              Alasan Penolakan (Wajib)
            </label>
            <Textarea
              placeholder="Contoh: Spesifikasi teknis belum sesuai, harga penawaran terlalu tinggi, minta opsi vendor lain..."
              value={vendorRejectReason}
              onChange={(e) => setVendorRejectReason(e.target.value)}
              className="text-xs rounded-xl min-h-[80px] resize-none"
            />
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRejectingVendorItem(null);
                setVendorRejectReason("");
              }}
              disabled={isSubmitting}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRejectVendorPpicSubmit}
              disabled={isSubmitting}
              className="rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <X className="w-3.5 h-3.5" />
              )}
              Tolak Pengajuan Vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
