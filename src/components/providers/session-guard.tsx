"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  const hasRedirected = useRef(false);

  useEffect(() => {
    const isPublicPage =
      pathname === "/login" ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/warehouse");

    if (
      !isPublicPage &&
      status === "unauthenticated" &&
      !hasRedirected.current
    ) {
      hasRedirected.current = true;
      signOut({ redirect: false }).then(() => {
        const callbackUrl = encodeURIComponent(pathname);
        window.location.href = `/login?clear=true&callbackUrl=${callbackUrl}`;
      });
    }
  }, [status, pathname]);

  return <>{children}</>;
}
