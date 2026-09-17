"use client";

import { useState, useMemo, useTransition } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  ShieldCheck,
  Clock,
  CheckCircle2,
  CheckCheck,
} from "lucide-react";
import { getSPBImageUrl, getSPBImageUrls } from "@/app/actions/documents";
import { parseSPBImageUrls, formatRupiah, cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  approveSpbByPm,
  rejectSpb,
  approveVendorSelectionByPm,
  batchApproveVendorSelectionByPm,
  rejectVendorSelectionByPm,
} from "@/app/actions/spb";
import { approveBoQByPm, rejectBoQ } from "@/app/actions/boq-approval";
import { approveSPJByPm, rejectSPJ } from "@/app/actions/spj";
import {
  approveQCReceiptByPM,
  rejectQCReceiptByPM,
} from "@/app/actions/qc-receipt-approval";
import { QCReceiptReportPreviewDialog } from "@/components/trackers/qc-receipt-report-preview-dialog";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { SPBPDFDocument } from "@/components/trackers/spb-pdf-document";
import { SPJPDFDocument } from "@/components/trackers/spj-pdf-document";
import { BoQPDFDocument } from "@/components/trackers/boq-pdf-document";
import { SPBSubstitutionCard } from "@/components/trackers/spb-substitution-card";
import { SPBVendorSelectionCard } from "@/components/trackers/spb-vendor-selection-card";

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

interface PmSpbApprovalClientProps {
  initialSpbs: any[];
  initialBoqs: any[];
  initialSpjs?: any[];
  initialSubstitutions?: any[];
  initialVendorItems?: any[];
  initialQCReceipts?: any[];
  masterItems?: any[];
}

export function PmSpbApprovalClient({
  initialSpbs,
  initialBoqs,
  initialSpjs = [],
  initialSubstitutions = [],
  initialVendorItems = [],
  initialQCReceipts = [],
  masterItems = [],
}: PmSpbApprovalClientProps) {
  const [spbs, setSpbs] = useState<any[]>(initialSpbs);
  const [boqs, setBoqs] = useState<any[]>(initialBoqs);
  const [spjs, setSpjs] = useState<any[]>(initialSpjs);
  const [substitutions, setSubstitutions] =
    useState<any[]>(initialSubstitutions);
  const [vendorItems, setVendorItems] = useState<any[]>(initialVendorItems);
  const [qcReceipts, setQcReceipts] = useState<any[]>(initialQCReceipts);
  const [isPending, startTransition] = useTransition();

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

  // Vendor Approval & Rejection dialog states (PM)
  const [approvingVendorItem, setApprovingVendorItem] = useState<{
    id: string;
    name: string;
    supplierName: string;
    catalogPrice?: number;
    spbNumber: string;
  } | null>(null);
  const [batchApprovingVendorGroup, setBatchApprovingVendorGroup] = useState<any | null>(null);
  const [rejectingVendorItem, setRejectingVendorItem] = useState<{
    id: string;
    name: string;
    supplierName: string;
    spbNumber: string;
  } | null>(null);
  const [vendorRejectReason, setVendorRejectReason] = useState("");
  const [activeVendorPage, setActiveVendorPage] = useState(1);

  const handleApproveVendorPmSubmit = async () => {
    if (!approvingVendorItem) return;
    setIsApproving(true);
    const toastId = toast.loading(
      `Menyetujui vendor untuk "${approvingVendorItem.name}"...`,
    );

    const res = await approveVendorSelectionByPm(approvingVendorItem.id);
    setIsApproving(false);

    if (res.success) {
      toast.success(res.message || "Persetujuan vendor berhasil disimpan!", {
        id: toastId,
      });
      setVendorItems((prev) =>
        prev.filter((item) => item.id !== approvingVendorItem.id),
      );
      setApprovingVendorItem(null);
    } else {
      toast.error(res.error || "Gagal menyetujui vendor", { id: toastId });
    }
  };

  const handleBatchApproveVendorPmSubmit = async () => {
    if (!batchApprovingVendorGroup || !batchApprovingVendorGroup.items?.length) return;

    const itemIds = batchApprovingVendorGroup.items.map((it: any) => it.id);
    setIsApproving(true);
    const toastId = toast.loading(
      `Menyetujui vendor untuk ${itemIds.length} barang sekaligus...`,
    );

    try {
      const res = await batchApproveVendorSelectionByPm(itemIds);
      setIsApproving(false);

      if (res.success) {
        toast.success(res.message || "Semua vendor pada dokumen ini berhasil disetujui PM!", {
          id: toastId,
        });
        const approvedSet = new Set(itemIds);
        setVendorItems((prev) => prev.filter((item) => !approvedSet.has(item.id)));
        setBatchApprovingVendorGroup(null);
      } else {
        toast.error(res.error || "Gagal menyetujui semua vendor", { id: toastId });
      }
    } catch (err: any) {
      setIsApproving(false);
      toast.error(err?.message || "Terjadi kesalahan sistem", { id: toastId });
    }
  };

  const handleRejectVendorPmSubmit = async () => {
    if (!rejectingVendorItem) return;
    if (!vendorRejectReason || !vendorRejectReason.trim()) {
      toast.error("Alasan penolakan vendor wajib diisi!");
      return;
    }

    setIsRejecting(true);
    const toastId = toast.loading(
      `Menolak vendor untuk "${rejectingVendorItem.name}"...`,
    );

    const res = await rejectVendorSelectionByPm(
      rejectingVendorItem.id,
      vendorRejectReason.trim(),
    );
    setIsRejecting(false);

    if (res.success) {
      toast.success(res.message || "Pengajuan vendor telah ditolak.", {
        id: toastId,
      });
      setVendorItems((prev) =>
        prev.filter((item) => item.id !== rejectingVendorItem.id),
      );
      setRejectingVendorItem(null);
      setVendorRejectReason("");
    } else {
      toast.error(res.error || "Gagal menolak vendor", { id: toastId });
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

  // Approval Dialog states
  const [approvingSpbId, setApprovingSpbId] = useState<string | null>(null);
  const [approvingBoqId, setApprovingBoqId] = useState<string | null>(null);
  const [approvingSpjId, setApprovingSpjId] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // Rejection Dialog states
  const [rejectingSpbId, setRejectingSpbId] = useState<string | null>(null);
  const [rejectingBoqId, setRejectingBoqId] = useState<string | null>(null);
  const [rejectingSpjId, setRejectingSpjId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [previewModalImages, setPreviewModalImages] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  const handleApproveSubmit = async () => {
    if (!approvingSpbId) return;

    setIsApproving(true);
    const toastId = toast.loading("Memproses persetujuan SPB...");
    try {
      const res = await approveSpbByPm(approvingSpbId);
      if (res.success) {
        setSpbs((prev) => prev.filter((item) => item.id !== approvingSpbId));
        toast.success("SPB berhasil disetujui PM!", { id: toastId });
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
      const res = await approveBoQByPm(approvingBoqId);
      if (res.success) {
        setBoqs((prev) => prev.filter((item) => item.id !== approvingBoqId));
        toast.success("BoQ berhasil disetujui PM!", { id: toastId });
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
      const res = await approveSPJByPm(approvingSpjId);
      if (res.success) {
        setSpjs((prev) => prev.filter((item) => item.id !== approvingSpjId));
        toast.success("SPJ berhasil disetujui PM!", { id: toastId });
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

  // Group SPBs by Project
  const projectsMap: { [key: string]: { project: any; spbs: any[] } } = {};
  const filteredSpbs = spbs.filter((spb) => {
    const q = searchQuery.toLowerCase();
    return (
      (spb.spbNumber || "").toLowerCase().includes(q) ||
      (spb.project?.projectName || "").toLowerCase().includes(q) ||
      (spb.project?.projectNumber || "").toLowerCase().includes(q) ||
      (spb.project?.customer?.name || "").toLowerCase().includes(q) ||
      (spb.project?.customer?.company || "").toLowerCase().includes(q) ||
      (spb.makerName || "").toLowerCase().includes(q)
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

  // --- TAB 5: VENDOR SELECTION (PM - ONLY PROJECT SPBS) ---
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
      };
    } = {};

    filteredVendorItems.forEach((item) => {
      const spbKey = item.spb?.id || item.spbId || "unassigned";
      if (!map[spbKey]) {
        map[spbKey] = {
          spb: item.spb || { spbNumber: "SPB" },
          project: item.spb?.project || {
            projectName: "Tanpa Proyek",
            projectNumber: "-",
            customer: null,
          },
          items: [],
        };
      }
      map[spbKey].items.push(item);
    });

    return Object.values(map);
  }, [filteredVendorItems]);

  const totalVendorPages = Math.ceil(vendorSpbGroups.length / pageSize) || 1;
  const paginatedVendorSpbGroups = vendorSpbGroups.slice(
    (activeVendorPage - 1) * pageSize,
    activeVendorPage * pageSize,
  );

  // --- TAB 6: QC Penerimaan Barang Filtering & Pagination ---
  const [pmQcNotes, setPmQcNotes] = useState<Record<string, string>>({});
  const [previewQCPO, setPreviewQCPO] = useState<any | null>(null);
  const [approvingQCPO, setApprovingQCPO] = useState<any | null>(null);
  const [rejectQCState, setRejectQCState] = useState<{
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

  const totalQCReceiptPages = Math.ceil(filteredQCReceipts.length / pageSize) || 1;
  const paginatedQCReceipts = filteredQCReceipts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleApproveQCPO = (po: any) => {
    const notes = pmQcNotes[po.id] || "";
    startTransition(async () => {
      const res = await approveQCReceiptByPM(po.id, notes);
      if (res.success) {
        toast.success(res.message || "Persetujuan final QC PO berhasil disimpan");
        setQcReceipts((prev) => prev.filter((p) => p.id !== po.id));
        setApprovingQCPO(null);
      } else {
        toast.error(res.error || "Gagal menyetujui laporan QC");
      }
    });
  };

  const handleConfirmRejectQCPO = () => {
    if (!rejectQCState.reason.trim()) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }
    startTransition(async () => {
      const res = await rejectQCReceiptByPM(
        rejectQCState.poId,
        rejectQCState.reason
      );
      if (res.success) {
        toast.success(res.message || "Pengajuan QC dikembalikan");
        setQcReceipts((prev) => prev.filter((p) => p.id !== rejectQCState.poId));
        setRejectQCState({ open: false, poId: "", poNumber: "", reason: "" });
      } else {
        toast.error(res.error || "Gagal menolak laporan QC");
      }
    });
  };

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
              {spbs.length > 0 && (
                <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  {spbs.length}
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
            <TabsTrigger
              value="vendor"
              className="rounded-xl px-3 sm:px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer flex items-center gap-1.5 sm:gap-2"
            >
              <span>Persetujuan Vendor</span>
              {vendorItems.length > 0 && (
                <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  {vendorItems.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="qc_receipt"
              className="rounded-xl px-3 sm:px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer flex items-center gap-1.5 sm:gap-2"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>Persetujuan QC Penerimaan</span>
              {qcReceipts.length > 0 && (
                <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  {qcReceipts.length}
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
                Tidak Ada SPB Menunggu Persetujuan PM
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Semua dokumen Surat Permintaan Barang (SPB) telah disetujui atau
                belum diajukan oleh tim.
              </p>
            </Card>
          ) : (
            <Accordion
              type="multiple"
              defaultValue={paginatedProjectGroups.map(
                (g, idx) => g.project?.id || `group-pm-spb-${idx}`,
              )}
              className="space-y-3"
            >
              {paginatedProjectGroups.map((group, idx) => (
                <AccordionItem
                  key={group.project.id || idx}
                  value={group.project.id || `group-pm-spb-${idx}`}
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
                        {group.spbs.length} SPB Menunggu
                      </span>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="border-t border-border/40 bg-muted/5 p-3 sm:p-5 space-y-3 pb-4">
                    {group.spbs.map((spb) => (
                      <div
                        key={spb.id}
                        className="p-3.5 sm:p-4 rounded-xl border border-border/60 bg-background space-y-3 shadow-2xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs font-bold text-foreground">
                                {spb.spbNumber}
                              </h4>
                              {spb.deadlineDate && (
                                <span className="text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                                  • Tenggat:{" "}
                                  {formatJakartaDate(spb.deadlineDate, "date")}
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
                                    <FileImage className="w-3.5 h-3.5" /> Lihat
                                    Foto {count > 1 ? `(${count})` : ""}
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
                              {spb.items
                                .slice(0, 5)
                                .map((it: any, itemIdx: number) => (
                                  <tr key={it.id} className="hover:bg-muted/10">
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
                          {spb.items.length > 5 && (
                            <button
                              type="button"
                              onClick={() => setSelectedSpb(spb)}
                              className="w-full py-2 text-center text-xs font-bold text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 border-t border-border/40 transition-colors cursor-pointer"
                            >
                              +{spb.items.length - 5} more
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
                Tidak Ada SPJ Menunggu Persetujuan PM
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
                (g, idx) => g.project?.id || `group-pm-spj-${idx}`,
              )}
              className="space-y-3"
            >
              {paginatedSpjProjectGroups.map((group, idx) => (
                <AccordionItem
                  key={group.project.id || idx}
                  value={group.project.id || `group-pm-spj-${idx}`}
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
                Tidak Ada BoQ Menunggu Persetujuan PM
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Semua Bill of Quantities (BoQ) telah disetujui atau belum
                diajukan.
              </p>
            </Card>
          ) : (
            <Accordion
              type="multiple"
              defaultValue={paginatedBoqProjectGroups.map(
                (g, idx) => g.project?.id || `group-pm-boq-${idx}`,
              )}
              className="space-y-3"
            >
              {paginatedBoqProjectGroups.map((group, idx) => (
                <AccordionItem
                  key={group.project.id || idx}
                  value={group.project.id || `group-pm-boq-${idx}`}
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

        {/* TAB 4: PERSETUJUAN SUBSTITUSI BARANG (PRIMARY ACCENT) */}
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
              telah disetujui Engineering & PPIC dan membutuhkan persetujuan
              Project Manager.
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
                  ? "Tidak ada pengajuan substitusi barang yang menunggu persetujuan PM saat ini."
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
                        Menunggu PM
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

        {/* TAB 5: PERSETUJUAN VENDOR BAGI PM (PROJECT SPB ONLY) */}
        <TabsContent
          value="vendor"
          className="space-y-4 m-0 border-0 p-0 outline-hidden"
        >
          {/* Control Bar: Search & Pagination & Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card border border-border/60 p-4 rounded-2xl shadow-xs">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari No SPB, proyek, barang..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveVendorPage(1);
                }}
                className="pl-9 h-10 rounded-xl bg-muted/20 border-2 border-border/60 text-xs font-semibold focus-visible:ring-primary/20"
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
                  className={cn(
                    "w-3.5 h-3.5",
                    (isApproving || isRejecting) && "animate-spin",
                  )}
                />
                Refresh
              </Button>

              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setActiveVendorPage((p) => Math.max(p - 1, 1))}
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
                    setActiveVendorPage((p) =>
                      Math.min(p + 1, totalVendorPages),
                    )
                  }
                  disabled={activeVendorPage === totalVendorPages}
                  className="h-8 w-8 rounded-lg cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* List of SPBs with Vendor Items */}
          {paginatedVendorSpbGroups.length === 0 ? (
            <Card className="border border-dashed border-border/60 bg-muted/10 rounded-2xl p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-base font-bold text-foreground">
                Tidak Ada Penetapan Vendor Menunggu Persetujuan PM
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Semua pengajuan vendor SPB Proyek telah disetujui atau belum
                diajukan oleh tim purchasing.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              <Accordion
                type="multiple"
                defaultValue={paginatedVendorSpbGroups.map(
                  (g, idx) => g.spb?.id || `pm-vendor-group-${idx}`,
                )}
                className="space-y-3"
              >
                {paginatedVendorSpbGroups.map((group, groupIdx) => {
                  const globalIndex =
                    (activeVendorPage - 1) * pageSize + groupIdx + 1;
                  const spbNumber = group.spb?.spbNumber || "SPB Tanpa Nomor";
                  const projectName =
                    group.project?.projectName || "Tanpa Proyek";
                  const projectNumber = group.project?.projectNumber || "-";
                  const customerName =
                    group.project?.customer?.name ||
                    group.project?.customer?.company ||
                    "-";

                  return (
                    <AccordionItem
                      key={group.spb?.id || groupIdx}
                      value={group.spb?.id || `pm-vendor-group-${groupIdx}`}
                      className="border border-border/60 rounded-2xl bg-card overflow-hidden shadow-xs hover:border-primary/30 transition-all border-b-0"
                    >
                      <AccordionTrigger className="px-4 py-3.5 sm:px-5 sm:py-4 hover:bg-muted/10 hover:no-underline select-none">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full pr-2 text-left gap-2 sm:gap-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-muted-foreground shrink-0 w-4">
                              {globalIndex}.
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-primary">
                                  {spbNumber}
                                </span>
                                <span className="text-muted-foreground/50 hidden sm:inline">
                                  •
                                </span>
                                <span className="text-xs sm:text-sm font-bold text-foreground">
                                  {projectName} ({projectNumber})
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Customer:{" "}
                                <strong className="font-semibold text-foreground">
                                  {customerName}
                                </strong>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBatchApprovingVendorGroup(group);
                              }}
                              disabled={isApproving || isRejecting}
                              className="h-7 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/50 cursor-pointer px-2.5 shadow-none gap-1"
                              title="Setujui semua vendor untuk dokumen ini"
                            >
                              <CheckCheck className="w-3.5 h-3.5 mr-0.5 text-emerald-600 dark:text-emerald-400" />
                              Setujui Semua ({group.items.length})
                            </Button>
                            <span className="text-xs font-semibold text-muted-foreground bg-muted/30 px-2.5 py-0.5 rounded-full border border-border/50">
                              {group.items.length} Barang
                            </span>
                          </div>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="border-t border-border/40 bg-muted/5 p-3 sm:p-4 space-y-3 pb-4">
                        <div className="overflow-x-auto rounded-xl border border-border/60 bg-background shadow-2xs">
                          <table className="w-full text-left text-xs min-w-140">
                            <thead className="bg-muted/30 text-muted-foreground font-semibold border-b border-border/40">
                              <tr>
                                <th className="p-3 text-center w-10">No</th>
                                <th className="p-3">Material & Spesifikasi</th>
                                <th className="p-3 text-center">Qty</th>
                                <th className="p-3">Vendor Pilihan</th>
                                <th className="p-3 text-right">Harga Satuan</th>
                                <th className="p-3 text-right">
                                  Total Estimasi
                                </th>
                                <th className="p-3">Catatan</th>
                                <th className="p-3 text-center w-36">
                                  Aksi PM
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                              {group.items.map((item, itemIdx) => {
                                const unitPrice =
                                  Number(item.selectedCatalogPrice) || 0;
                                const totalPrice = (item.qty || 0) * unitPrice;

                                return (
                                  <tr
                                    key={item.id || itemIdx}
                                    className="hover:bg-muted/10 transition-colors"
                                  >
                                    <td className="p-3 text-center font-medium text-muted-foreground">
                                      {itemIdx + 1}
                                    </td>
                                    <td className="p-3">
                                      <div className="font-bold text-foreground text-xs">
                                        {item.name}
                                      </div>
                                      {item.typeMerk ? (
                                        <div className="text-[11px] text-muted-foreground font-normal mt-0.5">
                                          {item.typeMerk}
                                        </div>
                                      ) : null}
                                    </td>
                                    <td className="p-3 text-center font-semibold text-foreground whitespace-nowrap">
                                      {item.qty} {item.unit || "pcs"}
                                    </td>
                                    <td className="p-3">
                                      <span className="font-semibold text-primary text-xs">
                                        {item.selectedSupplierName || "-"}
                                      </span>
                                    </td>
                                    <td className="p-3 text-right font-medium text-foreground whitespace-nowrap">
                                      {unitPrice > 0
                                        ? formatRupiah(unitPrice)
                                        : "-"}
                                    </td>
                                    <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                      {totalPrice > 0
                                        ? formatRupiah(totalPrice)
                                        : "-"}
                                    </td>
                                    <td className="p-3 text-xs text-muted-foreground max-w-48">
                                      {item.vendorSelectionNote || "-"}
                                    </td>
                                    <td className="p-3 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setRejectingVendorItem({
                                              id: item.id,
                                              name: item.name,
                                              supplierName:
                                                item.selectedSupplierName ||
                                                "-",
                                              spbNumber: spbNumber,
                                            });
                                            setVendorRejectReason("");
                                          }}
                                          disabled={isApproving || isRejecting}
                                          className="h-7 text-[11px] font-bold rounded-lg border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 cursor-pointer px-2.5 shadow-none gap-1"
                                        >
                                          <X className="w-3.5 h-3.5 mr-1" />{" "}
                                          Tolak
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            setApprovingVendorItem({
                                              id: item.id,
                                              name: item.name,
                                              supplierName:
                                                item.selectedSupplierName ||
                                                "-",
                                              catalogPrice:
                                                item.selectedCatalogPrice,
                                              spbNumber: spbNumber,
                                            })
                                          }
                                          disabled={isApproving || isRejecting}
                                          className="h-7 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer px-2.5 shadow-none gap-1"
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
            </div>
          )}
        </TabsContent>

        {/* TAB 6: PERSETUJUAN QC PENERIMAAN BARANG (ACCENT: INDIGO) */}
        <TabsContent
          value="qc_receipt"
          className="space-y-4 m-0 border-0 p-0 outline-hidden"
        >
          {filteredQCReceipts.length === 0 ? (
            <Card className="rounded-xl border border-dashed p-8 text-center bg-card">
              <ShieldCheck className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">
                Tidak ada laporan QC PO yang menunggu persetujuan PM
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Semua hasil inspeksi barang kedatangan yang telah diverifikasi Engineering telah disetujui.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {paginatedQCReceipts.map((po: any) => {
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
                              Menunggu Approval Final PM
                            </Badge>
                            {po.qcApprovedByEngineering && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-400"
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                                Terverifikasi Engineering: {po.qcApprovedByEngineeringName || "Eng"}
                              </Badge>
                            )}
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
                            onClick={() => setPreviewQCPO(po)}
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
                              <TableHead>Status & Disposisi Engineering</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((it: any, idx: number) => {
                              const pQty = Number(it.qtyPassed) || 0;
                              const rQty = Number(it.qtyFailed) || 0;
                              const isFailed = rQty > 0;
                              const isUseAsIs = it.qcDisposition === "USE_AS_IS";
                              const isReturn = it.qcDisposition === "RETURN_TO_VENDOR";

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
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          {isUseAsIs ? (
                                            <Badge
                                              variant="outline"
                                              className="text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400"
                                            >
                                              ⚠️ Disetujui Digunakan (Use As-Is)
                                            </Badge>
                                          ) : isReturn ? (
                                            <Badge
                                              variant="outline"
                                              className="text-[10px] font-bold bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-400"
                                            >
                                              ✕ Dikembalikan (Retur)
                                            </Badge>
                                          ) : (
                                            <Badge
                                              variant="outline"
                                              className="text-[10px] font-bold bg-muted text-muted-foreground"
                                            >
                                              Menunggu Disposisi
                                            </Badge>
                                          )}
                                        </div>
                                        {it.qcDefectReason && (
                                          <p className="text-[10px] text-rose-600 font-medium">
                                            Cacat: {it.qcDefectReason}
                                          </p>
                                        )}
                                        {it.qcDispositionNotes && (
                                          <p className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold bg-amber-500/10 p-1 rounded">
                                            Justifikasi Eng: {it.qcDispositionNotes}
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Lolos Pengujian
                                      </span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Catatan QC & Engineering */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/60 text-xs">
                        <div>
                          <span className="text-[11px] font-bold text-foreground block mb-0.5">
                            Catatan QC Inspector:
                          </span>
                          <p className="text-[11px] text-muted-foreground">
                            {po.qcNotes || "Pemeriksaan fisik sesuai standar spesifikasi kedatangan barang."}
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-foreground block mb-0.5">
                            Catatan & Disposisi Engineering:
                          </span>
                          <p className="text-[11px] text-muted-foreground">
                            {po.qcEngineeringNotes || "Telah diverifikasi sesuai kelayakan teknis."}
                          </p>
                        </div>
                      </div>

                      {/* Catatan Project Manager */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">
                          Catatan Project Manager (Opsional):
                        </Label>
                        <Textarea
                          rows={2}
                          placeholder="Tulis catatan atau instruksi khusus untuk tim lapangan / gudang..."
                          value={pmQcNotes[po.id] || ""}
                          onChange={(e) =>
                            setPmQcNotes((prev) => ({
                              ...prev,
                              [po.id]: e.target.value,
                            }))
                          }
                          className="text-xs min-h-[44px] py-1.5"
                        />
                      </div>

                      {/* Tombol Aksi Approval PM */}
                      <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-3 flex-wrap">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setRejectQCState({
                              open: true,
                              poId: po.id,
                              poNumber: po.nomorPO,
                              reason: "",
                            })
                          }
                          disabled={isPending}
                          className="h-8 text-xs font-bold text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Kembalikan ke QC
                        </Button>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setApprovingQCPO(po)}
                            disabled={isPending}
                            className="h-8 text-xs font-bold px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-2xs cursor-pointer gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Setujui Final QC (Digital Sign)
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

      {/* MODAL APPROVAL KONFIRMASI VENDOR SELECTION (PM) */}
      <Dialog
        open={!!approvingVendorItem}
        onOpenChange={(open) => !open && setApprovingVendorItem(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-600" /> Persetujuan Vendor
              PO (PM)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Apakah Anda yakin ingin menyetujui pemilihan vendor berikut:
            </DialogDescription>
          </DialogHeader>

          {approvingVendorItem && (
            <div className="bg-muted/30 border border-border/60 rounded-xl p-3.5 space-y-2 text-xs my-2">
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
              disabled={isApproving}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleApproveVendorPmSubmit}
              disabled={isApproving}
              className="rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              {isApproving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Setujui"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL APPROVAL KONFIRMASI SEMUA VENDOR SELECTION (PM) */}
      <Dialog
        open={!!batchApprovingVendorGroup}
        onOpenChange={(open) => !open && setBatchApprovingVendorGroup(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-lg rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <CheckCheck className="w-5 h-5 text-emerald-600" /> Setujui Semua
              Vendor SPB (PM)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Apakah Anda yakin ingin menyetujui seluruh vendor terpilih untuk
              dokumen ini sekaligus?
            </DialogDescription>
          </DialogHeader>

          {batchApprovingVendorGroup && (
            <div className="space-y-3 my-2">
              <div className="bg-muted/30 border border-border/60 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nomor SPB:</span>
                  <span className="font-bold text-primary">
                    {batchApprovingVendorGroup.spb?.spbNumber || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Proyek:</span>
                  <span className="font-semibold text-foreground text-right">
                    {batchApprovingVendorGroup.project?.projectName || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jumlah Barang:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {batchApprovingVendorGroup.items?.length || 0} Barang
                  </span>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-background/50 divide-y divide-border/30">
                {batchApprovingVendorGroup.items?.map((it: any, idx: number) => (
                  <div key={it.id || idx} className="p-2.5 text-xs flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate">{it.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        Vendor: <strong className="text-primary font-medium">{it.selectedSupplierName || "-"}</strong>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-foreground">
                        {it.qty} {it.unit || "pcs"}
                      </div>
                      {it.selectedCatalogPrice ? (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          {formatRupiah(it.selectedCatalogPrice)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-row justify-end gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBatchApprovingVendorGroup(null)}
              disabled={isApproving}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleBatchApproveVendorPmSubmit}
              disabled={isApproving}
              className="rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              {isApproving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                `Setujui Semua (${batchApprovingVendorGroup?.items?.length || 0})`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL REJECTION VENDOR SELECTION (PM) */}
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
              disabled={isRejecting}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRejectVendorPmSubmit}
              disabled={isRejecting || !vendorRejectReason.trim()}
              className="rounded-lg text-xs font-bold cursor-pointer"
            >
              {isRejecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Tolak Vendor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL REJECTION QC RECEIPT (PM) */}
      <Dialog
        open={rejectQCState.open}
        onOpenChange={(open) =>
          !open && setRejectQCState((prev) => ({ ...prev, open: false }))
        }
      >
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <X className="w-5 h-5 text-destructive" /> Kembalikan Laporan QC
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              PO: <span className="font-semibold text-foreground">{rejectQCState.poNumber}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="py-3">
            <Textarea
              placeholder="Tulis alasan pengembalian / instruksi revisi untuk Inspector QC..."
              value={rejectQCState.reason}
              onChange={(e) =>
                setRejectQCState((prev) => ({ ...prev, reason: e.target.value }))
              }
              className="text-xs rounded-xl min-h-24 resize-none border-border/60"
            />
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setRejectQCState((prev) => ({ ...prev, open: false }))
              }
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmRejectQCPO}
              disabled={!rejectQCState.reason.trim()}
              className="rounded-lg text-xs font-bold cursor-pointer"
            >
              Kembalikan ke QC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL APPROVAL KONFIRMASI QC RECEIPT (PM) */}
      <Dialog
        open={!!approvingQCPO}
        onOpenChange={(open) => !open && setApprovingQCPO(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Persetujuan Final QC Penerimaan
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Apakah Anda yakin ingin menyetujui laporan pemeriksaan QC untuk PO berikut:
            </DialogDescription>
          </DialogHeader>

          {approvingQCPO && (
            <div className="bg-muted/30 border border-border/60 rounded-xl p-3.5 space-y-2 text-xs my-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nomor PO:</span>
                <span className="font-bold text-primary">{approvingQCPO.nomorPO}</span>
              </div>
              {approvingQCPO.qcReportNumber && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nomor Laporan QC:</span>
                  <span className="font-bold text-foreground font-mono">{approvingQCPO.qcReportNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Supplier:</span>
                <span className="font-semibold text-foreground text-right">{approvingQCPO.kepada || approvingQCPO.supplier?.name || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Proyek:</span>
                <span className="font-semibold text-foreground text-right">{approvingQCPO.projek || "Gudang"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Item:</span>
                <span className="font-bold text-foreground">{approvingQCPO.items?.length || 0} Barang</span>
              </div>
              {pmQcNotes[approvingQCPO.id] && (
                <div className="pt-1 border-t border-border/40">
                  <span className="text-muted-foreground block mb-0.5">Catatan PM:</span>
                  <span className="font-medium text-foreground italic">{pmQcNotes[approvingQCPO.id]}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-row justify-end gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApprovingQCPO(null)}
              disabled={isPending}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={() => approvingQCPO && handleApproveQCPO(approvingQCPO)}
              disabled={isPending}
              className="rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Setujui Final QC"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QC REPORT PDF PREVIEW DIALOG */}
      {previewQCPO && (
        <QCReceiptReportPreviewDialog
          open={!!previewQCPO}
          onOpenChange={(open) => !open && setPreviewQCPO(null)}
          purchaseOrder={previewQCPO}
        />
      )}
    </div>
  );
}
