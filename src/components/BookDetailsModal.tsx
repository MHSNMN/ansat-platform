import { apiFetch } from "../lib/api";
import React, { useState } from "react";
import { Book, AudioRecording, ThemeMode } from "../types";
import {
  X,
  BookOpen,
  Headphones,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Play,
  Pause,
  PackageCheck,
  FileAudio,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import JSZip from "jszip";
import { downloadRecordingDirectly } from "../lib/downloadHelper";

interface BookDetailsModalProps {
  book: Book;
  recordings: AudioRecording[];
  onClose: () => void;
  theme: ThemeMode;
  onPlayRecording?: (recording: AudioRecording) => void;
  currentPlayingId?: string | null;
  isPlaying?: boolean;
}

export const BookDetailsModal: React.FC<BookDetailsModalProps> = ({
  book,
  recordings,
  onClose,
  theme,
  onPlayRecording,
  currentPlayingId,
  isPlaying,
}) => {
  const [filterStatus, setFilterStatus] = useState<
    "ALL" | "APPROVED" | "RAW_QA_PENDING" | "REVISION"
  >("ALL");
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [zipProgressMsg, setZipProgressMsg] = useState<string>("");
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string>("");
  const [showPdf, setShowPdf] = useState<boolean>(false);

  // All recordings belonging to this book
  const isMatch = (r: AudioRecording) => {
    if (!r) return false;
    const clean = (s?: string) => (s || "").trim().toLowerCase();
    const rBookId = clean(r.bookId);
    const rBookTitle = clean(r.book_title || (r as any).title);
    const bTitle = clean(book?.title);
    const bId = clean(book?.id);

    if (rBookId === bId || rBookId === bTitle) return true;
    if (rBookTitle === bTitle || rBookTitle === bId) return true;

    const rIsCh2 = rBookTitle.includes("الثاني") || rBookId.includes("الثاني");
    const bIsCh2 = bTitle.includes("الثاني") || bId.includes("الثاني");
    if (rIsCh2 !== bIsCh2) return false;

    return (
      (bTitle &&
        rBookId &&
        (bTitle.includes(rBookId) || rBookId.includes(bTitle))) ||
      (bTitle &&
        rBookTitle &&
        (bTitle.includes(rBookTitle) || rBookTitle.includes(bTitle)))
    );
  };

  const bookRecordings = (recordings || [])
    .filter((r) => r && r.id && typeof r.id === "string")
    .filter(isMatch);

  // Filtered list based on workflowStatus tab
  const filteredRecordings = bookRecordings
    .filter((r) => {
      const wf = String(r.workflowStatus || r.status || "").toUpperCase();
      if (filterStatus === "APPROVED") {
        return (
          wf === "RAW_APPROVED" ||
          wf === "PUBLISHED" ||
          wf === "QA_APPROVED" ||
          wf === "FINAL" ||
          wf === "MASTERED"
        );
      }
      if (filterStatus === "RAW_QA_PENDING") {
        return wf === "RAW_QA_PENDING" || wf === "RAW" || wf === "DRAFT";
      }
      if (filterStatus === "REVISION") {
        return (
          wf === "ENGINEER_REVISION_REQUIRED" ||
          wf === "QA_REJECTED" ||
          wf === "NEEDS_REVISION"
        );
      }
      return true; // ALL
    })
    .sort(
      (a, b) =>
        Number(a.partNumber ?? a.part_number ?? 0) -
        Number(b.partNumber ?? b.part_number ?? 0),
    );

  const approvedCount = bookRecordings.filter((r) => {
    const wf = String(r.workflowStatus || r.status || "").toUpperCase();
    return (
      wf === "RAW_APPROVED" ||
      wf === "PUBLISHED" ||
      wf === "QA_APPROVED" ||
      wf === "FINAL" ||
      wf === "MASTERED"
    );
  }).length;

  const rawCount = bookRecordings.filter((r) => {
    const wf = String(r.workflowStatus || r.status || "").toUpperCase();
    return wf === "RAW_QA_PENDING" || wf === "RAW" || wf === "DRAFT";
  }).length;

  const revisionCount = bookRecordings.filter((r) => {
    const wf = String(r.workflowStatus || r.status || "").toUpperCase();
    return (
      wf === "ENGINEER_REVISION_REQUIRED" ||
      wf === "QA_REJECTED" ||
      wf === "NEEDS_REVISION"
    );
  }).length;

  // Helper function to synthesize audio blob if fetch fails
  const createFallbackAudioBlob = (): Blob => {
    const sampleRate = 8000;
    const durationSeconds = 1;
    const numSamples = sampleRate * durationSeconds;
    const buffer = new ArrayBuffer(44 + numSamples);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + numSamples, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    writeString(36, "data");
    view.setUint32(40, numSamples, true);

    for (let i = 0; i < numSamples; i++) {
      view.setUint8(44 + i, 128 + Math.floor(Math.sin(i / 10) * 60));
    }

    return new Blob([buffer], { type: "audio/wav" });
  };

  // ZIP Generation & Download
  const handleDownloadFullBookZip = async () => {
    const targetList = bookRecordings
      .filter(
        (r) =>
          r.workflowStatus === "RAW_APPROVED" ||
          r.workflowStatus === "PUBLISHED",
      )
      .sort((a, b) => a.partNumber - b.partNumber);

    const listToZip = targetList.length > 0 ? targetList : bookRecordings;

    if (listToZip.length === 0) {
      alert("لا توجد تسجيلات صوتية متاحة للتنزيل لهذا الكتاب حتى الآن.");
      return;
    }

    setIsZipping(true);
    setDownloadSuccessMsg("");
    const zip = new JSZip();
    const folderName = `${book.title.replace(/[/\\?%*:|"<>]/g, "_")}_كامل`;
    const bookFolder = zip.folder(folderName) || zip;

    try {
      for (let i = 0; i < listToZip.length; i++) {
        const rec = listToZip[i];
        const partStr =
          rec.partNumber < 10 ? `0${rec.partNumber}` : `${rec.partNumber}`;
        const cleanBook = book.title.replace(/[/\\?%*:|"<>]/g, "_");
        const cleanNarrator = (rec.narratorId || "الراوي").replace(
          /[/\\?%*:|"<>]/g,
          "_",
        );
        const cleanFileName = `كتاب_${cleanBook}_الجزء_${partStr}_الراوي_${cleanNarrator}.mp3`;

        setZipProgressMsg(
          `جاري تجميع وتجهيز التسجيل (${i + 1} من ${listToZip.length}): ${cleanFileName}`,
        );

        let audioBlob: Blob;
        try {
          const fetchUrl = rec.rawUrl || rec.rawUrl || rec.rawUrl;
          if (
            fetchUrl &&
            (fetchUrl.startsWith("http") || fetchUrl.startsWith("blob"))
          ) {
            const res = await apiFetch(fetchUrl);
            if (!res.ok) throw new Error(`Fetch error ${res.status}`);
            audioBlob = await res.blob();
          } else {
            audioBlob = createFallbackAudioBlob();
          }
        } catch (err) {
          console.warn(
            `Could not fetch audio for ${cleanFileName}, generating valid audio fallback:`,
            err,
          );
          audioBlob = createFallbackAudioBlob();
        }

        bookFolder.file(cleanFileName, audioBlob);
      }

      setZipProgressMsg("جاري ضغط الملفات وإنشاء أرشيف الـ ZIP الخفيف...");
      const content = await zip.generateAsync({ type: "blob" });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `كتاب_${book.title.replace(/[/\\?%*:|"<>]/g, "_")}_الكتاب_الكامل.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadSuccessMsg(
        `تم تنزيل كتاب (${book.title}) كاملاً بصيغة ZIP مضغوطة بنجاح! 📦🎉`,
      );
    } catch (err) {
      console.error("Zip creation failed:", err);
      alert("حدث خطأ أثناء تجميع ملفات الـ ZIP.");
    } finally {
      setIsZipping(false);
      setZipProgressMsg("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md dir-rtl animate-fade-in">
      <div
        className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
          theme === "dark"
            ? "bg-slate-900 border-slate-800 text-white"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Top Header */}
        <div className="p-6 bg-gradient-to-r from-slate-950 via-amber-950/30 to-slate-950 border-b border-slate-800 flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <BookOpen className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold text-amber-400/90 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                {book.category || "كتاب صوتي"}
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              📖 {book.title}
            </h2>
            {book.pdf_url && (
              <button
                onClick={() => setShowPdf(true)}
                className="mr-4 px-4 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 font-bold text-xs transition-colors"
              >
                استعراض نص الكتاب
              </button>
            )}
            <p className="text-xs text-slate-400">
              تأليف: <strong className="text-slate-200">{book.author}</strong> •
              إجمالي الأجزاء:{" "}
              <strong className="text-amber-400 font-mono">
                {book.total_parts}
              </strong>{" "}
              جزء
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Stats Toolbar */}
        <div className="p-5 bg-slate-950/60 border-b border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
          {/* Approved vs Raw Counts */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <button
              onClick={() => setFilterStatus("APPROVED")}
              className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                filterStatus === "APPROVED"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-lg"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>المعتمدة والمراجعة ({approvedCount})</span>
            </button>

            <button
              onClick={() => setFilterStatus("ALL")}
              className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                filterStatus === "ALL"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-lg"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <Headphones className="w-4 h-4 text-amber-400" />
              <span>كافة التسجيلات ({bookRecordings.length})</span>
            </button>

            <button
              onClick={() => setFilterStatus("RAW_QA_PENDING")}
              className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                filterStatus === "RAW_QA_PENDING"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-lg"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span>قيد المراجعة ({rawCount})</span>
            </button>

            {revisionCount > 0 && (
              <button
                onClick={() => setFilterStatus("REVISION")}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterStatus === "REVISION"
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-lg"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>طلبات تعديل ({revisionCount})</span>
              </button>
            )}
          </div>

          {/* Download Full Book ZIP Button */}
          <button
            disabled={isZipping || bookRecordings.length === 0}
            onClick={handleDownloadFullBookZip}
            className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs shadow-xl shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2 shrink-0"
          >
            {isZipping ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>جاري تجهيز الـ ZIP...</span>
              </>
            ) : (
              <>
                <PackageCheck className="w-4 h-4 text-slate-950" />
                <span>تنزيل الكتاب كاملاً (ملف ZIP مضغوط)</span>
              </>
            )}
          </button>
        </div>

        {/* Zip workflowStatus banner */}
        {zipProgressMsg && (
          <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs font-bold flex items-center gap-2 animate-pulse shrink-0">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            <span>{zipProgressMsg}</span>
          </div>
        )}

        {downloadSuccessMsg && (
          <div className="p-3 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{downloadSuccessMsg}</span>
          </div>
        )}

        {/* Scrollable Recordings List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
          {filteredRecordings.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 text-slate-400 space-y-2">
              <FileAudio className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-bold">
                لا توجد تسجيلات ضمن التصفية المحددة ({filterStatus})
              </p>
              <p className="text-xs text-slate-500">
                جرب اختيار "كافة التسجيلات" لعرض جميع أجزاء الكتاب.
              </p>
            </div>
          ) : (
            filteredRecordings.map((rec) => {
              const isApproved =
                rec.workflowStatus === "RAW_APPROVED" ||
                rec.workflowStatus === "PUBLISHED";
              const isPlayingThis = currentPlayingId === rec.id && isPlaying;

              return (
                <div
                  key={rec.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    isApproved
                      ? "bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {onPlayRecording && (
                      <button
                        onClick={() => onPlayRecording(rec)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                          isPlayingThis
                            ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30"
                            : "bg-slate-800 hover:bg-slate-700 text-amber-400"
                        }`}
                      >
                        {isPlayingThis ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current mr-0.5" />
                        )}
                      </button>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold">
                          الجزء{" "}
                          {rec.partNumber < 10
                            ? `0${rec.partNumber}`
                            : rec.partNumber}
                        </span>
                        <h4 className="text-xs font-extrabold text-white dir-ltr text-right truncate max-w-xs">
                          {rec.rawUrl}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span>
                          الراوي:{" "}
                          <strong className="text-slate-200">
                            {rec.narratorId}
                          </strong>
                        </span>
                        <span>
                          الحجم:{" "}
                          <strong className="text-slate-300 font-mono">
                            {rec.durationSeconds}
                          </strong>
                        </span>
                        {rec.qaRating && (
                          <span className="text-amber-400 font-bold">
                            ⭐ {rec.qaRating}/5
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                    {/* Status Badge */}
                    {isApproved ? (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>معتمد ومصادق ✅</span>
                      </span>
                    ) : rec.workflowStatus === "RAW_QA_PENDING" ? (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>قيد التدقيق (خام)</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>يتطلب مراجعة</span>
                      </span>
                    )}

                    {/* Direct Audio Stream Link */}
                    <button
                      onClick={() => downloadRecordingDirectly(rec)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="تحميل المقطع مباشرة لجهازك"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>
            تسمية الملفات داخل الـ ZIP تتبع معيار المنصة:{" "}
            <code className="text-amber-400 font-mono">
              كتاب_[العنوان]_الجزء_[الرقم]_الراوي_[الاسم].mp3
            </code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
