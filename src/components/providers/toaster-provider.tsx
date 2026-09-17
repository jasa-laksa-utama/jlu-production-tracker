"use client";

import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import { sanitizeErrorMessage } from "@/lib/error-handler";

let isIntercepted = false;

function installToastInterceptor() {
  if (isIntercepted || typeof window === "undefined") return;

  const originalError = toast.error.bind(toast);

  toast.error = ((message: any, data?: any) => {
    let cleanMessage = message;

    if (typeof message === "string") {
      cleanMessage = sanitizeErrorMessage(message);
    } else if (message instanceof Error) {
      cleanMessage = sanitizeErrorMessage(message);
    } else if (typeof message === "object" && message !== null) {
      // If it's a JSX element or React node, leave as is, otherwise sanitize
      if (!("$$typeof" in message)) {
        cleanMessage = sanitizeErrorMessage(message);
      }
    }

    return originalError(cleanMessage, data);
  }) as any;

  isIntercepted = true;
}

// Install early if loaded in browser
if (typeof window !== "undefined") {
  installToastInterceptor();
}

export function AppToaster() {
  useEffect(() => {
    installToastInterceptor();
  }, []);

  return <Toaster position="top-right" richColors closeButton />;
}
