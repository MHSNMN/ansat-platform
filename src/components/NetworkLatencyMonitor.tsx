import React, { useState, useEffect } from "react";
import { WifiOff, Activity } from "lucide-react";

export default function NetworkLatencyMonitor() {
  const [latency, setLatency] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const checkLatency = async () => {
      if (!navigator.onLine) return;
      const start = performance.now();
      try {
        // Fetching a small resource from the same origin to measure latency
        await fetch("/favicon.ico", { cache: "no-store" });
        const end = performance.now();
        setLatency(Math.round(end - start));
      } catch (e) {
        // Error fetching, might be offline
      }
    };

    const intervalId = setInterval(checkLatency, 5000);
    checkLatency();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(intervalId);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-400">
        <WifiOff className="w-3 h-3 animate-pulse" />
        <span className="font-bold">
          أنت الآن غير متصل. (Offline Mode Active) البيانات تحفظ محلياً.
        </span>
      </div>
    );
  }

  const isSlow = latency > 500;

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${isSlow ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}
    >
      <Activity className="w-3 h-3" />
      <span className="font-bold">{latency}ms</span>
      {isSlow && (
        <span className="font-semibold text-[9px]">
          (اتصال بطيء - يُفضل وضع Offline Mode)
        </span>
      )}
    </div>
  );
}
