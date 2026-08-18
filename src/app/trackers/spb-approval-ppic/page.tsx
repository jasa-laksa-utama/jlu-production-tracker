import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { PpicSpbApprovalClient } from "./ppic-spb-approval-client";
import {
  getPendingSPBSubstitutions,
  getPendingSPBGudangForPpic,
  getPendingSPBVendorSelection,
} from "@/app/actions/spb";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Persetujuan SPB (PPIC) | PT. JLU Production",
  description:
    "Divisi PPIC menyetujui atau menolak Surat Permintaan Barang (SPB Proyek & SPB Gudang) dan Persetujuan Vendor PO.",
};

export default async function PpicSpbApprovalPage() {
  await requireAuth();

  const [
    pendingSpbs,
    pendingBoqs,
    pendingSpjs,
    pendingMemos,
    pendingSubstitutionsRes,
    pendingSpbGudangRes,
    pendingVendorItemsRes,
    masterItems,
  ] = await Promise.all([
    prisma.sPB.findMany({
      where: {
        status: "PENDING_APPROVAL",
        approvedByPpic: false,
      },
      include: {
        project: {
          include: {
            customer: true,
          },
        },
        items: {
          include: {
            material: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.boQ.findMany({
      where: {
        boqStatus: "PENDING_APPROVAL",
        boqApprovedByPpic: false,
      },
      include: {
        project: {
          include: {
            customer: true,
          },
        },
        boqItems: {
          include: {
            item: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.sPJ.findMany({
      where: {
        status: "PENDING_APPROVAL",
        approvedByPpic: false,
      },
      include: {
        project: {
          include: {
            customer: true,
          },
        },
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.goodsReleaseMemo.findMany({
      where: {
        status: "PENDING",
      },
      include: {
        project: {
          include: {
            customer: true,
          },
        },
        items: true,
        returns: {
          include: {
            items: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    getPendingSPBSubstitutions("PPIC"),
    getPendingSPBGudangForPpic(),
    getPendingSPBVendorSelection("PPIC"),
    prisma.item.findMany({
      select: {
        id: true,
        code: true,
        name: true,
      },
    }),
  ]);

  // Convert dates and decimal fields to serialize correctly
  const serializedSpbs = JSON.parse(JSON.stringify(pendingSpbs));
  const serializedBoqs = JSON.parse(JSON.stringify(pendingBoqs));
  const serializedSpjs = JSON.parse(JSON.stringify(pendingSpjs));
  const serializedMemos = JSON.parse(JSON.stringify(pendingMemos));
  const serializedSubstitutions = pendingSubstitutionsRes.success ? pendingSubstitutionsRes.data : [];
  const serializedSpbGudang = pendingSpbGudangRes.success ? pendingSpbGudangRes.data : [];
  const serializedVendorItems = pendingVendorItemsRes.success ? pendingVendorItemsRes.data : [];
  const serializedMasterItems = JSON.parse(JSON.stringify(masterItems));

  return (
    <div className="flex w-full overflow-hidden bg-background h-screen">
      <AppSidebar />
      <div className="flex flex-col flex-1 w-full bg-background md:rounded-tl-xl md:border-l md:border-t border-border overflow-hidden md:m-2 md:ml-0 shadow-sm relative">
        <DashboardHeader />
        <main className="flex-1 w-full p-6 pb-8 overflow-y-auto overflow-x-hidden space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Portal Persetujuan (PPIC)
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              Review dan berikan persetujuan untuk dokumen SPB Proyek, SPB Gudang, Persetujuan Vendor PO, SPJ, BoQ, Memo Pengeluaran Barang, dan Substitusi Barang.
            </p>
          </div>

          <PpicSpbApprovalClient
            initialSpbs={serializedSpbs}
            initialBoqs={serializedBoqs}
            initialSpjs={serializedSpjs}
            initialMemos={serializedMemos}
            initialSubstitutions={serializedSubstitutions}
            initialSpbGudang={serializedSpbGudang}
            initialVendorItems={serializedVendorItems}
            masterItems={serializedMasterItems}
          />
        </main>
      </div>
    </div>
  );
}
