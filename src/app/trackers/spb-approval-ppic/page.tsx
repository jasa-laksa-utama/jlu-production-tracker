import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { PpicSpbApprovalClient } from "./ppic-spb-approval-client";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Persetujuan SPB (PPIC) | PT. JLU Production",
  description:
    "Divisi PPIC menyetujui atau menolak Surat Permintaan Barang (SPB) dari divisi engineering.",
};

export default async function PpicSpbApprovalPage() {
  await requireAuth();

  // Fetch pending SPBs waiting for PPIC approval
  const pendingSpbs = await prisma.sPB.findMany({
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
  });

  // Fetch pending BoQs waiting for PPIC approval
  const pendingBoqs = await prisma.boQ.findMany({
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
  });

  // Convert dates and decimal fields to serialize correctly
  const serializedSpbs = JSON.parse(JSON.stringify(pendingSpbs));
  const serializedBoqs = JSON.parse(JSON.stringify(pendingBoqs));

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
              Review dan berikan persetujuan untuk dokumen SPB dan Bill of Quantities (BoQ).
            </p>
          </div>

          <PpicSpbApprovalClient initialSpbs={serializedSpbs} initialBoqs={serializedBoqs} />
        </main>
      </div>
    </div>
  );
}
