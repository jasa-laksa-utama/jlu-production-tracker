"use client";

import { useState, useEffect } from "react";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Loader2,
  Lock,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  // Load remembered username & clear stale session if requested
  useEffect(() => {
    const saved = localStorage.getItem("remembered-username");
    if (saved) {
      setUsername(saved);
      setRememberMe(true);
    }

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get("clear") === "true" ||
        params.get("logout") === "true" ||
        params.has("error")
      ) {
        signOut({ redirect: false });
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const trimmedUsername = username.trim();
      const result = await signIn("credentials", {
        username: trimmedUsername,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Username atau password salah");
      } else {
        if (rememberMe) {
          localStorage.setItem("remembered-username", username);
        } else {
          localStorage.removeItem("remembered-username");
        }

        setIsSuccess(true);
        toast.success("Login berhasil!");

        // Wait for animation before redirecting
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 1500);
      }
    } catch (error) {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background overflow-hidden relative">
      {/* Success Overlay */}
      {isSuccess && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/80 backdrop-blur-md animate-in fade-in duration-500">
          <div className="flex flex-col items-center gap-4 animate-in zoom-in-95 duration-500 delay-200">
            <CheckCircle2 className="w-12 h-12 text-primary animate-bounce" />
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Welcome Back!
            </h2>
            <p className="text-foreground animate-pulse">
              Redirecting to your dashboard...
            </p>
          </div>
        </div>
      )}

      {/* Left Panel: Form */}
      <div className="w-full md:w-[45%] lg:w-[40%] flex flex-col justify-center px-8 sm:px-12 lg:px-20 py-12 relative z-10 bg-background shadow-2xl overflow-y-auto">
        <div className="max-w-md w-full mx-auto space-y-8 animate-in slide-in-from-left duration-700">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative shrink-0 w-12 h-12 overflow-hidden rounded-lg flex items-center justify-center">
                <img
                  src="/jlu-logo.png"
                  alt="JLU Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-2xl font-bold tracking-tight text-foreground leading-none mb-1">
                  Jasa Laksa Utama
                </span>
                <span className="text-md font-semibold tracking-tight text-primary leading-none">
                  Production Tracker
                </span>
              </div>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Welcome back!
            </h1>
            <p className="text-muted-foreground text-lg">
              Login to your JLU Production account
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="username"
                  className="text-sm font-semibold text-foreground/80"
                >
                  Username
                </Label>
                <div className="relative group">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-all duration-300" />
                  <Input
                    id="username"
                    placeholder="Enter Your Username"
                    className="pl-12 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-all h-12 rounded-xl"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={isLoading || isSuccess}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-sm font-semibold text-foreground/80"
                  >
                    Password
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <a
                            href="#"
                            onClick={(e) => e.preventDefault()}
                            className="text-xs font-medium text-primary hover:underline transition-all underline-offset-4 cursor-pointer"
                          >
                            Forgot password?
                          </a>
                        }
                      />
                      <TooltipContent className="bg-slate-900 text-white border-slate-800 p-3 max-w-50 rounded-xl shadow-xl">
                        <div className="flex items-start gap-2">
                          <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                          <p className="text-xs">
                            Silakan hubungi Administrator Sistem untuk reset
                            password Anda.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-all duration-300" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-12 pr-12 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-all h-12 rounded-xl"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading || isSuccess}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading || isSuccess}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 py-1">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                className="rounded cursor-pointer data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <label
                htmlFor="remember"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              >
                Remember me
              </label>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-bold rounded-xl shadow-xl shadow-primary/20 transition-all active:scale-[0.98] group relative overflow-hidden flex items-center justify-center gap-2 cursor-pointer"
              disabled={isLoading || isSuccess}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Login
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>

          <div className="pt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <a
                        href="#"
                        onClick={(e) => e.preventDefault()}
                        className="font-bold text-primary hover:underline transition-all underline-offset-4 cursor-pointer"
                      >
                        Contact Administrator
                      </a>
                    }
                  />
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 p-3 max-w-50 rounded-xl shadow-xl">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <p className="text-xs">
                        Hubungi tim IT atau HR untuk pendaftaran akun baru.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  signOut({ redirect: false }).then(() => {
                    toast.success("Session berhasil dibersihkan. Silakan coba login kembali.");
                  });
                }}
                className="text-xs text-muted-foreground/60 hover:text-destructive underline cursor-pointer transition-colors"
              >
                Session bermasalah? Reset Session / Cookies
              </button>
            </div>
          </div>
        </div>

        {/* Footer Branding for Mobile */}
        <div className="mt-auto pt-10 text-center text-[10px] text-muted-foreground/50 font-medium tracking-[0.2em] uppercase md:hidden">
          Jaksa Laksa Utama © 2026
        </div>
      </div>

      {/* Right Panel: Image & Branding */}
      <div className="hidden md:flex md:w-[55%] lg:w-[60%] h-full relative overflow-hidden bg-slate-900 shadow-inner">
        {/* The Image using standard img */}
        <div className="absolute inset-0 transition-transform duration-[10s] hover:scale-105">
          <img
            src="/login-bg.png"
            alt="Production Tracker Background"
            className="w-full h-full object-cover"
          />
        </div>


        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-linear-to-tr from-slate-950 via-slate-900/60 to-transparent opacity-80 z-10" />
        <div className="absolute inset-0 bg-primary/10 mix-blend-overlay z-10" />

        {/* Floating Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-16 lg:p-24 z-20 space-y-6">
          <div className="max-w-lg space-y-4 animate-in slide-in-from-bottom duration-1000">
            <div className="w-12 h-1 bg-primary rounded-full mb-6" />
            <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.1]">
              Precision Engineering, <br />
              <span className="text-primary">Optimized Production.</span>
            </h2>
            <p className="text-xl text-slate-300 leading-relaxed font-light">
              Manage every stage of production with our state-of-the-art
              tracking system. Real-time insights for the PT. Jaksa Laksa Utama
              team.
            </p>
          </div>

          <div className="mt-12 flex items-center gap-6 text-slate-500 font-bold uppercase text-xs tracking-wide">
          </div>
        </div>
      </div>
    </div>
  );
}
