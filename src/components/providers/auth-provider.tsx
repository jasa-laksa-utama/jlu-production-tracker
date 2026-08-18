"use client";

import { SessionProvider } from "next-auth/react";
import { SessionGuard } from "./session-guard";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionGuard>{children}</SessionGuard>
    </SessionProvider>
  );
}
