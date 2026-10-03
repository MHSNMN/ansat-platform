// @ts-nocheck
import React, { useState } from "react";
import { User, AudioRecording, ThemeMode } from "../types";
import {
  ShieldCheck,
  Star,
  CheckCircle2,
  XCircle,
  Volume2,
  FileCheck,
  Clock,
  Award,
} from "lucide-react";
import { updateRecording } from "../lib/supabaseClient";

interface QAReviewStudioProps {
  currentUser: User;
  recordings: AudioRecording[];
  onRecordingsUpdated: (updated: AudioRecording[]) => void;
  theme: ThemeMode;
  onPlayAudio: (rec: AudioRecording) => void;
}

export const QAReviewStudio: React.FC<QAReviewStudioProps> = ({
  currentUser,
  recordings,
  onRecordingsUpdated,
  theme,
  onPlayAudio,
}) => {
  const [selectedRec, setSelectedRec] = useState<AudioRecording | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [qaNotes, setQaNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>("");

  const cleanRecordings =
    recordings?.filter((r) => r && r.id && typeof r.id === "string") || [];
  const pendingQaRecordings = cleanRecordings.filter(
    (r) =>
      r.workflowStatus === "RAW_QA_PENDING" || r.workflowStatus === "MASTERING",
  );
  const reviewedRecordings = cleanRecordings.filter(
    (r) =>
      r.workflowStatus === "RAW_APPROVED" ||
      r.workflowStatus === "PUBLISHED" ||
      r.workflowStatus === "NARRATOR_REVISION_REQUIRED",
  );

  const handleSelectRecording = (rec: AudioRecording) => {
    setSelectedRec(rec);
    setRating(rec.qaRating || 5);
    setQaNotes(rec.qaNotes || "");
    setActionSuccessMsg("");
    onPlayAudio(rec);
  };

  const handleReviewSubmit = async (isApproved: boolean) => {
    if (!selectedRec) return;

    let finalStatus = selectedRec.workflowStatus;
    let newFileName = selectedRec.masteredUrl;

    if (isApproved) {
      if (selectedRec.workflowStatus === "MASTERING") {
        finalStatus = "PUBLISHED";
        const partStr =
          selectedRec.partNumber === 0
            ? "Full"
            : `Part${selectedRec.partNumber}`;
        newFileName = `Final_Version - ${""} - ${partStr}.mp3`;
      } else {
        finalStatus = "RAW_APPROVED";
      }
    } else {
      finalStatus = "NARRATOR_REVISION_REQUIRED";
    }

    const recId = selectedRec.id;
    const currentRating = rating;
    const currentNotes = qaNotes;

    // 1. Instant 0ms Optimistic UI Update & Close Panel
    const optimisticRecordings = recordings?.map((r) => {
      if (r.id === recId) {
        return {
          ...r,
          workflowStatus: finalStatus as any,
          qaRating: currentRating,
          qaNotes: currentNotes,
          qaReviewedBy: currentUser.name,
          ...(newFileName ? { masteredUrl: newFileName } : {}),
        };
      }
      return r;
    });
    onRecordingsUpdated(optimisticRecordings);
    setActionSuccessMsg(
      isApproved
        ? `تم اعتماد وتصديق التسجيل بنجاح وتقييمه بـ ${currentRating} نجوم! 🎉`
        : `تم طلب تعديل المقطع الصوتي وتسجيل الملاحظات الموجهة.`,
    );
    setSelectedRec(null);

    // 2. Background async save
    try {
      const updatedRecordings = await updateRecording(recId, {
        workflowStatus: finalStatus as any,
        qaRating: currentRating,
        qaNotes: currentNotes,
        qaReviewedBy: currentUser.name,
        ...(newFileName ? { masteredUrl: newFileName } : {}),
      });
      onRecordingsUpdated(updatedRecordings);
    } catch (err) {
      console.error("Background QA review submit error:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className={`p-6 rounded-2xl border transition-all ${
          theme === "dark"
            ? "bg-slate-900/90 border-slate-800"
            : "bg-white border-slate-200"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
                استوديو تدقيق ومراقبة الجودة (In-App Audio Reviewer - QA)
              </h2>
              <p className="text-xs text-slate-400">
                المراجعة الفنية واعتماد التسجيلات الصوتية: {currentUser.name}
              </p>
            </div>
          </div>
          <span className="text-xs bg-purple-500/10 text-purple-400 font-mono px-3 py-1 rounded-lg border border-purple-500/20 font-semibold">
            QA Auditor
          </span>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-3">
          <Award className="w-5 h-5 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Main Reviewing Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Recordings Waiting for QA Review */}
        <div className="lg:col-span-6 space-y-3">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-400" />
            التسجيلات المرفوعة بانتظار التدقيق والتقييم (
            {pendingQaRecordings.length}):
          </h3>

          {pendingQaRecordings.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-slate-800 bg-slate-950/40 text-slate-400 text-xs">
              جميع التسجيلات الحالية مدققة ومعتمدة بالكامل.
            </div>
          ) : (
            pendingQaRecordings.map((rec, index) => {
              const isSelected = selectedRec?.id === rec.id;
              return (
                <div
                  key={rec.id || `pending-qa-${index}`}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10"
                      : theme === "dark"
                        ? "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                        : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                  onClick={() => handleSelectRecording(rec)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-amber-400 text-sm">
                      📖{" "}
                      {(rec as any).book_title ||
                        (rec as any).bookTitle ||
                        rec.bookId ||
                        "كتاب صوتي"}{" "}
                      - الجزء {rec.partNumber}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                        rec.workflowStatus === "MASTERING"
                          ? "bg-indigo-500/20 text-indigo-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {rec.workflowStatus === "MASTERING"
                        ? "جاهز للمراجعة (مماستر)"
                        : "خام (RAW)"}
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 flex items-center justify-between">
                    <span>
                      الراوي:{" "}
                      <strong className="text-slate-100">
                        {rec.narratorId}
                      </strong>
                    </span>
                    <span className="text-slate-500 text-[10px]">
                      {rec.createdAt}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayAudio(rec);
                      }}
                      className="text-amber-400 font-semibold flex items-center gap-1.5 hover:underline"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>تشغيل بداخل المتصفح</span>
                    </button>
                    <span className="text-[10px] text-amber-500">
                      انقر للتقييم والتوجيه ←
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: QA Evaluation Form & Star Rating */}
        <div className="lg:col-span-6">
          <div
            className={`p-5 rounded-2xl border sticky top-24 transition-all ${
              theme === "dark"
                ? "bg-slate-900 border-slate-800"
                : "bg-white border-slate-200"
            }`}
          >
            <h3 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              أداة التقييم والتدقيق الفني المدمجة
            </h3>

            {selectedRec ? (
              <div className="space-y-5">
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/30 text-xs space-y-1">
                  <div className="font-bold text-amber-300 text-sm">
                    {(selectedRec as any).book_title ||
                      (selectedRec as any).bookTitle ||
                      selectedRec.bookId ||
                      "كتاب صوتي"}{" "}
                    - الجزء {selectedRec.partNumber}
                  </div>
                  <div className="text-slate-400">
                    الراوي: {selectedRec.narratorId}
                  </div>
                  <div className="font-mono text-[10px] text-slate-500 dir-ltr text-right">
                    {selectedRec.masteredUrl || selectedRec.rawUrl}
                  </div>
                </div>

                {/* Star Rating Tool */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    التقييم الفني للجودة (1 إلى 5 نجوم):
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="p-1 transform hover:scale-125 transition-transform"
                      >
                        <Star
                          className={`w-7 h-7 ${
                            star <= rating
                              ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                              : "text-slate-700"
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-amber-400 mr-2">
                      ({rating} من 5)
                    </span>
                  </div>
                </div>

                {/* Feedback Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    ملاحظات الجودة والتوجيهات للراوي والممنتج:
                  </label>
                  <textarea
                    rows={4}
                    value={qaNotes}
                    onChange={(e) => setQaNotes(e.target.value)}
                    placeholder="اكتب التوجيهات الصوتية والنحوية هنا..."
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 transition-all ${
                      theme === "dark"
                        ? "bg-slate-950 border-slate-800 focus:ring-amber-500 text-slate-200"
                        : "bg-slate-50 border-slate-300 focus:ring-amber-500 text-slate-900"
                    }`}
                  />
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleReviewSubmit(true)}
                    className="py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>اعتماد واعتماد المقطع</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleReviewSubmit(false)}
                    className="py-3 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>طلب تعديلات</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-400 space-y-2">
                <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto" />
                <p>
                  اختر مقطعاً صوتياً من القائمة المجاورة لبدء التدقيق وتقييمه
                  بالنجوم وتدوين الملاحظات.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Previously Approved List */}
      <div className="pt-6 border-t border-slate-800/60">
        <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-amber-400" />
          سجل التسجيلات المدققة سابقاً ({reviewedRecordings.length}):
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {reviewedRecordings.map((rec, index) => (
            <div
              key={rec.id || `reviewed-${index}`}
              className="p-3.5 rounded-xl border bg-slate-900/60 border-slate-800 text-xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-400">
                  📖{" "}
                  {(rec as any).book_title ||
                    (rec as any).bookTitle ||
                    rec.bookId ||
                    "كتاب صوتي"}{" "}
                  - الجزء {rec.partNumber}
                </span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: rec.qaRating || 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-3 h-3 text-amber-400 fill-amber-400"
                    />
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-300 italic bg-slate-950 p-2 rounded border border-slate-800">
                "{rec.qaNotes || "لا توجد ملاحظات إضافية"}"
              </p>
              <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
                <span>تدقيق: {rec.qaReviewedBy || "منى محمد"}</span>
                <button
                  onClick={() => onPlayAudio(rec)}
                  className="text-amber-400 hover:underline flex items-center gap-1"
                >
                  <Volume2 className="w-3 h-3" /> استماع
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
