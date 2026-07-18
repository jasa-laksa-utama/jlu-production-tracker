import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "sonner";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Jasa Laksa Utama Production Tracker",
  description: "Production Tracker untuk PT. JLU",
  icons: {
    icon: "/jlu-logo-removebg.png",
  },
};

import { AuthProvider } from "@/components/providers/auth-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full font-sans flex flex-col bg-background text-foreground">
        <AuthProvider>
          <SidebarProvider>
            {children}
            <Toaster position="top-right" richColors />
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
