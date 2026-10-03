import { apiFetch } from "../lib/api";
import React, { useEffect, useState } from "react";
import { uploadQueueManager, QueueItem } from "../lib/uploadQueue";
import {
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCcw,
  Cloud,
  CloudOff,
  Activity,
  X,
} from "lucide-react";

export default function QueueManagerUI() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<
    "checking" | "active" | "disconnected"
  >("checking");
  const [healthMessage, setHealthMessage] = useState("");

  useEffect(() => {
    const unsubscribe = uploadQueueManager.subscribe((newQueue) => {
      setQueue(newQueue);
    });
    checkHealth();
    return unsubscribe;
  }, []);

  const checkHealth = async () => {
    setHealthStatus("checking");
    try {
      const res = await apiFetch("/api/drive/workflowStatus");
      const data = await res.json();
      if (data.configured) {
        setHealthStatus("active");
        setHealthMessage(
          `Google Drive مهيأ بنجاح (نمط المصادقة: ${data.authMode})`,
        );
      } else {
        setHealthStatus("disconnected");
        setHealthMessage(
          data.message || "Google Drive غير مهيأ. تحقق من متغيرات البيئة.",
        );
      }
    } catch (e: any) {
      setHealthStatus("disconnected");
      setHealthMessage(e.message || "تعذر الاتصال بالخادم.");
    }
  };

  const handlePauseToggle = () => {
    if (isPaused) {
      uploadQueueManager.resumeAll();
      setIsPaused(false);
    } else {
      uploadQueueManager.pauseAll();
      setIsPaused(true);
    }
  };

  const handleRetry = (id: string) => {
    uploadQueueManager.retryItem(id);
  };

  const handleClearCompleted = () => {
    uploadQueueManager.clearCompleted();
  };

  const handleClearAll = () => {
    uploadQueueManager.clearAll();
  };

  const handleRemoveItem = (id: string) => {
    uploadQueueManager.removeItem(id);
  };

  if (queue.length === 0 && !showHealth) return null;

  return (
    <div className="fixed bottom-12 right-6 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col dir-rtl">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-amber-400">
            طابور الرفع (Drive)
          </h3>

          <button
            onClick={() => {
              setShowHealth(!showHealth);
              if (!showHealth) checkHealth();
            }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border transition-colors ${
              healthStatus === "active"
                ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20"
                : healthStatus === "checking"
                  ? "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20"
                  : "bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20"
            }`}
          >
            {healthStatus === "active" ? (
              <Cloud className="w-3 h-3 text-emerald-400" />
            ) : healthStatus === "checking" ? (
              <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
            ) : (
              <CloudOff className="w-3 h-3 text-rose-400" />
            )}

            <span
              className={`text-[10px] font-bold ${
                healthStatus === "active"
                  ? "text-emerald-400"
                  : healthStatus === "checking"
                    ? "text-amber-400"
                    : "text-rose-400"
              }`}
            >
              {healthStatus === "active"
                ? "نشط"
                : healthStatus === "checking"
                  ? "جاري الفحص"
                  : "منقطع"}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePauseToggle}
            className="text-slate-300 hover:text-white p-1 rounded hover:bg-slate-700"
          >
            {isPaused ? (
              <Play className="w-4 h-4" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleClearCompleted}
            className="text-slate-300 hover:text-emerald-400 p-1 rounded hover:bg-slate-700"
            title="مسح المكتمل"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleClearAll}
            className="text-slate-300 hover:text-red-400 p-1 rounded hover:bg-slate-700"
            title="إفراغ الكل (حذف نهائي)"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showHealth && (
        <div className="p-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              صحة اتصال الدرايف (Sync Health)
            </h4>
            <button
              onClick={() => setShowHealth(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div
            className={`p-3 rounded-xl border text-xs font-mono break-words ${
              healthStatus === "active"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : healthStatus === "checking"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            {healthMessage || "Checking..."}
          </div>
          <button
            onClick={checkHealth}
            className="mt-3 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center justify-center gap-2"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            إعادة الفحص الآن
          </button>
        </div>
      )}

      {queue.length > 0 && (
        <div className="max-h-60 overflow-y-auto p-2 space-y-2">
          {queue.map((item) => (
            <div
              key={item.id}
              className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center justify-between gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-slate-200 truncate">
                    {item.fileName}
                  </p>
                  {item.stage === "mastered" ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 whitespace-nowrap">
                      مونتاج
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 whitespace-nowrap">
                      خام
                    </span>
                  )}
                  {item.subfolderName && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] bg-slate-800 text-slate-400 border border-slate-700 truncate max-w-[90px]">
                      {item.subfolderName}
                    </span>
                  )}
                </div>
                {item.stateTextAr && (
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {item.stateTextAr}
                  </p>
                )}
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full ${
                      item.honestState === "uploaded_storage"
                        ? "bg-emerald-500"
                        : item.honestState === "retryable_failure"
                          ? "bg-amber-500"
                          : item.workflowStatus === "failed"
                            ? "bg-red-500"
                            : "bg-blue-500"
                    } transition-all`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1">
                {item.workflowStatus === "success" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                )}
                {item.workflowStatus === "failed" && (
                  <div className="flex items-center gap-2 group relative">
                    <button
                      onClick={() => handleRetry(item.id)}
                      className="p-1 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800 transition-colors"
                      title="إعادة المحاولة"
                    >
                      <RefreshCcw className="w-4 h-4" />
                    </button>
                    <AlertCircle className="w-4 h-4 text-red-500 cursor-help" />

                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-rose-500/10 border border-rose-500/30 backdrop-blur-md rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <p className="text-[10px] font-mono text-rose-300 leading-tight break-words">
                        {item.error || "فشل الاتصال بـ Google Drive"}
                      </p>
                      <div className="absolute left-1/2 -bottom-1 w-2 h-2 bg-rose-500/30 border-b border-r border-rose-500/30 transform -translate-x-1/2 rotate-45"></div>
                    </div>
                  </div>
                )}
                {item.workflowStatus === "uploading" && (
                  <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                )}
                {item.workflowStatus === "paused" && (
                  <Pause className="w-4 h-4 text-slate-500" />
                )}
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="ml-2 p-1 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800 transition-colors"
                  title="إلغاء وإزالة"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
