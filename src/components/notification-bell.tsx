"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Circle, Info, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getLatestNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "@/app/actions/notifications";
import { formatJakartaDate } from "@/lib/date-utils";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  module: string;
  targetUrl: string | null;
  isRead: boolean;
  createdAt: Date;
}

function formatTimeAgo(dateInput: string | Date) {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  if (isNaN(diffMs) || diffMs < 0) return "Just now";
  
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "Just now";
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell({ moduleName = "TRACKER" }: { moduleName?: string }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const loadNotificationsData = useCallback(async () => {
    try {
      const [notifsRes, countRes] = await Promise.all([
        getLatestNotifications(moduleName),
        getUnreadCount(moduleName),
      ]);

      if (notifsRes.success && notifsRes.data) {
        // Cast to our interface
        setNotifications(notifsRes.data as unknown as NotificationItem[]);
      }
      if (countRes.success && countRes.data !== undefined) {
        setUnreadCount(countRes.data);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  }, [moduleName]);

  // Load on mount and set up polling every 30 seconds
  useEffect(() => {
    loadNotificationsData();
    const interval = setInterval(() => {
      loadNotificationsData();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadNotificationsData]);

  // Load when popover opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      loadNotificationsData();
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsLoading(true);
    try {
      const res = await markAllAsRead(moduleName);
      if (res.success) {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      try {
        await markAsRead(notif.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
        );
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }
    
    setIsOpen(false);
    if (notif.targetUrl) {
      router.push(notif.targetUrl);
    }
  };

  const getIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case "SUCCESS":
        return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
      case "WARNING":
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
      case "ERROR":
        return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className="relative h-9 w-9 rounded-xl hover:bg-muted active:scale-90 transition-all cursor-pointer border border-border/10 shrink-0 flex items-center justify-center outline-hidden"
      >
        <Bell className="h-4.5 w-4.5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white border-2 border-background animate-in zoom-in-50 duration-200">
            {unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-90 p-0 rounded-2xl bg-popover border border-border shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50"
      >
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">Notifikasi</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border-none">
                {unreadCount} Baru
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isLoading}
              onClick={handleMarkAllAsRead}
              className="text-xs text-primary hover:text-primary hover:bg-primary/5 font-semibold gap-1.5 h-8 px-2.5 rounded-lg cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Tandai semua dibaca
            </Button>
          )}
        </div>

        <div className="max-h-87.5 overflow-y-auto divide-y divide-border/40">
          {notifications.length > 0 ? (
            notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={cn(
                  "w-full text-left p-4 hover:bg-muted/40 transition-colors flex gap-3 cursor-pointer items-start relative group",
                  !notif.isRead && "bg-primary/5 hover:bg-primary/8"
                )}
              >
                {!notif.isRead && (
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                )}
                <div className="mt-0.5">{getIcon(notif.type)}</div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("text-xs font-bold text-foreground truncate", !notif.isRead && "text-primary")}>
                      {notif.title}
                    </p>
                    <span
                      className="text-[10px] text-muted-foreground whitespace-nowrap cursor-help"
                      title={formatJakartaDate(notif.createdAt, "full")}
                    >
                      {formatTimeAgo(notif.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium line-clamp-2 leading-relaxed">
                    {notif.message}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-muted/40 flex items-center justify-center text-muted-foreground">
                <Bell className="w-5 h-5 opacity-40" />
              </div>
              <p className="text-xs font-bold opacity-60">Tidak ada notifikasi baru</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
