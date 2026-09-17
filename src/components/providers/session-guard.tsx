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
      signOut({ redirect: false })
        .catch(() => {})
        .finally(() => {
          document.cookie = "authjs.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie = "__Secure-authjs.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie = "next-auth.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie = "__Secure-next-auth.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          const callbackUrl = encodeURIComponent(pathname);
          window.location.href = `/login?clear=true&callbackUrl=${callbackUrl}`;
        });
    }
  }, [status, pathname]);

  return <>{children}</>;
}
