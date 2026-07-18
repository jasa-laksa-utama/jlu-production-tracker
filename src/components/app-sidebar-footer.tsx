"use client";

import { useState } from "react";
import { UserProfileCapsule } from "./user-profile-capsule";
import { useSession } from "next-auth/react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings } from "lucide-react";

export function AppSidebarFooter() {
  const { data: session, status } = useSession();
  const { state } = useSidebar();
  const [mounted, setMounted] = useState(false);

  // Handle mounting for client-side hooks
  useState(() => {
    setMounted(true);
  });

  return (
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
              className="text-muted-foreground hover:text-foreground py-2.5"
            >
              <Settings className="h-4 w-4" />
              <span>System Settings</span>
            </SidebarMenuButton>
          )}
        </SidebarMenuItem>
      </SidebarMenu>

      <SidebarSeparator className="mb-2" />

      <div className="flex w-full">
        {status === "loading" || !mounted ? (
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
  );
}
