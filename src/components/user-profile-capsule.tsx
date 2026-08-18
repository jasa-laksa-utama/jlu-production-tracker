"use client";

import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LogOut,
  User as UserIcon,
  BadgeInfo,
  Mail,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession, signOut } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UserProfileCapsuleProps {
  isCollapsed?: boolean;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export function UserProfileCapsule({
  isCollapsed = false,
  className,
  side = "bottom",
  align = "end",
}: UserProfileCapsuleProps) {
  const { data: session, status } = useSession();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  if (status === "loading") {
    return (
      <div
        className={cn(
          "hidden sm:flex items-center gap-2 px-2 py-1.5",
          className,
        )}
      >
        <div className="w-7 h-7 rounded-full bg-muted animate-pulse" />
        {!isCollapsed && (
          <div className="flex flex-col gap-1">
            <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            <div className="h-2 w-24 bg-muted animate-pulse rounded" />
          </div>
        )}
      </div>
    );
  }

  if (!session) {
    return (
      <button
        type="button"
        onClick={async () => {
          try {
            await signOut({ redirect: false });
          } catch (e) {}
          document.cookie =
            "next-auth.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie =
            "__Secure-next-auth.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie =
            "authjs.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          window.location.href = "/login?clear=true&logout=true";
        }}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:bg-primary/90 transition-all cursor-pointer",
          className,
        )}
      >
        <LogOut className="w-3.5 h-3.5 rotate-180" />
        Login Kembali
      </button>
    );
  }

  const user = session.user;
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className={cn("flex items-center", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex items-center gap-2.5 bg-sidebar-accent/50 hover:bg-sidebar-accent border border-border/50 py-1.5 transition-all active:scale-95 cursor-pointer group shadow-sm outline-none overflow-hidden",
            isCollapsed
              ? "w-9 h-9 p-0 justify-center rounded-xl"
              : "w-full pl-2 pr-4 rounded-xl",
          )}
        >
          <div
            className={cn(
              "rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-inner shrink-0 transition-all",
              isCollapsed ? "w-7 h-7 text-[10px]" : "w-7 h-7 text-[10px]",
            )}
          >
            {initials}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col items-start leading-tight flex-1">
              <span className="text-[12px] font-bold text-foreground group-hover:text-primary transition-colors text-left truncate max-w-45">
                {user.name}
              </span>
              <span className="text-[10px] text-muted-foreground truncate max-w-45">
                {user.username}
              </span>
            </div>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          side={side}
          className="w-64 p-2 shadow-xl border-border/60"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal p-2">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-bold leading-none">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground mt-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator className="bg-border/60" />
          <div className="p-1 space-y-0.5">
            <DropdownMenuItem className="flex h-9 items-center rounded-md px-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer focus:bg-accent group">
              <BadgeInfo className="mr-2 h-4 w-4 opacity-50 group-hover:opacity-100" />
              <span>Jabatan: {user.position || "Staff"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex h-9 items-center rounded-md px-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer focus:bg-accent group">
              <UserIcon className="mr-2 h-4 w-4 opacity-50 group-hover:opacity-100" />
              <span>Roles: {user.roles?.join(", ") || "-"}</span>
            </DropdownMenuItem>
          </div>
          <DropdownMenuSeparator className="bg-border/60" />
          <div className="p-1">
            <DropdownMenuItem
              className="flex h-9 items-center rounded-md px-2 text-sm font-medium text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer group"
              onClick={() => setIsLogoutDialogOpen(true)}
            >
              <LogOut className="mr-2 h-4 w-4 opacity-70 group-hover:opacity-100" />
              <span>Logout</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Logout Confirmation Dialog */}
      <Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <DialogContent className="max-w-xs sm:max-w-sm rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-red-500/10 p-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mb-4">
              <LogOut className="w-8 h-8 text-red-600" />
            </div>
            <DialogHeader className="items-center text-center space-y-2">
              <DialogTitle className="text-xl font-bold text-red-700">
                Confirm Logout
              </DialogTitle>
              <DialogDescription className="text-sm text-red-600/80 font-medium">
                Are you sure you want to log out of the system?
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-4 bg-background border-t space-y-2">
            <p className="text-[11px] text-muted-foreground text-center mb-4">
              Your active session will be terminated and you will need to sign
              in again to access the dashboard.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => setIsLogoutDialogOpen(false)}
                className="rounded-xl h-11 font-semibold border-border/50 hover:bg-muted/50 transition-all active:scale-95 cursor-pointer"
              >
                Go Back
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  await signOut({
                    redirect: false,
                    callbackUrl: "/login",
                  });
                  window.location.href = "/login";
                }}
                className="rounded-xl h-11 font-semibold shadow-lg shadow-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                Logout
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
