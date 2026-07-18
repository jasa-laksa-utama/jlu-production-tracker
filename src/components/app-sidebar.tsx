"use client";

import * as React from "react";
import {
  Search,
  Settings,
  HelpCircle,
  MoreHorizontal,
  LayoutDashboard,
  Truck,
  ClipboardCheck,
  Factory,
  Box,
  ShoppingCart,
  UserCheck,
  HardHat,
  Contact2,
  PlusCircle,
  PenTool,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { UserProfileCapsule } from "./user-profile-capsule";
import { getApprovalCounts } from "@/app/actions/spb";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile, state } = useSidebar();
  const [mounted, setMounted] = React.useState(false);
  const [counts, setCounts] = React.useState({
    ppic: { spb: 0, boq: 0, total: 0 },
    pm: { spb: 0, boq: 0, total: 0 },
  });

  React.useEffect(() => {
    setMounted(true);
    const fetchCounts = async () => {
      try {
        const res = await getApprovalCounts();
        if (res.success) {
          setCounts({
            ppic: res.ppic,
            pm: res.pm,
          });
        }
      } catch (err) {
        console.error("Error fetching sidebar approval counts:", err);
      }
    };
    fetchCounts();
  }, [pathname]);

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border bg-sidebar h-full hover:bg-sidebar/50 pb-4"
    >
      <SidebarHeader className="p-4 flex flex-row items-center justify-start group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center overflow-hidden">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg shrink-0 w-8 h-10 flex items-center justify-center shadow-xs">
            <Image
              src="/jlu-logo-removebg.png"
              alt="Jasa Laksa Utama Logo"
              width={40}
              height={40}
              className="object-contain"
            />
          </div>
          <div className="flex flex-col font-semibold group-data-[collapsible=icon]:hidden whitespace-nowrap">
            <span className="text-foreground text-lg font-bold leading-none">
              Jasa Laksa Utama
            </span>
            <span className="text-sm text-muted-foreground mt-0.5 leading-none">
              Production Tracker
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* <div className="px-4 pb-4">
        <Button
          className="w-full justify-start rounded-full shadow-sm text-sm"
          variant="default"
          onClick={() => router.push("/leads")}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> New Lead / Project
        </Button>
      </div> */}

      <SidebarContent className="px-2 group-data-[collapsible=icon]:px-0">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-foreground-600">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={
                    pathname === "/dashboard"
                      ? "py-2.5 font-semibold"
                      : "text-muted-foreground hover:text-foreground py-2.5"
                  }
                  isActive={pathname === "/dashboard"}
                  onClick={() => setOpenMobile(false)}
                  render={<Link href="/dashboard" />}
                  tooltip="Dashboard"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={
                    pathname === "/leads"
                      ? "py-2.5 font-semibold"
                      : "text-muted-foreground hover:text-foreground py-2.5"
                  }
                  isActive={pathname === "/leads"}
                  onClick={() => setOpenMobile(false)}
                  render={<Link href="/leads" />}
                  tooltip="Leads & Project"
                >
                  <Contact2 className="h-4 w-4" />
                  <span>Leads & Project</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2" />

        <SidebarGroup className="group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:pt-0">
          <SidebarGroupLabel className="text-xs font-semibold text-foreground-600">
            Divisions Tracker
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Engineering"
                  className={
                    pathname === "/trackers/engineering"
                      ? "py-2.5 font-semibold"
                      : "text-muted-foreground hover:text-foreground py-2.5"
                  }
                  isActive={pathname === "/trackers/engineering"}
                  onClick={() => setOpenMobile(false)}
                  render={<Link href="/trackers/engineering" />}
                >
                  <PenTool className="h-4 w-4" />
                  <span>Engineering</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="PPIC"
                  className={
                    pathname === "/trackers/ppic"
                      ? "py-2.5 font-semibold"
                      : "text-muted-foreground hover:text-foreground py-2.5"
                  }
                  isActive={pathname === "/trackers/ppic"}
                  onClick={() => setOpenMobile(false)}
                  render={<Link href="/trackers/ppic" />}
                >
                  <ClipboardCheck className="h-4 w-4" />
                  <span>PPIC</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Produksi"
                  className={
                    pathname === "/trackers/production"
                      ? "py-2.5 font-semibold"
                      : "text-muted-foreground hover:text-foreground py-2.5"
                  }
                  isActive={pathname === "/trackers/production"}
                  onClick={() => setOpenMobile(false)}
                  render={<Link href="/trackers/production" />}
                >
                  <Factory className="h-4 w-4" />
                  <span>Produksi</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Quality Control"
                  className={
                    pathname === "/trackers/quality-control"
                      ? "py-2.5 font-semibold"
                      : "text-muted-foreground hover:text-foreground py-2.5"
                  }
                  isActive={pathname === "/trackers/quality-control"}
                  onClick={() => setOpenMobile(false)}
                  render={<Link href="/trackers/quality-control" />}
                >
                  <UserCheck className="h-4 w-4" />
                  <span>Quality Control</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2" />

        <SidebarGroup className="group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:pt-0">
          <SidebarGroupLabel className="text-xs font-semibold text-foreground-600">
            Approval Workflow
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Approval SPB (PPIC)"
                  className={
                    pathname === "/trackers/spb-approval-ppic"
                      ? "py-2.5 font-semibold"
                      : "text-muted-foreground hover:text-foreground py-2.5"
                  }
                  isActive={pathname === "/trackers/spb-approval-ppic"}
                  onClick={() => setOpenMobile(false)}
                  render={<Link href="/trackers/spb-approval-ppic" />}
                >
                  <ClipboardCheck className="h-4 w-4" />
                  <span className="flex-1">Approval PPIC</span>
                  {mounted && (
                    <div className="flex items-center gap-1.5 shrink-0 group-data-[collapsible=icon]:hidden">
                      {counts.ppic.spb > 0 && (
                        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[8px] font-black text-white shadow-xs">
                          {counts.ppic.spb}
                        </span>
                      )}
                      {counts.ppic.boq > 0 && (
                        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-purple-600 px-1 text-[8px] font-black text-white shadow-xs">
                          {counts.ppic.boq}
                        </span>
                      )}
                    </div>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Approval SPB (PM)"
                  className={
                    pathname === "/trackers/spb-approval-pm"
                      ? "py-2.5 font-semibold"
                      : "text-muted-foreground hover:text-foreground py-2.5"
                  }
                  isActive={pathname === "/trackers/spb-approval-pm"}
                  onClick={() => setOpenMobile(false)}
                  render={<Link href="/trackers/spb-approval-pm" />}
                >
                  <UserCheck className="h-4 w-4" />
                  <span className="flex-1">Approval PM</span>
                  {mounted && (
                    <div className="flex items-center gap-1.5 shrink-0 group-data-[collapsible=icon]:hidden">
                      {counts.pm.spb > 0 && (
                        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[8px] font-black text-white shadow-xs">
                          {counts.pm.spb}
                        </span>
                      )}
                      {counts.pm.boq > 0 && (
                        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-purple-600 px-1 text-[8px] font-black text-white shadow-xs">
                          {counts.pm.boq}
                        </span>
                      )}
                    </div>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu className="mb-2">
          <SidebarMenuItem>
            {!mounted ? (
              <div className="flex items-center gap-2 py-2.5 px-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <SidebarMenuButton
                tooltip="System Settings"
                className={
                  pathname.startsWith("/settings")
                    ? "py-2.5 font-medium"
                    : "text-muted-foreground hover:text-foreground py-2.5"
                }
                isActive={pathname.startsWith("/settings")}
                render={<Link href="/settings/users" />}
                onClick={() => setOpenMobile(false)}
              >
                <Settings className="h-4 w-4" />
                <span>Admin Settings</span>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator className="mb-2" />

        <div className="flex w-full">
          {!mounted ? (
            <div className="flex items-center gap-3 w-full px-2 py-3">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              <div className="flex flex-col gap-2 flex-1 group-data-[collapsible=icon]:hidden">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-16" />
              </div>
            </div>
          ) : (
            <UserProfileCapsule
              className="w-full"
              isCollapsed={state === "collapsed"}
              side={state === "collapsed" ? "right" : "top"}
              align="start"
            />
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
