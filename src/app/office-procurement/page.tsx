import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { getOfficeProcurementData } from "@/app/actions/office-procurement";
import { OfficeProcurementView } from "@/components/office/office-procurement-view";

export const metadata = {
  title: "Pengadaan Umum & Kantor | JLU Production Tracker",
  description:
    "Portal khusus Admin Kantor untuk BOQ Umum dan Pengajuan SPB Operasional Non-Proyek",
};

export default async function OfficeProcurementPage() {
  const session = await auth();
  if (
    !session ||
    !session.user ||
    (!session.user.id && !session.user.username)
  ) {
    redirect("/login?clear=true");
  }

  const result = await getOfficeProcurementData();

  const initialData = {
    metrics: result.metrics || {
      totalBoqs: 0,
      pendingSpbs: 0,
      approvedSpbs: 0,
      totalSpendEstimate: 0,
    },
    boqs: result.boqs || [],
    spbs: result.spbs || [],
  };

  return (
    <div className="flex w-full overflow-hidden bg-background h-screen">
      <AppSidebar />
      <div className="flex flex-col flex-1 w-full bg-background md:rounded-tl-xl md:border-l md:border-t border-border overflow-hidden md:m-2 md:ml-0 shadow-xs relative">
        <DashboardHeader />
        <main className="flex-1 w-full px-4 sm:px-6 py-6 pb-6 overflow-y-auto overflow-x-hidden space-y-6 max-w-full 2xl:max-w-[1920px] mx-auto">
          <OfficeProcurementView initialData={initialData} />
        </main>
      </div>
    </div>
  );
}
