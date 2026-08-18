import { requireAuth } from "@/lib/auth-guard";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { EngineeringSpbApprovalClient } from "./engineering-spb-approval-client";
import { getPendingSPBSubstitutions } from "@/app/actions/spb";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Persetujuan Substitusi SPB (Engineering) | PT. JLU Production",
  description:
    "Engineering menyetujui atau menolak pengajuan substitusi spesifikasi barang pada Surat Permintaan Barang (SPB).",
};

export default async function EngineeringSpbApprovalPage() {
  await requireAuth();

  const pendingSubstitutionsRes = await getPendingSPBSubstitutions("ENGINEERING");

  const serializedSubstitutions = pendingSubstitutionsRes.success
    ? pendingSubstitutionsRes.data
    : [];

  return (
    <div className="flex w-full overflow-hidden bg-background h-screen">
      <AppSidebar />
      <div className="flex flex-col flex-1 w-full bg-background md:rounded-tl-xl md:border-l md:border-t border-border overflow-hidden md:m-2 md:ml-0 shadow-sm relative">
        <DashboardHeader />
        <main className="flex-1 w-full p-3 sm:p-6 pb-8 overflow-y-auto overflow-x-hidden space-y-4 sm:space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          <div className="flex flex-col gap-1 sm:gap-2">
            <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">
              Portal Persetujuan (Engineering)
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">
              Review dan berikan persetujuan untuk pengajuan substitusi spesifikasi barang SPB.
            </p>
          </div>

          <EngineeringSpbApprovalClient
            initialSubstitutions={serializedSubstitutions}
          />
        </main>
      </div>
    </div>
  );
}
