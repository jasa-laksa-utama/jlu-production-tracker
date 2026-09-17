import { requireAuth } from "@/lib/auth-guard";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { DireksiSpbApprovalClient } from "@/app/trackers/spb-approval-direksi/direksi-spb-approval-client";
import {
  getPendingSPBForDireksi,
  getPendingSPBGudangForDireksi,
  getPendingSPBVendorSelection,
} from "@/app/actions/spb";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal Persetujuan (Direksi) | PT. JLU Production",
  description:
    "Direksi menentukan keputusan final persetujuan SPB Project, SPB Gudang, dan Vendor PO.",
};

export default async function DireksiSpbApprovalPage() {
  await requireAuth();

  const [pendingSpbsRes, pendingSpbGudangRes, pendingVendorItemsRes] =
    await Promise.all([
      getPendingSPBForDireksi(),
      getPendingSPBGudangForDireksi(),
      getPendingSPBVendorSelection("DIREKSI"),
    ]);

  const serializedSpbs = pendingSpbsRes.success ? pendingSpbsRes.data : [];
  const serializedSpbGudang = pendingSpbGudangRes.success
    ? pendingSpbGudangRes.data
    : [];
  const serializedVendorItems = pendingVendorItemsRes.success
    ? pendingVendorItemsRes.data
    : [];

  return (
    <div className="flex w-full overflow-hidden bg-background h-screen">
      <AppSidebar />
      <div className="flex flex-col flex-1 w-full bg-background md:rounded-tl-xl md:border-l md:border-t border-border overflow-hidden md:m-2 md:ml-0 shadow-sm relative">
        <DashboardHeader />
        <main className="flex-1 w-full px-4 sm:px-6 py-6 pb-8 overflow-y-auto overflow-x-hidden space-y-4 sm:space-y-6 max-w-full 2xl:max-w-[1920px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          <div className="flex flex-col gap-1 sm:gap-2">
            <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">
              Portal Persetujuan (Direksi)
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">
              Review dan berikan keputusan final persetujuan SPB Project, SPB Gudang, dan Vendor PO.
            </p>
          </div>

          <DireksiSpbApprovalClient
            initialSpbs={serializedSpbs}
            initialSpbGudang={serializedSpbGudang}
            initialVendorItems={serializedVendorItems}
          />
        </main>
      </div>
    </div>
  );
}
