import React, { useState } from "react";
import {
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { AudioRecording, Book } from "../types";
import { updateRecording } from "../lib/supabaseClient";
import { toastStore } from "../lib/toastStore";

interface Props {
  recordings: AudioRecording[];
  books: Book[];
}

/**
 * Google Drive Integrity & Verification Tool
 * Replaces legacy storage migration tools: Google Drive is the mandatory and sole
 * storage provider for all audio recordings and media files.
 */
export default function FirebaseStorageMigrationTool({
  recordings,
  books: _books,
}: Props) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedCount, setVerifiedCount] = useState(0);

  // Files with valid Google Drive IDs
  const driveRecordings = recordings.filter((r) =>
    Boolean(r.rawDriveFileId || (r as any).driveFileId),
  );

  // Files without Google Drive IDs
  const unlinkedRecordings = recordings.filter(
    (r) => !(r.rawDriveFileId || (r as any).driveFileId),
  );

  const handleAuditDriveLinks = async () => {
    setIsVerifying(true);
    let resolved = 0;

    for (const rec of unlinkedRecordings) {
      const rawUrl =
        rec.masteredUrl || rec.rawUrl || rec.rawUrl || rec.rawUrl || "";
      const matchId =
        rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
        rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);

      if (matchId && matchId[1]) {
        try {
          await updateRecording(rec.id, {
            rawDriveFileId: matchId[1],
            rawUrl: `https://drive.google.com/file/d/${matchId[1]}/view`,
          });
          resolved++;
        } catch {
          // ignore
        }
      }
    }

    setIsVerifying(false);
    setVerifiedCount(resolved);
    toastStore.addToast({
      type: "success",
      title: "اكتمل تدقيق Google Drive",
      message: `تم التحقق وتحديث ${resolved} تسجيلات بروابط Google Drive المباشرة.`,
    });
  };

  return (
    <div className="mt-6 p-5 rounded-2xl border bg-emerald-500/10 border-emerald-500/30">
      <div className="flex items-center gap-3 mb-4">
        <HardDrive className="w-5 h-5 text-emerald-400" />
        <div>
          <h3 className="font-bold text-lg text-emerald-400">
            حالة تخزين Google Drive (التخزين الإلزامي الوحيد)
          </h3>
          <p className="text-xs text-slate-300">
            جميع الملفات الصوتية والكتب والأغلفة مخزنة حصرياً على Google Drive.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>ملفات مرتبطة بـ Google Drive:</span>
          </span>
          <span className="font-mono font-bold text-emerald-400">
            {driveRecordings.length}
          </span>
        </div>

        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>ملفات تحتاج ربط معرّف Drive:</span>
          </span>
          <span className="font-mono font-bold text-amber-400">
            {unlinkedRecordings.length}
          </span>
        </div>
      </div>

      {unlinkedRecordings.length > 0 && (
        <button
          onClick={handleAuditDriveLinks}
          disabled={isVerifying}
          className="w-full flex justify-center items-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white transition text-sm font-bold shadow-lg shadow-emerald-600/20 cursor-pointer"
        >
          {isVerifying ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4" />
          )}
          تدقيق واستخراج معرّفات Google Drive للتسجيلات (
          {unlinkedRecordings.length})
        </button>
      )}

      {verifiedCount > 0 && (
        <p className="text-xs text-emerald-400 mt-2 text-center font-bold">
          ✓ تم ربط وتحديث {verifiedCount} تسجيلات بنجاح.
        </p>
      )}
    </div>
  );
}
