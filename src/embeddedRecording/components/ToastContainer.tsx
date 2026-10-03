// @ts-nocheck
import React, { useEffect, useState } from "react";
import { toastStore, ToastMessage } from "../lib/toastStore";
import { CheckCircle2, AlertCircle, Info, X, ExternalLink } from "lucide-react";

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return toastStore.subscribe(setToasts);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 flex items-start gap-3 w-80 animate-in fade-in slide-in-from-top-5"
        >
          {toast.type === "success" && (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          {toast.type === "error" && (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          {toast.type === "info" && (
            <Info className="w-5 h-5 text-blue-400 shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-white mb-1">{toast.title}</h4>
            <p className="text-xs text-slate-300">{toast.message}</p>
            {toast.link && (
              <a
                href={toast.link}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold"
              >
                فتح الملف في Drive
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <button
            onClick={() => toastStore.removeToast(toast.id)}
            className="text-slate-500 hover:text-slate-300 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
