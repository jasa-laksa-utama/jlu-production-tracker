"use client";

import { SidebarTrigger } from "./ui/sidebar";
import { DigitalClock } from "./digital-clock";
import { UserProfileCapsule } from "./user-profile-capsule";
import { NotificationBell } from "./notification-bell";
import { useSession } from "next-auth/react";

export function DashboardHeader() {
  const { data: session } = useSession();
  const userName = session?.user?.name || "User";

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/50 backdrop-blur-md px-4 md:px-6 sticky top-0 z-30 w-full justify-between overflow-hidden">
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        <SidebarTrigger className="text-muted-foreground hover:bg-muted cursor-pointer transition-all active:scale-90" />
        <div className="flex flex-col gap-0.5 md:gap-1">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-base md:text-xl font-semibold text-foreground">
              Welcome Back,
            </span>
            <span className="text-base md:text-xl font-semibold text-primary truncate">
              {userName}!
            </span>
          </div>
          <div className="block">
            <DigitalClock />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <NotificationBell moduleName="TRACKER" />

        {/* Desktop view with labels (hidden on extreme mobile, shown via sm:flex) */}
        <UserProfileCapsule
          className="hidden sm:flex"
          align="end"
          side="bottom"
        />

        {/* Mobile view avatar only */}
        <UserProfileCapsule
          className="flex sm:hidden"
          isCollapsed={true}
          align="end"
          side="bottom"
        />
      </div>
    </header>
  );
}
