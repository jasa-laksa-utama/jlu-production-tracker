import { requireAuth } from "@/lib/auth-guard";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { EngineeringSpbApprovalClient } from "./engineering-spb-approval-client";
import { getPendingSPBSubstitutions } from "@/app/actions/spb";
import { getPendingQCReceiptsForEngineering } from "@/app/actions/qc-receipt-approval";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal Persetujuan (Engineering) | PT. JLU Production",
  description:
    "Engineering menyetujui pengajuan substitusi spesifikasi barang SPB dan verifikasi hasil pengujian QC Penerimaan Barang.",
};

export default async function EngineeringSpbApprovalPage() {
  await requireAuth();

  const [pendingSubstitutionsRes, pendingQCReceiptsRes] = await Promise.all([
    getPendingSPBSubstitutions("ENGINEERING"),
    getPendingQCReceiptsForEngineering(),
  ]);

  const serializedSubstitutions = pendingSubstitutionsRes.success
    ? pendingSubstitutionsRes.data
    : [];

  const serializedQCReceipts = pendingQCReceiptsRes.success
    ? pendingQCReceiptsRes.data
    : [];

  return (
    <div className="flex w-full overflow-hidden bg-background h-screen">
      <AppSidebar />
      <div className="flex flex-col flex-1 w-full bg-background md:rounded-tl-xl md:border-l md:border-t border-border overflow-hidden md:m-2 md:ml-0 shadow-sm relative">
        <DashboardHeader />
        <main className="flex-1 w-full px-4 sm:px-6 py-6 pb-8 overflow-y-auto overflow-x-hidden space-y-4 sm:space-y-6 max-w-full 2xl:max-w-[1920px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          <div className="flex flex-col gap-1 sm:gap-2">
            <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">
              Portal Persetujuan (Engineering)
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">
              Review dan berikan persetujuan untuk substitusi material SPB dan validasi pengujian QC Penerimaan Barang.
            </p>
          </div>

          <EngineeringSpbApprovalClient
            initialSubstitutions={serializedSubstitutions}
            initialQCReceipts={serializedQCReceipts}
          />
        </main>
      </div>
    </div>
  );
}
