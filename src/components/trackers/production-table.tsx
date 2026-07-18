"use client";

import React, { useTransition, useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FolderOpen,
  FileText,
  History,
  MoreHorizontal,
  Settings,
  Users,
  User,
  Hammer,
  Wrench,
  Paintbrush,
  Layers,
  ArrowRight,
  Loader2,
  ClipboardList,
  Clock,
  Filter,
  ArrowUpDown,
  Trash2,
  X,
  Pencil,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { format, differenceInDays } from "date-fns";
import { ProjectDetailDialog } from "@/components/project-detail-dialog";
import { ProjectHistoryDialog } from "@/components/project-history-dialog";
import { DocumentManagerDialog } from "@/components/document-manager-dialog";
import { requestDrawingRevision } from "@/app/actions/projects";

// New Conveyor Masterplan components
import { MasterplanSetup } from "./masterplan-setup";
import { SCurveChart } from "./s-curve-chart";
import { StructureProgressTable } from "./structure-progress-table";
import { MechanicalProgressTable } from "./mechanical-progress-table";
import { SummaryProgressTable } from "./summary-progress-table";

// Import real backend server actions
import {
  startProduction,
  updateProductionStage,
  addComponentToProject,
  updateComponentStage,
  deleteComponent,
  excludeComponentStage,
  renameComponent,
  includeComponentStage,
} from "@/app/actions/production";
import { addConveyorUnitAfter } from "@/app/actions/conveyor-progress";

export const STAGE_STEPS: Record<string, string[]> = {
  Fabrikasi: ["Cutting", "Assembly", "Welding"],
  Machining: ["Lathe (Bubut)", "Milling (Frais)"],
  Mechanical: ["Assembly", "Alignment"],
  Finishing: ["Sandblasting", "Painting"],
};

export function getComponentStageStepLabel(
  stageName: string,
  progress: number,
  status?: string,
) {
  const steps = STAGE_STEPS[stageName];
  if (!steps) return `${progress}%`;

  if (status === "DONE" || progress >= 100) return "Done";
  if (status === "READY" || progress <= 0) return "Belum Mulai";

  const M = steps.length;
  let bestIndex = 0;
  let minDiff = 101;
  for (let i = 0; i <= M + 1; i++) {
    const targetProgress = Math.round((i / (M + 1)) * 100);
    const diff = Math.abs(targetProgress - progress);
    if (diff < minDiff) {
      minDiff = diff;
      bestIndex = i;
    }
  }

  if (bestIndex === 0) return "Belum Mulai";
  if (bestIndex === M + 1) return "Done";
  return steps[bestIndex - 1];
}

export function getClosestStepIndex(stageName: string, progress: number) {
  const steps = STAGE_STEPS[stageName] || [];
  const M = steps.length;
  let bestIndex = 0;
  let minDiff = 101;
  for (let i = 0; i <= M + 1; i++) {
    const targetProgress = Math.round((i / (M + 1)) * 100);
    const diff = Math.abs(targetProgress - progress);
    if (diff < minDiff) {
      minDiff = diff;
      bestIndex = i;
    }
  }
  return bestIndex;
}

const getStatusStyles = (status: string) => {
  switch (status) {
    case "DONE":
      return "bg-emerald-500/5 border-emerald-300/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10";
    case "IN_PROGRESS":
      return "bg-blue-500/5 border-blue-300/40 text-blue-800 dark:text-blue-300 hover:bg-blue-500/10";
    case "PAUSED":
      return "bg-amber-500/5 border-amber-300/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10";
    case "REVISION":
    case "REVISI":
      return "bg-red-500/5 border-red-300/40 text-red-800 dark:text-red-300 hover:bg-red-500/10 hover:border-red-400/50";
    default:
      return "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50";
  }
};

const getProgressBarColor = (status: string) => {
  switch (status) {
    case "DONE":
      return "bg-emerald-500";
    case "IN_PROGRESS":
      return "bg-blue-500";
    case "PAUSED":
      return "bg-amber-500";
    case "REVISION":
    case "REVISI":
      return "bg-red-500 animate-pulse";
    default:
      return "bg-muted-foreground/30";
  }
};

const getProjectStatusColor = (status: string) => {
  const s = status ? status.toUpperCase() : "";
  switch (s) {
    case "PENDING":
    case "WAITING_INVENTORY":
      return "bg-amber-500/10 text-amber-600 border-amber-200";
    case "IN_PROGRESS":
    case "ON_PROGRESS":
      return "bg-blue-500/10 text-blue-600 border-blue-200";
    case "READY":
    case "INVENTORY_READY":
    case "APPROVED":
    case "APPROVED_BY_PPIC":
    case "APPROVED_BY_CUSTOMER":
    case "DONE":
    case "COMPLETED":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
    case "REVISION":
    case "REVISION_TO_ENG":
    case "REJECTED":
      return "bg-red-500/10 text-red-600 border-red-200";
    default:
      return "bg-slate-500/10 text-slate-600 border-slate-200";
  }
};

const getProjectStatusLabel = (status: string) => {
  const s = status ? status.toUpperCase() : "";
  switch (s) {
    case "PENDING":
      return "Pending";
    case "WAITING_INVENTORY":
      return "Waiting Inventory";
    case "IN_PROGRESS":
    case "ON_PROGRESS":
      return "In Progress";
    case "READY":
      return "Ready";
    case "INVENTORY_READY":
      return "Inventory Ready";
    case "APPROVED":
      return "Approved";
    case "APPROVED_BY_PPIC":
      return "Approved by PPIC";
    case "APPROVED_BY_CUSTOMER":
      return "Approved by Customer";
    case "DONE":
    case "COMPLETED":
      return "Completed";
    case "REVISION":
      return "Revision";
    case "REVISION_TO_ENG":
      return "Revision to Eng";
    case "REJECTED":
      return "Rejected";
    default:
      return status ? status.replace(/_/g, " ") : "-";
  }
};

const formatDivision = (division?: string) => {
  if (!division) return "-";
  switch (division.toUpperCase()) {
    case "ENGINEERING":
      return "Engineering";
    case "PPIC":
      return "PPIC";
    case "INVENTORY":
      return "Inventory";
    case "PRODUCTION":
      return "Produksi";
    case "QUALITY_CONTROL":
      return "Quality Control";
    case "LOGISTIC":
      return "Logistik";
    default:
      return division.replace(/_/g, " ");
  }
};

export function ProductionTable({
  projects,
  meta,
  stats,
}: {
  projects: any[];
  meta?: { totalPages: number; totalCount: number; currentPage: number };
  stats: {
    totalActive: number;
    inProgress: number;
    review: number;
    approved: number;
  };
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Search parameters from URL
  const currentPage = Number(searchParams.get("page")) || 1;
  const currentLimit = Number(searchParams.get("limit")) || 10;
  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "ALL";
  const currentSort = searchParams.get("sort") || "desc";

  const [searchInput, setSearchInput] = useState(currentSearch);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Modals state
  const [timelineProject, setTimelineProject] = useState<any | null>(null);
  const [setupModalProject, setSetupModalProject] = useState<any | null>(null);
  const [stageModalData, setStageModalData] = useState<{
    project: any;
    stage: any;
  } | null>(null);
  const [confirmHandoverProject, setConfirmHandoverProject] = useState<
    any | null
  >(null);
  const [handoverNotes, setHandoverNotes] = useState("");

  // Sidebar detail dialogs
  const [viewDetailProject, setViewDetailProject] = useState<any | null>(null);
  const [historyProject, setHistoryProject] = useState<any | null>(null);

  // New Conveyor Masterplan view states
  const [conveyorTabs, setConveyorTabs] = useState<Record<string, string>>({});
  const [setupMasterplanProjectId, setSetupMasterplanProjectId] = useState<string | null>(null);

  // Add unit after setup states
  const [addUnitProjectId, setAddUnitProjectId] = useState<string | null>(null);
  const [addUnitName, setAddUnitName] = useState("");
  const [addUnitType, setAddUnitType] = useState<"BOTH" | "STRUCTURE" | "MECHANICAL">("BOTH");
  const [addUnitSatuan, setAddUnitSatuan] = useState("unit");
  const [addUnitVolume, setAddUnitVolume] = useState(1);
  const [addUnitStructureItems, setAddUnitStructureItems] = useState("");
  const [addUnitMechanicalItems, setAddUnitMechanicalItems] = useState("");
  const [isAddingUnitPending, startAddingUnitTransition] = useTransition();

  // Revision request states
  const [revisionProject, setRevisionProject] = useState<any | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [isPendingRevision, startRevisionTransition] = useTransition();

  // Setup form states
  const [drawingApproved, setDrawingApproved] = useState(false);
  const [drawingLink, setDrawingLink] = useState("");
  const [materialsReady, setMaterialsReady] = useState(false);
  const [materialsNotes, setMaterialsNotes] = useState("");
  const [instructionMemo, setInstructionMemo] = useState("");

  // Accordion state hooks for setup modal
  const [drawingAccordionOpen, setDrawingAccordionOpen] = useState(true);
  const [expandedSpbs, setExpandedSpbs] = useState<Record<string, boolean>>({});

  // Edit stage form states
  const [stageProgress, setStageProgress] = useState(0);
  const [stageStatus, setStageStatus] = useState<
    "READY" | "IN_PROGRESS" | "PAUSED" | "DONE" | "REVISION"
  >("READY");
  const [stageNotes, setStageNotes] = useState("");
  const [stageLeader, setStageLeader] = useState("");
  const [stageTeam, setStageTeam] = useState("");

  // Component tracking states
  const [setupComponents, setSetupComponents] = useState<string[]>([]);
  const [setupComponentInput, setSetupComponentInput] = useState("");
  const [isStartingProduction, setIsStartingProduction] = useState(false);
  const [addComponentModalProject, setAddComponentModalProject] = useState<
    any | null
  >(null);
  const [newComponentName, setNewComponentName] = useState("");
  const [newComponentStages, setNewComponentStages] = useState<string[]>([
    "Fabrikasi",
    "Machining",
    "Mechanical",
    "Finishing",
  ]);

  const [editCompStageData, setEditCompStageData] = useState<{
    comp: any;
    stage: any;
  } | null>(null);
  const [editCompProgress, setEditCompProgress] = useState(0);
  const [editCompStatus, setEditCompStatus] = useState<
    "READY" | "IN_PROGRESS" | "PAUSED" | "DONE" | "REVISION"
  >("READY");
  const [editCompNotes, setEditCompNotes] = useState("");
  const [editCompLeader, setEditCompLeader] = useState("");
  const [editCompTeam, setEditCompTeam] = useState("");
  const [confirmDeleteComponent, setConfirmDeleteComponent] = useState<
    any | null
  >(null);
  const [editComponentNameData, setEditComponentNameData] = useState<
    any | null
  >(null);
  const [editComponentNameInput, setEditComponentNameInput] = useState("");
  const [confirmExcludeStageData, setConfirmExcludeStageData] = useState<{
    comp: any;
    stage: any;
  } | null>(null);
  const [confirmIncludeStageData, setConfirmIncludeStageData] = useState<{
    comp: any;
    stageName: string;
  } | null>(null);

  const [isComponentPending, startComponentTransition] = useTransition();
  const [stageSubSteps, setStageSubSteps] = useState<any[]>([]);
  const [finishingWarning, setFinishingWarning] = useState<string | null>(null);

  const totalPages = meta?.totalPages || 1;
  const pageSize = currentLimit;

  // Query update helper
  function updateQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    if (!updates.page) params.set("page", "1");
    router.replace(`${pathname}?${params.toString()}`);
  }

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== currentSearch) {
        updateQuery({ search: searchInput });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const toggleRow = (projectId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const addSetupComponent = () => {
    if (setupComponentInput.trim()) {
      if (!setupComponents.includes(setupComponentInput.trim())) {
        setSetupComponents([...setupComponents, setupComponentInput.trim()]);
      } else {
        toast.warning("Komponen sudah terdaftar.");
      }
      setSetupComponentInput("");
    }
  };

  const removeSetupComponent = (index: number) => {
    setSetupComponents(setupComponents.filter((_, i) => i !== index));
  };

  // Start Production Submission
  const handleStartProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupModalProject) return;

    if (!drawingApproved || !materialsReady) {
      toast.warning(
        "Checklist Drawing dan Kesiapan Material utama harus dicentang!",
      );
      return;
    }

    if (!instructionMemo.trim()) {
      toast.warning("Instruksi dari Kepala Produksi (Pak Slamet) harus diisi!");
      return;
    }

    const projectId = setupModalProject.id;
    const parsedComponents = setupComponents;

    setIsStartingProduction(true);
    const toastId = toast.loading("Memulai persiapan produksi...");

    startTransition(async () => {
      const res = await startProduction(projectId, {
        drawingApproved,
        drawingLink: drawingLink || "",
        materialsReady,
        materialsNotes,
        instructionMemo,
        leader: "-",
        team: "-",
        components: parsedComponents,
      });

      setIsStartingProduction(false);

      if (res.success) {
        toast.success(
          `Proyek ${setupModalProject.projectName} siap diproduksi!`,
          { id: toastId },
        );
        setSetupModalProject(null);
        setExpandedRows((prev) => ({ ...prev, [projectId]: true }));
        router.refresh();
      } else {
        toast.error(res.error || "Gagal memulai produksi.", { id: toastId });
      }
    });
  };

  // Open Start Production Setup Dialog
  const openSetupModal = (project: any) => {
    setSetupComponents([]);
    setSetupComponentInput("");
    const setup = project.productionSetup;

    // De-duplicate and check drawings list to auto-populate approved status
    const allDocs = [
      ...(project?.documents || []),
      ...(project?.lead?.documents || []),
    ];
    const uniqueDocs = Array.from(
      new Map(allDocs.map((doc: any) => [doc.id, doc])).values(),
    );
    const drawings = uniqueDocs.filter(
      (doc: any) => doc.category?.toUpperCase() === "DRAWING",
    );

    setDrawingApproved(setup?.drawingApproved || drawings.length > 0 || false);
    setDrawingLink(setup?.drawingLink || drawings[0]?.url || "");
    setMaterialsReady(setup?.materialsReady || false);
    setMaterialsNotes(setup?.materialsNotes || "");
    setInstructionMemo(setup?.instructionMemo || "");

    // Reset accordions state
    setDrawingAccordionOpen(true);
    const initialExpanded: Record<string, boolean> = {};
    if (project.spb && project.spb.length > 0) {
      initialExpanded[project.spb[0].id] = true;
    }
    setExpandedSpbs(initialExpanded);

    setSetupModalProject(project);
  };

  const handleAddUnitSubmit = () => {
    if (!addUnitName.trim()) {
      toast.error("Nama unit tidak boleh kosong!");
      return;
    }
    if (!addUnitProjectId) return;

    startAddingUnitTransition(async () => {
      const structureList = addUnitStructureItems
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const mechanicalList = addUnitMechanicalItems
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const res = await addConveyorUnitAfter(addUnitProjectId, {
        name: addUnitName,
        unitType: addUnitType,
        satuan: addUnitSatuan,
        volume: addUnitVolume,
        structureItems: structureList,
        mechanicalItems: mechanicalList,
      });

      if (res.success) {
        toast.success("Unit conveyor baru berhasil ditambahkan!");
        setAddUnitProjectId(null);
        setAddUnitName("");
        setAddUnitType("BOTH");
        setAddUnitSatuan("unit");
        setAddUnitVolume(1);
        setAddUnitStructureItems("");
        setAddUnitMechanicalItems("");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menambahkan unit conveyor");
      }
    });
  };

  // Open Edit Stage Dialog
  const openStageModal = (project: any, stage: any) => {
    setStageProgress(stage.progress);
    setStageStatus(stage.status as any);
    setStageNotes(stage.notes || "");
    setStageLeader(stage.assignedLeader || "");
    setStageTeam(stage.assignedTeam || "");
    setStageSubSteps(JSON.parse(JSON.stringify(stage.subSteps || []))); // deep copy
    setFinishingWarning(null);
    setStageModalData({ project, stage });
  };

  // Save Stage progress changes with Finishing stage constraint validation
  const handleSaveStage = () => {
    if (!stageModalData) return;
    const { project, stage } = stageModalData;
    const projectId = project.id;

    // Strict validation constraint check
    if (stage.name === "Finishing") {
      const otherStagesIncomplete = project.productionStages
        .filter((s: any) => s.name !== "Finishing")
        .filter((s: any) => s.status !== "DONE" && s.progress < 100);

      if (
        otherStagesIncomplete.length > 0 &&
        (stageProgress > 0 ||
          stageStatus === "IN_PROGRESS" ||
          stageStatus === "DONE")
      ) {
        const names = otherStagesIncomplete.map((s: any) => s.name).join(", ");
        setFinishingWarning(
          `Tahap Finishing (Sandblasting & Painting) tidak dapat dimulai sebelum semua tahap fabrikasi, machining, dan mechanical selesai (100% / DONE). Tahapan yang belum selesai: [ ${names} ]`,
        );
        return;
      }
    }

    startTransition(async () => {
      const res = await updateProductionStage(projectId, stage.id, {
        progress: stageProgress,
        status: stageStatus,
        notes: stageNotes,
        assignedLeader: stageLeader,
        assignedTeam: stageTeam,
        subSteps: stageSubSteps.map((step) => ({
          id: step.id,
          checked: step.checked,
        })),
      });

      if (res.success) {
        toast.success(`Progress ${stage.name} berhasil diperbarui.`);
        setStageModalData(null);
        router.refresh();
      } else {
        toast.error(res.error || "Gagal memperbarui progress.");
      }
    });
  };

  const handleAddProjectComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addComponentModalProject) return;

    if (!newComponentName.trim()) {
      toast.warning("Nama komponen wajib diisi");
      return;
    }

    if (newComponentStages.length === 0) {
      toast.warning("Pilih minimal satu tahapan aktif");
      return;
    }

    startComponentTransition(async () => {
      const res = await addComponentToProject(
        addComponentModalProject.id,
        newComponentName,
        newComponentStages,
      );
      if (res.success) {
        toast.success(`Komponen "${newComponentName}" berhasil ditambahkan`);
        setNewComponentName("");
        setAddComponentModalProject(null);
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menambahkan komponen");
      }
    });
  };

  const handleUpdateComponentStageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCompStageData) return;

    const { stage } = editCompStageData;

    startComponentTransition(async () => {
      const res = await updateComponentStage(stage.id, {
        progress: editCompProgress,
        status: editCompStatus,
        notes: editCompNotes,
        assignedLeader: editCompLeader,
        assignedTeam: editCompTeam,
      });

      if (res.success) {
        toast.success(`Progress komponen berhasil diperbarui`);
        setEditCompStageData(null);
        router.refresh();
      } else {
        toast.error(res.error || "Gagal memperbarui progress komponen");
      }
    });
  };

  const handleDeleteComponentSubmit = async () => {
    if (!confirmDeleteComponent) return;

    startComponentTransition(async () => {
      const res = await deleteComponent(confirmDeleteComponent.id);
      if (res.success) {
        toast.success("Komponen berhasil dihapus");
        setConfirmDeleteComponent(null);
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menghapus komponen");
      }
    });
  };

  const handleRenameComponentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editComponentNameData || !editComponentNameInput.trim()) return;

    startComponentTransition(async () => {
      const res = await renameComponent(
        editComponentNameData.id,
        editComponentNameInput,
      );
      if (res.success) {
        toast.success("Nama komponen berhasil diubah");
        setEditComponentNameData(null);
        router.refresh();
      } else {
        toast.error(res.error || "Gagal mengubah nama komponen");
      }
    });
  };
  const handleExcludeStageSubmit = async () => {
    if (!confirmExcludeStageData) return;
    const { comp, stage } = confirmExcludeStageData;

    startComponentTransition(async () => {
      const res = await excludeComponentStage(stage.id);
      if (res.success) {
        toast.success(
          `Tahapan "${stage.name}" berhasil dihapus dari komponen.`,
        );
        setConfirmExcludeStageData(null);
        setEditCompStageData(null);
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menghapus tahapan komponen.");
      }
    });
  };

  const handleIncludeStageSubmit = async () => {
    if (!confirmIncludeStageData) return;
    const { comp, stageName } = confirmIncludeStageData;

    startComponentTransition(async () => {
      const res = await includeComponentStage(comp.id, stageName);
      if (res.success) {
        toast.success(
          `Tahapan "${stageName}" berhasil diaktifkan kembali untuk komponen "${comp.name}".`,
        );
        setConfirmIncludeStageData(null);
        router.refresh();
      } else {
        toast.error(res.error || "Gagal mengaktifkan kembali tahapan komponen.");
      }
    });
  };
  const openEditComponentStageModal = (comp: any, stage: any) => {
    setEditCompProgress(stage.progress);
    setEditCompStatus(stage.status);
    setEditCompNotes(stage.notes || "");
    setEditCompLeader(stage.assignedLeader || "");
    setEditCompTeam(stage.assignedTeam || "");
    setEditCompStageData({ comp, stage });
  };

  const handleDeleteComponentClick = (comp: any) => {
    setConfirmDeleteComponent(comp);
  };

  const handleRevisionSubmit = async () => {
    if (!revisionProject) return;
    startRevisionTransition(async () => {
      const res = await requestDrawingRevision(
        revisionProject.id,
        revisionNotes,
      );
      if (res.success) {
        toast.success(
          `Permintaan revisi drawing untuk proyek ${revisionProject.projectName} telah dikirim ke Engineering.`,
        );
        setRevisionProject(null);
        setRevisionNotes("");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal mengirim permintaan revisi.");
      }
    });
  };

  // Sub-step check handler
  const handleSubStepToggle = (index: number, checked: boolean) => {
    const newSubSteps = [...stageSubSteps];
    newSubSteps[index].checked = checked;
    setStageSubSteps(newSubSteps);

    // Auto recalculate progress based on sub-steps
    const checkedCount = newSubSteps.filter((s) => s.checked).length;
    const totalCount = newSubSteps.length;
    const autoProgress = Math.round((checkedCount / totalCount) * 100);
    setStageProgress(autoProgress);

    if (autoProgress === 100) {
      setStageStatus("DONE");
    } else if (autoProgress > 0) {
      setStageStatus("IN_PROGRESS");
    } else {
      setStageStatus("READY");
    }
  };

  // Average progress calculate helper
  const getOverallProgress = (project: any): number => {
    if (
      project.prodStatus === "PENDING" ||
      !project.productionStages ||
      project.productionStages.length === 0
    ) {
      return 0;
    }

    let totalProgress = 0;
    let stageCount = 0;

    project.productionStages.forEach((stage: any) => {
      totalProgress += stage.progress;
      stageCount++;
    });

    return stageCount > 0 ? Math.round(totalProgress / stageCount) : 0;
  };

  // Check if QC Handover is allowed (finishing stage must be DONE/100%)
  const isHandoverToQCAllowed = (project: any): boolean => {
    if (project.prodStatus !== "IN_PROGRESS" || !project.productionStages) {
      return false;
    }
    const finishing = project.productionStages?.find(
      (s: any) => s.name === "Finishing",
    );
    return (
      finishing && (finishing.status === "DONE" || finishing.progress === 100)
    );
  };

  // Get active stages based on IN_PROGRESS or PAUSED status, or partial progress
  const getActiveStages = (
    project: any,
  ): { name: string; status: string }[] => {
    if (project.prodStatus === "PENDING")
      return [{ name: "PENDING", status: "PENDING" }];
    if (project.prodStatus === "DONE")
      return [{ name: "DONE", status: "DONE" }];

    const active: { name: string; status: string }[] = [];
    project.productionStages?.forEach((stage: any) => {
      if (
        stage.status === "IN_PROGRESS" ||
        stage.status === "PAUSED" ||
        stage.status === "REVISION" ||
        (stage.progress > 0 && stage.progress < 100)
      ) {
        if (!active.some((a) => a.name === stage.name)) {
          active.push({ name: stage.name, status: stage.status });
        }
      }
    });

    return active;
  };

  // Get progress for Fabrikasi, Machining, Mechanical, Finishing OR masterplan phases
  const getStageAverageProgress = (
    project: any,
  ): { name: string; progress: number }[] => {
    // If project has masterplan, use dynamic phases
    if (project.masterplan?.phases && project.masterplan.phases.length > 0) {
      const sortedPhases = [...project.masterplan.phases].sort((a, b) => a.orderIndex - b.orderIndex);
      return sortedPhases.map((phase: any) => ({
        name: phase.name,
        progress: Math.round(phase.actualProgress || 0),
      }));
    }

    // Fallback to legacy production stages
    const stageSums: Record<string, { total: number; count: number }> = {
      Fabrikasi: { total: 0, count: 0 },
      Machining: { total: 0, count: 0 },
      Mechanical: { total: 0, count: 0 },
      Finishing: { total: 0, count: 0 },
    };

    project.productionStages?.forEach((stage: any) => {
      const name = stage.name;
      if (stageSums[name] !== undefined) {
        stageSums[name].total += stage.progress;
        stageSums[name].count += 1;
      }
    });

    return Object.keys(stageSums).map((name) => {
      const { total, count } = stageSums[name];
      const avg = count > 0 ? Math.round(total / count) : 0;
      return { name, progress: avg };
    });
  };

  return (
    <div className="space-y-6">
      {/* Filter & Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 md:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search Projects..."
              className="pl-9 w-full shadow-none bg-background rounded-md border-border h-9 text-sm"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-all active:scale-95"
                >
                  <Filter className="w-4 h-4" />
                  Filter
                  {(currentStatus !== "ALL" || currentSort !== "desc") && (
                    <Badge
                      variant="secondary"
                      className="ml-1 px-1 h-5 min-w-5 justify-center rounded-full bg-primary text-primary-foreground"
                    >
                      !
                    </Badge>
                  )}
                </Button>
              }
            />
            <PopoverContent className="w-80 p-4 space-y-4" align="end">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Status
                </label>
                <div className="flex flex-wrap gap-2">
                  {["ALL", "PENDING", "IN_PROGRESS", "DONE"].map((s) => (
                    <Button
                      key={s}
                      variant={currentStatus === s ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs px-2 cursor-pointer"
                      onClick={() => updateQuery({ status: s })}
                    >
                      {s === "ALL"
                        ? "All"
                        : s === "PENDING"
                          ? "Menunggu Persiapan"
                          : s === "IN_PROGRESS"
                            ? "Produksi Berjalan"
                            : s === "DONE"
                              ? "Selesai Produksi"
                              : s}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Urutan
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between h-9 cursor-pointer font-medium"
                  onClick={() =>
                    updateQuery({
                      sort: currentSort === "asc" ? "desc" : "asc",
                    })
                  }
                >
                  <span className="flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4" />
                    {currentSort === "desc"
                      ? "Terbaru Dahulu"
                      : "Terlama Dahulu"}
                  </span>
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs hover:bg-primary/90 bg-primary text-primary-foreground hover:text-primary-foreground h-8 cursor-pointer"
                onClick={() => {
                  setSearchInput("");
                  updateQuery({
                    status: "ALL",
                    sort: "desc",
                    search: "",
                  });
                }}
              >
                Reset Filters
              </Button>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-2 text-muted-foreground ml-1">
            <span className="text-xs">
              Results:{" "}
              <span className="font-semibold text-muted-foreground">
                {meta?.totalCount || 0}
              </span>{" "}
              projects
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-row items-center justify-between text-sm py-1 border-b border-border/40 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-xs whitespace-nowrap">Show:</span>
          <select
            value={currentLimit}
            onChange={(e) => updateQuery({ limit: e.target.value, page: "1" })}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 cursor-pointer"
            onClick={() => updateQuery({ page: String(currentPage - 1) })}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-muted-foreground mx-1 text-xs">
            Page{" "}
            <span className="font-medium text-muted-foreground">
              {currentPage}
            </span>{" "}
            of{" "}
            <span className="font-medium text-muted-foreground">
              {totalPages || 1}
            </span>
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 cursor-pointer"
            onClick={() => updateQuery({ page: String(currentPage + 1) })}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <div className="border border-border rounded-xl bg-card overflow-hidden shadow-xs relative">
        {isPending && (
          <div className="absolute inset-0 z-10 bg-background/40 backdrop-blur-[1px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}
        <Table>
          <TableHeader className="bg-muted/20 border-b border-border/80">
            <TableRow className="border-border hover:bg-transparent text-sm font-bold">
              <TableHead className="w-[50px] text-center font-medium">
                No.
              </TableHead>
              <TableHead className="min-w-[200px] font-medium">
                Project & Customer
              </TableHead>
              <TableHead className="font-medium">Timeline</TableHead>
              <TableHead className="font-medium">Status Produksi</TableHead>
              <TableHead className="font-medium">Project Status</TableHead>
              <TableHead className="font-medium">Progress Produksi</TableHead>
              <TableHead className="font-medium text-center">
                Document Hub
              </TableHead>
              <TableHead className="w-[80px] text-right font-medium">
                Aksi
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center h-48 text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2 opacity-50">
                    <ClipboardList className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      Tidak ada proyek produksi yang ditemukan
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project, index) => {
                const isExpanded = !!expandedRows[project.id];
                const totalRunningDays = project.startDate
                  ? differenceInDays(new Date(), new Date(project.startDate))
                  : 0;

                const isHandoverAllowed = isHandoverToQCAllowed(project);

                return (
                  <React.Fragment key={project.id}>
                    <TableRow
                      className={cn(
                        "border-border/60 transition-colors group cursor-pointer",
                        isExpanded && "bg-muted/10",
                      )}
                      onClick={() => toggleRow(project.id)}
                    >
                      <TableCell
                        className="text-center text-muted-foreground text-xs font-mono font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(currentPage - 1) * pageSize + index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {project.projectNumber && (
                            <span className="text-xs text-primary font-semibold">
                              {project.projectNumber}
                            </span>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                              {project.projectName}
                            </span>
                            {project.engStatus === "REVISION_TO_ENG" && (
                              <Badge
                                variant="outline"
                                className="bg-rose-500/10 text-rose-600 border-rose-200/60 font-bold text-[9px] px-1.5 py-0 animate-pulse shrink-0"
                              >
                                Revisi Drawing
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <span className="font-semibold text-foreground/70">
                              {project.customer?.company ||
                                project.customer?.name}
                            </span>
                            {project.customer?.company && (
                              <>
                                <span className="opacity-30">•</span>
                                <span>{project.customer?.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setTimelineProject(project)}
                          className="flex flex-col text-left hover:text-primary transition-colors cursor-pointer group/timeline border-none bg-transparent"
                        >
                          <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-primary shrink-0 group-hover/timeline:animate-pulse" />
                            {totalRunningDays} Hari
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            Deadline:{" "}
                            {project.expectedDate
                              ? format(
                                  new Date(project.expectedDate),
                                  "dd MMM yy",
                                )
                              : "-"}
                          </span>
                        </button>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1.5 max-w-[150px]">
                          {project.prodStatus === "PENDING" ? (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/50 font-bold text-[10px] flex items-center gap-1 w-fit"
                            >
                              <AlertCircle className="w-3 h-3" /> Menunggu
                              Persiapan
                            </Badge>
                          ) : project.prodStatus === "DONE" ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 font-bold text-[10px] flex items-center gap-1 w-fit"
                            >
                              <CheckCircle2 className="w-3 h-3" />{" "}
                              {project.qcStatus === "APPROVED" ||
                              (project.productionStages &&
                                project.productionStages.length > 0 &&
                                project.productionStages.every(
                                  (s: any) => s.qcStatus === "APPROVED",
                                ))
                                ? "Lolos QC (Selesai)"
                                : "Selesai Produksi"}
                            </Badge>
                          ) : (
                            (() => {
                              const activeStages = getActiveStages(project);
                              const avgProgress = getOverallProgress(project);
                              if (avgProgress === 100) {
                                return (
                                  <Badge
                                    variant="outline"
                                    className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 font-bold text-[10px] flex items-center gap-1 w-fit"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />{" "}
                                    {project.qcStatus === "APPROVED" ||
                                    (project.productionStages &&
                                      project.productionStages.length > 0 &&
                                      project.productionStages.every(
                                        (s: any) => s.qcStatus === "APPROVED",
                                      ))
                                      ? "Lolos QC (Selesai)"
                                      : "Selesai Produksi"}
                                  </Badge>
                                );
                              }
                              if (activeStages.length === 0) {
                                return (
                                  <Badge
                                    variant="outline"
                                    className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-200/50 font-bold text-[10px] flex items-center gap-1 w-fit"
                                  >
                                    <Clock className="w-3 h-3" /> Persiapan
                                  </Badge>
                                );
                              }
                              return activeStages.map((actStage) => {
                                const stageName = actStage.name;
                                const isRevision =
                                  actStage.status === "REVISION";
                                let icon = <Layers className="w-3 h-3" />;
                                let colorClass =
                                  "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200/50";
                                if (isRevision) {
                                  icon = (
                                    <AlertTriangle className="w-3 h-3 text-red-500 animate-bounce" />
                                  );
                                  colorClass =
                                    "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/50 font-extrabold animate-pulse";
                                } else if (stageName === "Fabrikasi") {
                                  icon = <Hammer className="w-3 h-3" />;
                                  colorClass =
                                    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/50";
                                } else if (stageName === "Machining") {
                                  icon = <Settings className="w-3 h-3" />;
                                  colorClass =
                                    "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200/50";
                                } else if (stageName === "Mechanical") {
                                  icon = <Wrench className="w-3 h-3" />;
                                  colorClass =
                                    "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200/50";
                                } else if (stageName === "Finishing") {
                                  icon = <Paintbrush className="w-3 h-3" />;
                                  colorClass =
                                    "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200/50";
                                }
                                return (
                                  <Badge
                                    key={stageName}
                                    variant="outline"
                                    className={cn(
                                      "font-bold text-[10px] flex items-center gap-1 w-fit",
                                      colorClass,
                                    )}
                                  >
                                    {icon} {stageName}{" "}
                                    {isRevision && "(REVISI)"}
                                  </Badge>
                                );
                              });
                            })()
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-1">
                          <div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-medium text-[11px] px-2 py-0.5",
                                getProjectStatusColor(
                                  project.currentStatus ||
                                    project.status ||
                                    "PENDING",
                                ),
                              )}
                            >
                              {getProjectStatusLabel(
                                project.currentStatus ||
                                  project.status ||
                                  "PENDING",
                              )}
                            </Badge>
                          </div>
                          {project.currentDivision && (
                            <span className="text-[10px] text-muted-foreground font-medium">
                              Divisi: {formatDivision(project.currentDivision)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {project.prodStatus === "PENDING" ? (
                          <span className="text-xs text-muted-foreground font-medium">
                            -
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1 text-[11px] min-w-[180px] max-w-[220px]">
                            {getStageAverageProgress(project).map((sa) => (
                              <div
                                key={sa.name}
                                className="flex items-center justify-between gap-3 border-b border-border/20 pb-0.5"
                              >
                                <span className="text-muted-foreground font-medium text-left truncate max-w-[170px]" title={sa.name}>
                                  {sa.name}
                                </span>
                                <span className="font-bold text-foreground font-mono shrink-0">
                                  {sa.progress}%
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell
                        className="text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DocumentManagerDialog
                          ownerId={project.id}
                          ownerType="PROJECT"
                          leadId={project.leadId}
                          categories={[
                            "BRIEF",
                            "DRAWING",
                            "BOQ",
                            "MECH_PART_LIST",
                            "SPB",
                            "PRODUCTION",
                            "QC",
                            "OTHER",
                          ]}
                          globalDriveUrl={project.globalDriveUrl}
                          onUploadSuccess={() => router.refresh()}
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="relative h-8 px-2 gap-1.5 border border-border/30 bg-background/50 hover:bg-muted font-medium"
                            >
                              <FolderOpen className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs">
                                {project.documentCount || 0}
                              </span>
                              {project.hasRevisedDocs && (
                                <span className="absolute top-0 right-0 -mt-1 flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                              )}
                            </Button>
                          }
                        />
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 rounded-lg"
                            onClick={() => toggleRow(project.id)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="h-8 w-8 rounded-lg"
                                >
                                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                className="text-xs font-medium"
                                onClick={() => setViewDetailProject(project)}
                              >
                                <FileText className="w-4 h-4 mr-2" /> View
                                Project Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-xs font-medium"
                                onClick={() => setHistoryProject(project)}
                              >
                                <History className="w-4 h-4 mr-2" /> View Logs
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              {project.prodStatus === "PENDING" && (
                                <>
                                  <DropdownMenuItem
                                    className="text-xs font-semibold text-amber-600 focus:text-amber-600 focus:bg-amber-50 dark:focus:bg-amber-950/20"
                                    onClick={() => openSetupModal(project)}
                                  >
                                    <Play className="w-4 h-4 mr-2" /> Persiapan
                                    Produksi
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}

                              <DropdownMenuItem
                                className={cn(
                                  "text-xs font-semibold text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20 cursor-pointer",
                                  (project.engStatus === "REVISION_TO_ENG" ||
                                    project.prodStatus === "DONE") &&
                                    "opacity-50 pointer-events-none",
                                )}
                                disabled={
                                  project.engStatus === "REVISION_TO_ENG" ||
                                  project.prodStatus === "DONE"
                                }
                                onClick={() => setRevisionProject(project)}
                              >
                                <AlertTriangle className="w-4 h-4 mr-2" /> Minta
                                Revisi Drawing
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expandable Section: Production Stages Progress */}
                    {isExpanded && (
                      <TableRow className="bg-muted/10 border-t-0 hover:bg-muted/10">
                        <TableCell colSpan={8} className="p-0">
                          <div className="p-6 border-t border-border/40 bg-muted/20 animate-in fade-in duration-300 slide-in-from-top-2">
                            {setupMasterplanProjectId === project.id ? (
                              <div className="space-y-4 w-full">
                                <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border/80 shadow-xs">
                                  <span className="text-xs font-bold text-muted-foreground">Setup Masterplan Mode</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSetupMasterplanProjectId(null)}
                                    className="h-8 text-xs font-semibold px-3 rounded-lg hover:bg-destructive/5 text-destructive cursor-pointer"
                                  >
                                    Batalkan Setup
                                  </Button>
                                </div>
                                <MasterplanSetup project={project} onSuccess={() => { setSetupMasterplanProjectId(null); router.refresh(); }} />
                              </div>
                            ) : project.masterplan ? (
                              // Conveyor Masterplan view
                              <div className="space-y-6">
                                {/* Tab Header Navigation */}
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card p-4 rounded-xl border border-border/80 gap-4 shadow-xs">
                                  <div className="flex flex-wrap gap-2">
                                    {[
                                      { id: "s-curve", label: "S-Curve Chart" },
                                      { id: "structure", label: "Fabrikasi Struktur" },
                                      { id: "mechanical", label: "Mekanikal" },
                                      { id: "summary", label: "Rekap Progress" },
                                      { id: "tim-memo", label: "Tim & Memo" }
                                    ].map((tab) => {
                                      const activeTab = conveyorTabs[project.id] || "s-curve";
                                      const isActive = activeTab === tab.id;
                                      return (
                                        <Button
                                          key={tab.id}
                                          variant={isActive ? "default" : "outline"}
                                          size="sm"
                                          onClick={() => setConveyorTabs(prev => ({ ...prev, [project.id]: tab.id }))}
                                          className="h-8 rounded-lg text-xs font-semibold shadow-none cursor-pointer"
                                        >
                                          {tab.label}
                                        </Button>
                                      );
                                    })}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={() => setAddUnitProjectId(project.id)}
                                      className="h-8 text-xs font-semibold px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer flex items-center gap-1 border-none shadow-sm"
                                    >
                                      <Plus className="w-3.5 h-3.5" /> Unit Conveyor
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSetupMasterplanProjectId(project.id)}
                                      className="h-8 text-xs font-semibold px-3 rounded-lg shadow-none hover:bg-primary/5 hover:text-primary cursor-pointer"
                                    >
                                      Re-Setup Masterplan
                                    </Button>
                                  </div>
                                </div>

                                {/* Active Tab Contents */}
                                {(() => {
                                  const activeTab = conveyorTabs[project.id] || "s-curve";
                                  if (activeTab === "s-curve") {
                                    return <SCurveChart data={project.masterplan.weeklyPlans} />;
                                  }
                                  if (activeTab === "structure") {
                                    return <StructureProgressTable units={project.conveyorUnits} />;
                                  }
                                  if (activeTab === "mechanical") {
                                    return <MechanicalProgressTable units={project.conveyorUnits} />;
                                  }
                                  if (activeTab === "summary") {
                                    return <SummaryProgressTable project={project} masterplan={project.masterplan} units={project.conveyorUnits} />;
                                  }
                                  // Default: tim-memo view
                                  return (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-card border border-border/80 p-6 rounded-xl shadow-xs">
                                      <div className="space-y-4">
                                        <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5 border-b pb-2">
                                          Tim & Leader Divisi
                                        </h4>
                                        <div className="space-y-2 text-xs">
                                          {project.masterplan.divisionLeaders.map((dl: any) => (
                                            <div key={dl.id} className="flex justify-between items-center py-1.5 border-b border-border/40">
                                              <span className="font-semibold text-muted-foreground uppercase">{dl.divisionName}</span>
                                              <span className="font-bold text-foreground">{dl.leaderName}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="space-y-4">
                                        <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5 border-b pb-2">
                                          Instruksi & Memo Lapangan
                                        </h4>
                                        <div className="bg-muted/30 p-4 rounded-xl border text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                          {project.productionSetup?.instructionMemo || "Tidak ada memo instruksi lapangan."}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : project.prodStatus === "PENDING" ? (
                              <div className="flex flex-col items-center justify-center py-8 bg-card border border-border/80 rounded-xl shadow-xs max-w-lg mx-auto text-center p-6 gap-4">
                                <div className="p-3 bg-amber-500/10 rounded-full text-amber-600 border border-amber-200/50">
                                  <Play className="w-6 h-6 animate-pulse" />
                                </div>
                                <div className="space-y-1">
                                  <h4 className="font-bold text-base text-foreground">
                                    Produksi Belum Dimulai
                                  </h4>
                                  <p className="text-xs text-muted-foreground max-w-sm text-wrap">
                                    Sebelum pengerjaan dimulai, silakan atur Masterplan Proyek atau gunakan formulir inisialisasi default.
                                  </p>
                                </div>
                                <div className="flex gap-3">
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="cursor-pointer font-bold text-xs bg-amber-600 hover:bg-amber-700 shadow-xs rounded-lg"
                                    onClick={() => setSetupMasterplanProjectId(project.id)}
                                  >
                                    Setup Masterplan Conveyor
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-8 bg-card border border-border/80 rounded-xl shadow-xs max-w-lg mx-auto text-center p-6 gap-4">
                                <div className="p-3 bg-amber-500/10 rounded-full text-amber-600 border border-amber-200/50">
                                  <Layers className="w-6 h-6 animate-pulse" />
                                </div>
                                <div className="space-y-1">
                                  <h4 className="font-bold text-base text-foreground">
                                    Masterplan Belum Terkonfigurasi
                                  </h4>
                                  <p className="text-xs text-muted-foreground max-w-sm text-wrap">
                                    Silakan konfigurasi Masterplan Conveyor untuk memulai pelacakan kemajuan proyek ini.
                                  </p>
                                </div>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="cursor-pointer font-bold text-xs bg-amber-600 hover:bg-amber-700 shadow-xs rounded-lg"
                                  onClick={() => setSetupMasterplanProjectId(project.id)}
                                >
                                  Setup Masterplan Conveyor
                                </Button>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Persiapan & Validasi Produksi Modal */}
      <Dialog
        open={!!setupModalProject}
        onOpenChange={(open) => !open && setSetupModalProject(null)}
      >
        <DialogContent className="sm:max-w-[850px] md:max-w-[900px] w-full max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-600" />
              Persiapan & Validasi Produksi
            </DialogTitle>
            <DialogDescription>
              Pastikan dokumen Drawing, Material, Daftar Komponen dan Instruksi
              sudah disiapkan untuk proyek{" "}
              <strong className="font-medium text-foreground">
                {setupModalProject?.projectName}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleStartProduction}
            className="space-y-4 py-2 text-sm"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left Column (Drawing & SPB) */}
              <div className="md:col-span-7 space-y-4">
                {/* Checklist 1: Drawing Accordion */}
                <div className="border rounded-lg bg-muted/10 overflow-hidden">
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer select-none hover:bg-muted/20 transition-colors"
                    onClick={() =>
                      setDrawingAccordionOpen(!drawingAccordionOpen)
                    }
                  >
                    <div
                      className="flex items-center space-x-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        id="drawingApproved"
                        checked={drawingApproved}
                        className="border border-gray-500"
                        onCheckedChange={(checked) =>
                          setDrawingApproved(!!checked)
                        }
                      />
                      <Label
                        htmlFor="drawingApproved"
                        className="font-semibold text-xs cursor-pointer"
                      >
                        1. Drawing Final Disetujui (Engineering & Customer)
                      </Label>
                    </div>
                    {drawingAccordionOpen ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  {drawingAccordionOpen && (
                    <div className="p-3 pt-0 border-t border-border/40 space-y-1.5 pl-9 bg-card/50">
                      {(() => {
                        const allDocs = [
                          ...(setupModalProject?.documents || []),
                          ...(setupModalProject?.lead?.documents || []),
                        ];
                        // De-duplicate documents by id
                        const uniqueDocs = Array.from(
                          new Map(
                            allDocs.map((doc: any) => [doc.id, doc]),
                          ).values(),
                        );
                        const projectDrawings = uniqueDocs.filter(
                          (doc: any) =>
                            doc.category?.toUpperCase() === "DRAWING",
                        );

                        if (projectDrawings.length === 0) {
                          return (
                            <div className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-200/40 p-2.5 rounded-md flex flex-col gap-1">
                              <span className="font-semibold text-wrap">
                                Belum ada file Gambar (Drawing) di Document Hub
                                proyek ini.
                              </span>
                              <span className="text-[10px] text-muted-foreground text-wrap">
                                Silakan upload gambar teknis terlebih dahulu di
                                tombol Berkas (Document Hub) di baris proyek.
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                            {projectDrawings.map((doc: any) => (
                              <div
                                key={doc.id}
                                className="bg-background border rounded-md p-2 text-[11px] flex justify-between items-center gap-2"
                              >
                                <span className="font-semibold text-foreground truncate">
                                  {doc.fileName || doc.name || "File Gambar"} (v
                                  {doc.version || 1})
                                </span>
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline font-bold shrink-0"
                                >
                                  Buka ↗
                                </a>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Checklist 2: Material & SPB Accordions */}
                <div className="border rounded-lg bg-muted/10 overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b border-border/40 bg-muted/5">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="materialsReady"
                        checked={materialsReady}
                        className="border border-gray-500"
                        onCheckedChange={(checked) =>
                          setMaterialsReady(!!checked)
                        }
                      />
                      <Label
                        htmlFor="materialsReady"
                        className="font-semibold text-xs cursor-pointer"
                      >
                        2. Material Utama Ready / Selesai SPB
                      </Label>
                    </div>
                  </div>

                  <div className="p-3 space-y-3 pl-9">
                    {/* SPB Accordions list */}
                    {!setupModalProject?.spb ||
                    setupModalProject.spb.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        Belum ada pengajuan SPB untuk proyek ini.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {setupModalProject.spb.map((spb: any) => {
                          const isSpbExpanded = !!expandedSpbs[spb.id];
                          return (
                            <div
                              key={spb.id}
                              className="bg-card border rounded-md overflow-hidden text-[11px]"
                            >
                              {/* SPB Accordion Header */}
                              <div
                                className="bg-muted/30 px-2.5 py-2 flex justify-between items-center cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() =>
                                  setExpandedSpbs((prev) => ({
                                    ...prev,
                                    [spb.id]: !prev[spb.id],
                                  }))
                                }
                              >
                                <div className="flex flex-col">
                                  <span className="font-bold text-primary">
                                    {spb.spbNumber}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground font-mono">
                                    {format(new Date(spb.date), "dd MMM yyyy")}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {isSpbExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                  )}
                                </div>
                              </div>

                              {/* SPB Accordion Content */}
                              {isSpbExpanded && (
                                <div className="p-2 divide-y divide-border/40 bg-background">
                                  {spb.items?.map((item: any) => (
                                    <div
                                      key={item.id}
                                      className="py-1.5 flex justify-between items-center gap-2 text-[10px]"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-foreground truncate">
                                          {item.name}
                                        </p>
                                        <p className="text-[9px] text-muted-foreground">
                                          Sumber: {item.source}{" "}
                                          {item.typeMerk
                                            ? `(${item.typeMerk})`
                                            : ""}
                                        </p>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <p className="font-bold text-foreground">
                                          {item.qty} {item.unit}
                                        </p>
                                        <span
                                          className={cn(
                                            "text-[8px] font-bold px-1 py-0.5 rounded-xs border inline-block mt-0.5 font-mono uppercase",
                                            item.status === "FULFILLED" ||
                                              item.status === "RECEIVED"
                                              ? "bg-emerald-500/5 text-emerald-600 border-emerald-500/10"
                                              : item.status === "REJECTED"
                                                ? "bg-red-500/5 text-red-600 border-red-500/10"
                                                : "bg-amber-500/5 text-amber-600 border-amber-500/10",
                                          )}
                                        >
                                          {item.status === "FULFILLED"
                                            ? "TERPENUHI"
                                            : item.status === "RECEIVED"
                                              ? "DITERIMA"
                                              : item.status === "PENDING"
                                                ? "PENDING"
                                                : item.status ===
                                                    "APPROVED_WAREHOUSE"
                                                  ? "DISETUJUI GUDANG"
                                                  : item.status === "PO_PENDING"
                                                    ? "MENUNGGU PO"
                                                    : item.status ===
                                                        "PO_CREATED"
                                                      ? "PO DIBUAT"
                                                      : item.status}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Catatan Material */}
                    <div className="space-y-1">
                      <Label
                        htmlFor="materialsNotes"
                        className="text-[11px] text-muted-foreground block font-medium"
                      >
                        Catatan Material (Kekurangan, SPB status)
                      </Label>
                      <Textarea
                        id="materialsNotes"
                        placeholder="Catat status spb item jika ada yang belum terpenuhi..."
                        value={materialsNotes}
                        onChange={(e) => setMaterialsNotes(e.target.value)}
                        className="text-xs bg-background min-h-[60px] resize-y"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column (Memo / Instruction Memo & Components) */}
              <div className="md:col-span-5 flex flex-col justify-between gap-4">
                <div className="space-y-4 flex flex-col h-full">
                  {/* Daftar Komponen Awal (Opsional) */}
                  <div className="space-y-2 border border-border/80 rounded-xl p-3.5 bg-muted/10">
                    <Label className="font-semibold text-xs text-foreground block">
                      Daftar Komponen Awal (Opsional)
                    </Label>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      Masukkan nama komponen satu per satu (misal: Main Shaft,
                      Frame, Roller). Komponen lain bisa ditambahkan menyusul
                      saat produksi berjalan.
                    </p>

                    <div className="flex gap-1.5 mt-1.5">
                      <Input
                        placeholder="Masukkan nama komponen..."
                        value={setupComponentInput}
                        onChange={(e) => setSetupComponentInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addSetupComponent();
                          }
                        }}
                        className="text-xs h-8 shadow-none bg-background border-border/80 focus-visible:ring-primary"
                      />
                      <Button
                        type="button"
                        onClick={addSetupComponent}
                        className="h-8 text-xs font-semibold cursor-pointer shrink-0 bg-primary hover:bg-primary/95 text-primary-foreground"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Tambah
                      </Button>
                    </div>

                    {/* Added Components List */}
                    <div className="mt-2 space-y-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground">
                        Komponen Terdaftar ({setupComponents.length}):
                      </span>
                      {setupComponents.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground/60 italic pl-1">
                          Belum ada komponen awal (bisa ditambahkan nanti).
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-background/50 rounded border border-dashed border-border/60">
                          {setupComponents.map((comp, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-[10px] font-semibold flex items-center gap-1 bg-muted border border-border/80 pr-1.5 py-0.5"
                            >
                              <span>{comp}</span>
                              <button
                                type="button"
                                onClick={() => removeSetupComponent(idx)}
                                className="text-muted-foreground hover:text-rose-600 rounded-full cursor-pointer focus:outline-hidden"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Memo / Instruction Memo */}
                  <div className="space-y-1.5 flex-1 flex flex-col">
                    <Label
                      htmlFor="instructionMemo"
                      className="font-semibold text-xs text-foreground"
                    >
                      3. Instruksi / Memo Lapangan{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="instructionMemo"
                      placeholder="Tulis instruksi khusus pengerjaan conveyor di lapangan..."
                      value={instructionMemo}
                      onChange={(e) => setInstructionMemo(e.target.value)}
                      className="text-xs flex-1 min-h-[150px] resize-y"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSetupModalProject(null)}
                className="cursor-pointer text-xs h-8"
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="default"
                size="sm"
                disabled={isStartingProduction}
                className="cursor-pointer text-xs h-8 bg-amber-600 hover:bg-amber-700 font-bold shadow-xs flex items-center gap-1.5"
              >
                {isStartingProduction && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-0.5" />
                )}
                Mulai Produksi
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Detail Stage Status & Progress Modal (Read-Only) */}
      <Dialog
        open={!!stageModalData}
        onOpenChange={(open) => !open && setStageModalData(null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-base">
              <Hammer className="w-5 h-5 text-primary" />
              Detail Tahap: {stageModalData?.stage.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Proyek:{" "}
              <span className="font-semibold text-foreground">
                {stageModalData?.project.projectName}
              </span>
            </DialogDescription>
          </DialogHeader>

          {stageModalData && (
            <div className="space-y-4 py-2 text-xs">
              {/* Summary Stage Panel */}
              <div className="bg-muted/30 border rounded-xl p-3.5 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-muted-foreground font-medium block">
                      Progress Rata-rata
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden border">
                        <div
                          className={cn(
                            "h-full transition-all",
                            getProgressBarColor(stageModalData.stage.status),
                          )}
                          style={{ width: `${stageModalData.stage.progress}%` }}
                        />
                      </div>
                      <span className="font-bold font-mono text-sm shrink-0">
                        {stageModalData.stage.progress}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground font-medium block">
                      Status Tahap
                    </span>
                    <Badge
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5",
                        getStatusStyles(stageModalData.stage.status),
                      )}
                    >
                      {stageModalData.stage.status === "REVISION"
                        ? "REVISI"
                        : stageModalData.stage.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1 border-t border-border/50">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium block">
                      Leader Pelaksana
                    </span>
                    <span className="font-semibold text-foreground truncate block">
                      {stageModalData.stage.assignedLeader || "-"}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium block">
                      Team Lapangan
                    </span>
                    <span className="font-semibold text-foreground truncate block">
                      {stageModalData.stage.assignedTeam || "-"}
                    </span>
                  </div>
                </div>

                {stageModalData.stage.notes && (
                  <div className="pt-2 border-t border-border/50 space-y-0.5">
                    <span className="text-muted-foreground font-medium block">
                      Catatan Lapangan
                    </span>
                    <p className="text-foreground italic bg-background/50 p-2 rounded-md border font-mono">
                      "{stageModalData.stage.notes}"
                    </p>
                  </div>
                )}
              </div>

              {/* Components List Section */}
              <div className="space-y-2">
                <div className="flex justify-between items-center px-0.5">
                  <Label className="text-xs font-bold text-foreground">
                    Pelacakan Progress Komponen
                  </Label>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {(() => {
                      const comps = stageModalData.project.components || [];
                      const passing = comps.filter((comp: any) =>
                        comp.stages.some(
                          (s: any) => s.name === stageModalData.stage.name,
                        ),
                      );
                      return `${passing.length} Komponen`;
                    })()}
                  </span>
                </div>

                <div className="border rounded-xl bg-card overflow-hidden max-h-60 overflow-y-auto divide-y divide-border/60">
                  {(() => {
                    const comps = stageModalData.project.components || [];
                    const passing = comps.filter((comp: any) =>
                      comp.stages.some(
                        (s: any) => s.name === stageModalData.stage.name,
                      ),
                    );

                    if (passing.length === 0) {
                      return (
                        <div className="text-center p-6 text-muted-foreground text-xs">
                          Tidak ada komponen untuk tahapan ini.
                        </div>
                      );
                    }

                    return passing.map((comp: any) => {
                      const cStage = comp.stages.find(
                        (s: any) => s.name === stageModalData.stage.name,
                      );
                      if (!cStage) return null;

                      const qcBadgeColor =
                        cStage.qcStatus === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-800 border-emerald-200/50"
                          : cStage.qcStatus === "REJECTED"
                            ? "bg-rose-500/10 text-rose-800 border-rose-200/50"
                            : "bg-amber-500/10 text-amber-800 border-amber-200/50";

                      return (
                        <div
                          key={comp.id}
                          className="p-2.5 flex items-center justify-between gap-4 hover:bg-muted/5"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <span className="font-bold text-foreground truncate block">
                              {comp.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5">
                              Step:{" "}
                              <span className="text-foreground font-semibold">
                                {getComponentStageStepLabel(
                                  stageModalData.stage.name,
                                  cStage.progress,
                                  cStage.status,
                                )}
                              </span>
                              <span className="opacity-40">|</span>
                              <span>{cStage.progress}%</span>
                            </span>
                            {(cStage.assignedLeader || cStage.assignedTeam) && (
                              <div className="text-[9px] text-muted-foreground/80 mt-0.5 flex flex-wrap gap-1.5 font-medium">
                                {cStage.assignedLeader && (
                                  <span>
                                    Ldr:{" "}
                                    <strong className="text-foreground/80">
                                      {cStage.assignedLeader}
                                    </strong>
                                  </span>
                                )}
                                {cStage.assignedLeader &&
                                  cStage.assignedTeam && (
                                    <span className="opacity-45">|</span>
                                  )}
                                {cStage.assignedTeam && (
                                  <span>
                                    Tim:{" "}
                                    <strong className="text-foreground/80">
                                      {cStage.assignedTeam}
                                    </strong>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              className={cn(
                                "text-[9px] font-bold px-1.5 py-0",
                                getStatusStyles(cStage.status),
                              )}
                            >
                              {cStage.status === "REVISION"
                                ? "REVISI"
                                : cStage.status}
                            </Badge>

                            <Badge
                              className={cn(
                                "text-[9px] font-bold border px-1.5 py-0",
                                qcBadgeColor,
                              )}
                            >
                              {cStage.qcStatus === "APPROVED"
                                ? "Lolos QC"
                                : cStage.qcStatus === "REJECTED"
                                  ? "Revisi QC"
                                  : "Menunggu QC"}
                            </Badge>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStageModalData(null)}
              className="cursor-pointer text-xs h-8 ml-auto"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Timeline Dialog */}

      {/* Project Timeline Dialog */}
      <Dialog
        open={!!timelineProject}
        onOpenChange={(open) => !open && setTimelineProject(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Timeline Proyek
            </DialogTitle>
            <DialogDescription>
              Detail jadwal dan perjalanan waktu proyek{" "}
              <strong className="text-foreground">
                {timelineProject?.projectName}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>
          {timelineProject &&
            (() => {
              const startDate = timelineProject.startDate
                ? new Date(timelineProject.startDate)
                : null;
              const expectedDate = timelineProject.expectedDate
                ? new Date(timelineProject.expectedDate)
                : null;
              const productionStartedDate = timelineProject.productionSetup
                ?.startedAt
                ? new Date(timelineProject.productionSetup.startedAt)
                : timelineProject.productionSetup?.createdAt
                  ? new Date(timelineProject.productionSetup.createdAt)
                  : null;

              const prodHistoryEntry = timelineProject.history?.find(
                (h: any) => h.division === "PRODUCTION",
              );
              const handoverToProductionDate = prodHistoryEntry
                ? new Date(prodHistoryEntry.entryDate)
                : null;

              const daysSinceDeal = startDate
                ? differenceInDays(new Date(), startDate)
                : 0;

              const daysToDeadline = expectedDate
                ? differenceInDays(expectedDate, new Date())
                : null;

              return (
                <div className="space-y-4 py-3 text-xs">
                  <div className="relative border-l-2 border-primary/20 pl-5 space-y-5 ml-2.5">
                    {/* Step 1: Deal */}
                    <div className="relative">
                      <div className="absolute -left-[27px] top-0.5 bg-primary text-primary-foreground rounded-full p-1 border-2 border-background">
                        <CheckCircle2 className="w-3.5 h-3.5 text-background fill-primary" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground">
                          Kesepakatan Deal (SO Created)
                        </h4>
                        <p className="text-muted-foreground mt-0.5">
                          {startDate ? format(startDate, "dd MMMM yyyy") : "-"}
                        </p>
                        <p className="text-[10px] text-primary font-semibold mt-1">
                          Berjalan selama {daysSinceDeal} Hari sejak deal
                        </p>
                      </div>
                    </div>

                    {/* Step 2: Handover to Production */}
                    <div className="relative">
                      <div className="absolute -left-[27px] top-0.5 bg-primary text-primary-foreground rounded-full p-1 border-2 border-background">
                        <CheckCircle2 className="w-3.5 h-3.5 text-background fill-primary" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground">
                          Diserahkan ke Produksi (Handover PPIC)
                        </h4>
                        <p className="text-muted-foreground mt-0.5">
                          {handoverToProductionDate
                            ? format(
                                handoverToProductionDate,
                                "dd MMMM yyyy HH:mm",
                              )
                            : "Menunggu Handover dari PPIC"}
                        </p>
                      </div>
                    </div>

                    {/* Step 3: Production Entry (Started) */}
                    <div className="relative">
                      <div
                        className={cn(
                          "absolute -left-[27px] top-0.5 rounded-full p-1 border-2 border-background",
                          productionStartedDate
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground border-muted",
                        )}
                      >
                        <Play
                          className={cn(
                            "w-3.5 h-3.5",
                            productionStartedDate
                              ? "text-background fill-primary"
                              : "text-muted-foreground",
                          )}
                        />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground">
                          Mulai Pengerjaan Fisik (Mulai Produksi)
                        </h4>
                        <p className="text-muted-foreground mt-0.5">
                          {productionStartedDate
                            ? format(
                                productionStartedDate,
                                "dd MMMM yyyy HH:mm",
                              )
                            : "Belum mulai (Menunggu checklist & alokasi tim oleh leader)"}
                        </p>
                      </div>
                    </div>

                    {/* Step 3: Deadline */}
                    <div className="relative">
                      <div className="absolute -left-[27px] top-0.5 bg-red-500 text-white rounded-full p-1 border-2 border-background">
                        <AlertCircle className="w-3.5 h-3.5 text-background fill-red-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground">
                          Target Deadline Pelanggan
                        </h4>
                        <p className="text-muted-foreground mt-0.5">
                          {expectedDate
                            ? format(expectedDate, "dd MMMM yyyy")
                            : "-"}
                        </p>
                        {daysToDeadline !== null && (
                          <p
                            className={cn(
                              "text-[10px] font-semibold mt-1",
                              daysToDeadline < 0
                                ? "text-red-500"
                                : daysToDeadline <= 7
                                  ? "text-orange-500"
                                  : "text-green-600",
                            )}
                          >
                            {daysToDeadline < 0
                              ? `Terlambat ${Math.abs(daysToDeadline)} hari`
                              : `Sisa waktu ${daysToDeadline} hari lagi`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTimelineProject(null)}
              className="cursor-pointer text-xs h-8"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Drawing Revision Dialog */}
      <Dialog
        open={!!revisionProject}
        onOpenChange={(open) => {
          if (!open) {
            setRevisionProject(null);
            setRevisionNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-sm font-bold text-rose-600">
              <AlertTriangle className="w-4 h-4" />
              Minta Revisi Drawing
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ajukan permintaan revisi gambar kerja ke tim Engineering untuk
              proyek{" "}
              <strong className="text-foreground">
                {revisionProject?.projectName}
              </strong>
              . Proyek akan ditandai sedang revisi, namun tetap dapat diakses di
              dashboard ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1">
              <Label
                htmlFor="revisionNotes"
                className="font-medium text-foreground"
              >
                Catatan Revisi / Detail Kesalahan
              </Label>
              <Textarea
                id="revisionNotes"
                placeholder="Jelaskan bagian gambar mana yang salah atau perlu direvisi..."
                className="min-h-[100px] text-xs resize-y"
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRevisionProject(null);
                setRevisionNotes("");
              }}
              disabled={isPendingRevision}
              className="text-xs h-8 cursor-pointer"
            >
              Batal
            </Button>
            <Button
              onClick={handleRevisionSubmit}
              disabled={isPendingRevision || !revisionNotes.trim()}
              className="text-xs h-8 bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs cursor-pointer"
            >
              {isPendingRevision && (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              )}
              Kirim ke Engineering
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Tambah Komponen */}
      <Dialog
        open={!!addComponentModalProject}
        onOpenChange={(open) => !open && setAddComponentModalProject(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Tambah Komponen Baru
            </DialogTitle>
            <DialogDescription>
              Masukkan nama komponen dan tentukan tahapan sub-produksi yang
              wajib dilewati.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddProjectComponent} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="compName" className="text-xs font-semibold">
                Nama Komponen
              </Label>
              <Input
                id="compName"
                placeholder="Contoh: Roller Driven, Main Shaft"
                value={newComponentName}
                onChange={(e) => setNewComponentName(e.target.value)}
                disabled={isComponentPending}
                className="text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                Tahapan Sub-Produksi Aktif
              </Label>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {["Fabrikasi", "Machining", "Mechanical", "Finishing"].map(
                  (stage) => {
                    const isChecked = newComponentStages.includes(stage);
                    return (
                      <div
                        key={stage}
                        className="flex items-center space-x-2 border rounded-md p-2.5 bg-background hover:bg-muted/10"
                      >
                        <Checkbox
                          id={`stage-${stage}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNewComponentStages([
                                ...newComponentStages,
                                stage,
                              ]);
                            } else {
                              setNewComponentStages(
                                newComponentStages.filter((s) => s !== stage),
                              );
                            }
                          }}
                          disabled={isComponentPending}
                        />
                        <Label
                          htmlFor={`stage-${stage}`}
                          className="text-xs font-medium cursor-pointer"
                        >
                          {stage}
                        </Label>
                      </div>
                    );
                  },
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAddComponentModalProject(null);
                  setNewComponentName("");
                }}
                disabled={isComponentPending}
                className="text-xs h-8 cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isComponentPending || !newComponentName.trim()}
                className="text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xs cursor-pointer"
              >
                {isComponentPending && (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                )}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Edit Progress Komponen Stage */}
      <Dialog
        open={!!editCompStageData}
        onOpenChange={(open) => !open && setEditCompStageData(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Update Progress Komponen
            </DialogTitle>
            <DialogDescription>
              Perbarui progress pengerjaan komponen{" "}
              <strong className="text-foreground">
                "{editCompStageData?.comp?.name}"
              </strong>{" "}
              untuk tahap{" "}
              <strong className="text-primary">
                {editCompStageData?.stage?.name}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleUpdateComponentStageSubmit}
            className="space-y-4 pt-2"
          >
            {(() => {
              if (!editCompStageData) return null;
              const stageName = editCompStageData.stage.name;
              const steps = STAGE_STEPS[stageName] || [];
              const M = steps.length;

              // We construct the list of status steps
              const stepOptions = [
                { label: "Belum Mulai", progress: 0, defaultStatus: "READY" },
                ...steps.map((sName, index) => {
                  const idx = index + 1;
                  const prog = Math.round((idx / (M + 1)) * 100);
                  return {
                    label: sName,
                    progress: prog,
                    defaultStatus: "IN_PROGRESS",
                  };
                }),
                {
                  label: "Done / Selesai",
                  progress: 100,
                  defaultStatus: "DONE",
                },
              ];

              const currentIdx = getClosestStepIndex(
                stageName,
                editCompProgress,
              );

              return (
                <>
                  {/* Warning if under revision */}
                  {(editCompStageData.stage.status === "REVISION" ||
                    editCompStageData.stage.qcStatus === "REJECTED") && (
                    <div className="bg-rose-500/10 border border-rose-200/40 rounded-lg p-2.5 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2 mb-1 shadow-xs">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                      <div>
                        <p className="font-semibold">Perlu Revisi dari QC</p>
                        {editCompStageData.stage.qcNotes && (
                          <p className="text-[10px] opacity-90 mt-0.5 font-mono italic">
                            Catatan QC: "{editCompStageData.stage.qcNotes}"
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step Selector Dropdown */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="stepSelector"
                      className="text-xs font-semibold text-foreground"
                    >
                      Langkah Pengerjaan Fisik
                    </Label>
                    <select
                      id="stepSelector"
                      value={String(currentIdx)}
                      disabled={isComponentPending}
                      onChange={(e) => {
                        const idx = parseInt(e.target.value, 10);
                        const opt = stepOptions[idx];
                        if (!opt) return;
                        setEditCompProgress(opt.progress);
                        if (editCompStatus === "PAUSED") {
                          // Keep status as PAUSED
                        } else {
                          setEditCompStatus(opt.defaultStatus as any);
                        }
                      }}
                      className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
                    >
                      {stepOptions.map((opt, i) => (
                        <option key={i} value={String(i)}>
                          {opt.label} ({opt.progress}%)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Leader and Team Inputs */}
                  <div className="grid grid-cols-2 gap-3 mt-1.5">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="compLeader"
                        className="text-xs font-semibold text-foreground"
                      >
                        Leader Pelaksana
                      </Label>
                      <Input
                        id="compLeader"
                        placeholder="Nama Leader"
                        value={editCompLeader}
                        onChange={(e) => setEditCompLeader(e.target.value)}
                        disabled={isComponentPending}
                        className="h-8 text-xs bg-background font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="compTeam"
                        className="text-xs font-semibold text-foreground"
                      >
                        Team Lapangan
                      </Label>
                      <Input
                        id="compTeam"
                        placeholder="Anggota Tim"
                        value={editCompTeam}
                        onChange={(e) => setEditCompTeam(e.target.value)}
                        disabled={isComponentPending}
                        className="h-8 text-xs bg-background font-medium"
                      />
                    </div>
                  </div>

                  {/* Pause Switch Toggle */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-dashed bg-muted/5 mt-2">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="pauseToggle"
                        className="text-xs font-semibold cursor-pointer"
                      >
                        Ditunda (Paused)
                      </Label>
                      <p className="text-[10px] text-muted-foreground">
                        Tangguhkan pengerjaan komponen ini sementara waktu.
                      </p>
                    </div>
                    <Checkbox
                      id="pauseToggle"
                      checked={editCompStatus === "PAUSED"}
                      disabled={isComponentPending}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEditCompStatus("PAUSED");
                        } else {
                          const opt = stepOptions[currentIdx] || stepOptions[0];
                          setEditCompStatus(opt.defaultStatus as any);
                        }
                      }}
                      className="h-4 w-4 border-gray-400"
                    />
                  </div>
                </>
              );
            })()}

            <div className="space-y-2">
              <Label
                htmlFor="compNotes"
                className="text-xs font-semibold text-foreground"
              >
                Catatan Operator
              </Label>
              <Textarea
                id="compNotes"
                placeholder="Masukkan catatan kendala atau rincian pekerjaan..."
                value={editCompNotes}
                onChange={(e) => setEditCompNotes(e.target.value)}
                disabled={isComponentPending}
                className="text-xs h-16"
              />
            </div>

            <DialogFooter className="pt-4 border-t mt-4 flex flex-row items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (editCompStageData) {
                    setConfirmExcludeStageData({
                      comp: editCompStageData.comp,
                      stage: editCompStageData.stage,
                    });
                  }
                }}
                disabled={isComponentPending}
                className="text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 cursor-pointer mr-auto shrink-0"
              >
                Exclude Tahap
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditCompStageData(null)}
                  disabled={isComponentPending}
                  className="text-xs h-8 cursor-pointer"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isComponentPending}
                  className="text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xs cursor-pointer"
                >
                  {isComponentPending && (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  )}
                  Simpan Progress
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Edit Nama Komponen */}
      <Dialog
        open={!!editComponentNameData}
        onOpenChange={(open) => !open && setEditComponentNameData(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Edit Nama Komponen
            </DialogTitle>
            <DialogDescription>
              Ubah nama komponen dari{" "}
              <strong className="text-foreground">
                "{editComponentNameData?.name}"
              </strong>
              .
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleRenameComponentSubmit}
            className="space-y-4 pt-2"
          >
            <div className="space-y-1.5">
              <Label
                htmlFor="editCompNameInput"
                className="text-xs font-semibold text-foreground"
              >
                Nama Komponen Baru
              </Label>
              <Input
                id="editCompNameInput"
                value={editComponentNameInput}
                onChange={(e) => setEditComponentNameInput(e.target.value)}
                disabled={isComponentPending}
                required
                className="h-9 text-xs font-medium"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditComponentNameData(null)}
                disabled={isComponentPending}
                className="text-xs h-8 cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isComponentPending}
                className="text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xs cursor-pointer"
              >
                {isComponentPending && (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                )}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Hapus Komponen */}
      <Dialog
        open={!!confirmDeleteComponent}
        onOpenChange={(open) => !open && setConfirmDeleteComponent(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              Hapus Komponen?
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus komponen{" "}
              <strong className="text-foreground">
                "{confirmDeleteComponent?.name}"
              </strong>
              ? Tindakan ini tidak dapat dibatalkan dan semua data progress
              sub-produksi komponen ini akan dihapus permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmDeleteComponent(null)}
              disabled={isComponentPending}
              className="text-xs h-8 cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleDeleteComponentSubmit}
              disabled={isComponentPending}
              className="text-xs h-8 font-bold shadow-xs cursor-pointer"
            >
              {isComponentPending && (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              )}
              Ya, Hapus Komponen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Exclude Tahap */}
      <Dialog
        open={!!confirmExcludeStageData}
        onOpenChange={(open) => !open && setConfirmExcludeStageData(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              Exclude Tahapan?
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin mengecualikan/menghapus tahapan{" "}
              <strong className="text-foreground">
                "{confirmExcludeStageData?.stage?.name}"
              </strong>{" "}
              dari komponen{" "}
              <strong className="text-foreground">
                "{confirmExcludeStageData?.comp?.name}"
              </strong>
              ? Progress rata-rata proyek akan disesuaikan secara otomatis.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmExcludeStageData(null)}
              disabled={isComponentPending}
              className="text-xs h-8 cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleExcludeStageSubmit}
              disabled={isComponentPending}
              className="text-xs h-8 font-bold shadow-xs cursor-pointer"
            >
              {isComponentPending && (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              )}
              Ya, Exclude Tahap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Include Tahap */}
      <Dialog
        open={!!confirmIncludeStageData}
        onOpenChange={(open) => !open && setConfirmIncludeStageData(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Plus className="w-5 h-5" />
              Aktifkan Tahapan Kembali?
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin mengaktifkan kembali tahapan{" "}
              <strong className="text-foreground">
                "{confirmIncludeStageData?.stageName}"
              </strong>{" "}
              untuk komponen{" "}
              <strong className="text-foreground">
                "{confirmIncludeStageData?.comp?.name}"
              </strong>
              ? Progress tahapan ini akan diatur ulang menjadi 0% (Belum Mulai).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmIncludeStageData(null)}
              disabled={isComponentPending}
              className="text-xs h-8 cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleIncludeStageSubmit}
              disabled={isComponentPending}
              className="text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xs cursor-pointer"
            >
              {isComponentPending && (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              )}
              Ya, Aktifkan Kembali
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Tambah Unit Conveyor Baru (Quick Action) */}
      <Dialog
        open={!!addUnitProjectId}
        onOpenChange={(open) => {
          if (!open) {
            setAddUnitProjectId(null);
            setAddUnitName("");
            setAddUnitType("BOTH");
            setAddUnitSatuan("unit");
            setAddUnitVolume(1);
            setAddUnitStructureItems("");
            setAddUnitMechanicalItems("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[550px] rounded-2xl border-border/80">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary font-bold text-base">
              <Plus className="w-5 h-5 text-emerald-600" />
              Tambah Unit Conveyor Baru
            </DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan informasi Unit Conveyor tambahan untuk ditambahkan ke Masterplan proyek ini secara langsung.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Nama Unit Conveyor</Label>
              <Input
                type="text"
                placeholder="Contoh: Belt Conveyor BC 04 - BW 1.0 x L.12 Mtr"
                value={addUnitName}
                onChange={(e) => setAddUnitName(e.target.value)}
                className="h-9 rounded-xl text-xs bg-background/50 focus:bg-background"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Tipe Unit</Label>
                <select
                  value={addUnitType}
                  onChange={(e: any) => setAddUnitType(e.target.value)}
                  className="flex h-9 w-full rounded-xl border border-input bg-background/50 px-3 text-xs shadow-none transition-all placeholder:text-muted-foreground focus-visible:outline-hidden focus:outline-hidden focus:ring-1 focus:ring-ring"
                >
                  <option value="BOTH">Struktur & Mekanikal</option>
                  <option value="STRUCTURE">Hanya Struktur</option>
                  <option value="MECHANICAL">Hanya Mekanikal</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Satuan</Label>
                <Input
                  type="text"
                  placeholder="unit"
                  value={addUnitSatuan}
                  onChange={(e) => setAddUnitSatuan(e.target.value)}
                  className="h-9 rounded-xl text-xs text-center bg-background/50 focus:bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Volume</Label>
                <Input
                  type="number"
                  min={1}
                  value={addUnitVolume}
                  onChange={(e) => setAddUnitVolume(Number(e.target.value))}
                  className="h-9 rounded-xl text-xs text-center bg-background/50 focus:bg-background"
                />
              </div>
            </div>

            {addUnitType !== "MECHANICAL" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">
                  Checklist Pekerjaan Struktur (Opsional)
                </Label>
                <Textarea
                  placeholder="Masukkan item, pisahkan dengan koma atau baris baru. E.g.:&#10;Stringer Frame&#10;Support Trestle&#10;Head Chute"
                  value={addUnitStructureItems}
                  onChange={(e) => setAddUnitStructureItems(e.target.value)}
                  rows={3}
                  className="rounded-xl text-xs bg-background/50 focus:bg-background"
                />
              </div>
            )}

            {addUnitType !== "STRUCTURE" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">
                  Checklist Pekerjaan Mekanikal (Opsional)
                </Label>
                <Textarea
                  placeholder="Masukkan item, pisahkan dengan koma atau baris baru. E.g.:&#10;Drive Pulley&#10;Snub Pulley&#10;Roller Carry&#10;Impact Roller"
                  value={addUnitMechanicalItems}
                  onChange={(e) => setAddUnitMechanicalItems(e.target.value)}
                  rows={3}
                  className="rounded-xl text-xs bg-background/50 focus:bg-background"
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setAddUnitProjectId(null);
                setAddUnitName("");
                setAddUnitType("BOTH");
                setAddUnitSatuan("unit");
                setAddUnitVolume(1);
                setAddUnitStructureItems("");
                setAddUnitMechanicalItems("");
              }}
              disabled={isAddingUnitPending}
              className="text-xs h-9 px-4 rounded-xl cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddUnitSubmit}
              disabled={isAddingUnitPending}
              className="text-xs h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm cursor-pointer"
            >
              {isAddingUnitPending && (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              )}
              Simpan Unit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Detail Dialog */}
      <ProjectDetailDialog
        data={viewDetailProject}
        open={!!viewDetailProject}
        onOpenChange={(open) => !open && setViewDetailProject(null)}
        type="PROJECT"
        showValue={false}
      />

      {/* Project Logs DB Dialog */}
      <ProjectHistoryDialog
        project={historyProject}
        open={!!historyProject}
        onOpenChange={(open) => !open && setHistoryProject(null)}
      />
    </div>
  );
}
