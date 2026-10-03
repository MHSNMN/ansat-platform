// @ts-nocheck
import React from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "alert";
  timestamp: string;
}

interface ToastNotificationProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 left-5 z-50 flex flex-col gap-3 max-w-sm w-full font-['Cairo'] pointer-events-none">
      {toasts.map((toast) => {
        let Icon = Info;
        let borderColor = "border-amber-500/40";
        let bgGradient = "from-slate-900 via-slate-900 to-amber-950/40";
        let iconColor = "text-amber-400";

        if (toast.type === "success") {
          Icon = CheckCircle2;
          borderColor = "border-emerald-500/40";
          bgGradient = "from-slate-900 via-slate-900 to-emerald-950/40";
          iconColor = "text-emerald-400";
        } else if (toast.type === "alert" || toast.type === "warning") {
          Icon = AlertTriangle;
          borderColor = "border-rose-500/40";
          bgGradient = "from-slate-900 via-slate-900 to-rose-950/40";
          iconColor = "text-rose-400";
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl bg-gradient-to-r ${bgGradient} border ${borderColor} shadow-2xl text-right animate-in slide-in-from-left duration-300 flex items-start justify-between gap-3`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-xl bg-slate-950/80 border border-slate-800 ${iconColor}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-xs">
                    {toast.title}
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {toast.timestamp}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {toast.message}
                </p>
              </div>
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
