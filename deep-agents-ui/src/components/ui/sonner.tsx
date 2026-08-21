"use client";

import React from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2
} from "lucide-react";

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

export const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <SonnerToaster
      theme="dark"
      className="toaster group"
      position="top-right"
      richColors={false}
      closeButton
      duration={3200}
      style={{ zIndex: 99999 }}
      icons={{
        success: <CheckCircle2 className="h-4 w-4 text-[#00FF88]" />,
        info: <Info className="h-4 w-4 text-[#00D2FF]" />,
        warning: <AlertTriangle className="h-4 w-4 text-amber-400" />,
        error: <AlertCircle className="h-4 w-4 text-rose-400" />,
        loading: <Loader2 className="h-4 w-4 animate-spin text-[#00D2FF]" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#0E1538]/95 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-slate-100 group-[.toaster]:border-slate-800 group-[.toaster]:shadow-[0_8px_30px_rgb(0,0,0,0.5)] group-[.toaster]:rounded-2xl group-[.toaster]:p-3.5 group-[.toaster]:text-xs font-sans",
          description:
            "group-[.toast]:text-slate-400 group-[.toast]:text-[11px] group-[.toast]:mt-1 leading-relaxed",
          actionButton:
            "group-[.toast]:bg-[#00FF88] group-[.toast]:text-[#080B21] group-[.toast]:font-bold group-[.toast]:rounded-xl group-[.toast]:text-xs group-[.toast]:px-3 group-[.toast]:py-1.5 hover:group-[.toast]:bg-[#00FF88]/90",
          cancelButton:
            "group-[.toast]:bg-slate-800 group-[.toast]:text-slate-300 group-[.toast]:rounded-xl group-[.toast]:text-xs",
          closeButton:
            "group-[.toast]:bg-[#121A45] group-[.toast]:border group-[.toast]:border-slate-700 group-[.toast]:text-slate-400 hover:group-[.toast]:text-white hover:group-[.toast]:border-[#00FF88]/40 transition-colors",
          success:
            "group-[.toaster]:border-[#00FF88]/40 group-[.toaster]:bg-[#0E1538]/95 group-[.toaster]:shadow-[0_0_20px_rgba(0,255,136,0.15)]",
          error:
            "group-[.toaster]:border-rose-500/40 group-[.toaster]:bg-[#150A1E]/95 group-[.toaster]:shadow-[0_0_20px_rgba(244,63,94,0.15)]",
          info:
            "group-[.toaster]:border-[#00D2FF]/40 group-[.toaster]:bg-[#081530]/95 group-[.toaster]:shadow-[0_0_20px_rgba(0,210,255,0.15)]",
          warning:
            "group-[.toaster]:border-amber-500/40 group-[.toaster]:bg-[#1B1405]/95 group-[.toaster]:shadow-[0_0_20px_rgba(245,158,11,0.15)]",
        },
      }}
      {...props}
    />
  );
};

export const toast = sonnerToast;
