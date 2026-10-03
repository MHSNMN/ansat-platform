// @ts-nocheck
import { apiFetch } from "../lib/api";
import React, { useState, useEffect } from "react";
import { AudioRecording, ThemeMode, User, Book } from "../types";
import {
  Headphones,
  Search,
  Play,
  Download,
  Star,
  Trash2,
  CheckSquare,
  Square,
  RotateCcw,
  AlertTriangle,
  CloudUpload,
  Loader2,
  BookOpen,
  ChevronRight,
  CheckCircle2,
  Pause,
  RefreshCcw,
} from "lucide-react";

import { useOptimisticRecordings } from "../hooks/useOptimisticRecordings";
import { uploadQueueManager, QueueItem } from "../lib/uploadQueue";
import { downloadRecordingDirectly } from "../lib/downloadHelper";

interface AudioLibraryViewProps {
  books?: Book[];
  recordings: AudioRecording[];
  pendingUploads?: Record<string, { progress: number; workflowStatus: string }>;
  onPlayAudio: (rec: AudioRecording) => void;
  onRecordingsUpdated?: (updated: AudioRecording[]) => void;
  preselectedBookTitle?: string;
  currentUser?: User | null;
  theme: ThemeMode;
}

export const AudioLibraryView: React.FC<AudioLibraryViewProps> = ({
  books = [],
  recordings,
  pendingUploads = {},
  onPlayAudio,
  onRecordingsUpdated,
  preselectedBookTitle,
  currentUser,
  theme,
}) => {
  const [selectedBookView, setSelectedBookView] = useState<string | null>(
    preselectedBookTitle || null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [deletingRecording, setDeletingRecording] =
    useState<AudioRecording | null>(null);
  const [selectedRecIds, setSelectedRecIds] = useState<string[]>([]);
  const [showBatchDeleteModal, setShowBatchDeleteModal] =
    useState<boolean>(false);

  const [uploadQueue, setUploadQueue] = useState<QueueItem[]>([]);
  useEffect(() => {
    const unsubscribe = uploadQueueManager.subscribe(setUploadQueue);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (preselectedBookTitle) {
      setSelectedBookView(preselectedBookTitle);
    }
  }, [preselectedBookTitle]);

  // Auditor Request Re-record state
  const [reRecordModalRec, setReRecordModalRec] =
    useState<AudioRecording | null>(null);
  const [reRecordReason, setReRecordReason] = useState<string>("");
  const [invalidLinks, setInvalidLinks] = useState<Record<string, boolean>>({});
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [fixingLink, setFixingLink] = useState<string | null>(null);

  // Link Validation Logic
  useEffect(() => {
    let isMounted = true;
    const validateLinks = async () => {
      if (!recordings || recordings.length === 0) return;
      setIsValidating(true);
      const newInvalids: Record<string, boolean> = {};

      // Only validate a subset to avoid network overload (e.g., first 20)
      const toValidate = recordings.slice(0, 20);

      for (const rec of toValidate) {
        const url = rec.masteredUrl || rec.rawUrl || rec.rawUrl;
        if (!url) continue;

        try {
          // If it's our backend or firebase, HEAD might work
          const res = await apiFetch(url, {
            method: "HEAD",
            cache: "no-cache",
          }).catch(() => null);
          if (
            res &&
            (res.status >= 400 || (res as any).workflowStatus >= 400)
          ) {
            newInvalids[rec.id] = true;
          }
        } catch (e) {
          // CORS or other errors might happen, assume valid if fetch fails due to CORS
        }
      }

      if (isMounted) {
        setInvalidLinks(newInvalids);
        setIsValidating(false);
      }
    };

    validateLinks();
    return () => {
      isMounted = false;
    };
  }, [recordings]);

  const handleFixLink = async (rec: AudioRecording) => {
    setFixingLink(rec.id);
    try {
      const { toastStore } = await import("../lib/toastStore");
      let newUrl = "";

      if (rec.rawDriveFileId) {
        newUrl = `/api/audio/${rec.rawDriveFileId}`;
      } else if (rec.rawUrl) {
        const matchId =
          rec.rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
          rec.rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
          rec.rawUrl.match(/open\?id=([a-zA-Z0-9_-]+)/);
        if (matchId && matchId[1]) {
          newUrl = `/api/audio/${matchId[1]}`;
        } else {
          newUrl = `https://docs.google.com/uc?export=download&id=root&file=${encodeURIComponent(rec.rawUrl)}`;
        }
      } else {
        const sanitized = (rec.rawUrl || "audio.mp3").replace(
          /[^a-zA-Z0-9._-]/g,
          "_",
        );
        newUrl = `/api/local-audio/${encodeURIComponent(`${rec.id}_${sanitized}`)}`;
      }

      await handleUpdate(
        rec.id,
        {
          rawUrl: newUrl,
        },
        "النظام",
      );
      toastStore.addToast({
        type: "success",
        title: "تم الإصلاح",
        message: "تم تحديث وإصلاح مسار الرابط بنجاح.",
      });
      setInvalidLinks((prev) => ({ ...prev, [rec.id]: false }));
    } catch (e: any) {
      console.error(e);
      const { toastStore } = await import("../lib/toastStore");
      toastStore.addToast({
        type: "error",
        title: "فشل الإصلاح",
        message: e.message || "تعذر إصلاح الرابط.",
      });
    }
    setFixingLink(null);
  };

  const [alertNotice, setAlertNotice] = useState<string>("");

  const isAuditor = Boolean(
    currentUser?.can_qa_review ||
    currentUser?.role === "QA_REVIEWER" ||
    currentUser?.is_super_admin ||
    currentUser?.name?.includes("منى"),
  );

  const { handleDelete, handleUpdate, handleBatchDelete } =
    useOptimisticRecordings(
      recordings,
      onRecordingsUpdated || (() => {}),
      currentUser,
      setAlertNotice,
    );

  const confirmDeleteRec = () => {
    if (!deletingRecording) return;
    const id = deletingRecording.id;
    setDeletingRecording(null);
    handleDelete(id);
  };

  const handleConfirmReRecord = async () => {
    if (!reRecordModalRec) return;

    await handleUpdate(
      reRecordModalRec.id,
      {
        workflowStatus: "NARRATOR_REVISION_REQUIRED",
        qaNotes:
          reRecordReason.trim() ||
          "طلب إعادة تسجيل بسبب ملاحظات مراقبة الجودة والتدقيق",
        qaReviewedBy: currentUser?.name || "مراقب الجودة (منى)",
      },
      "المدقق",
    );

    setAlertNotice(
      `تم تحديث حالة التسجيل لكتاب [${(reRecordModalRec as any).book_title || (reRecordModalRec as any).bookTitle || reRecordModalRec.bookId || "كتاب صوتي"} - الجزء ${reRecordModalRec.partNumber}] إلى (needs_revision) وحفظ التنبيه في Firestore!`,
    );
    setReRecordModalRec(null);
    setReRecordReason("");
  };

  const handleSelectRec = (id: string) => {
    setSelectedRecIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedRecIds.length === filtered.length && filtered.length > 0) {
      setSelectedRecIds([]);
    } else {
      setSelectedRecIds(filtered.map((r) => r.id));
    }
  };

  const confirmBatchDeleteRecordings = () => {
    if (selectedRecIds.length === 0) return;
    const ids = [...selectedRecIds];
    setSelectedRecIds([]);
    setShowBatchDeleteModal(false);
    handleBatchDelete(ids);
  };

  const statusDisplayMap: Record<string, { label: string; badge: string }> = {
    RAW: {
      label: "تسجيل خام",
      badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    },
    MASTERED: {
      label: "مماستر ومونتاج",
      badge: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    },
    QA_APPROVED: {
      label: "مدقق (QA)",
      badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    },
    FINAL: {
      label: "نسخة نهائية (للجاهز للنشر) ✓",
      badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    },
    QA_REJECTED: {
      label: "طلب إعادة تسجيل ⚠️",
      badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    },
    needs_revision: {
      label: "طلب إعادة تسجيل (needs_revision) ⚠️",
      badge: "bg-rose-500/15 text-rose-400 border-rose-500/30 font-bold",
    },
  };

  const isRecordingInBook = (r: AudioRecording, book: Book) => {
    if (!r || !book) return false;
    const clean = (s?: string) => (s || "").trim().toLowerCase();
    const rBookId = clean(r.bookId);
    const rBookTitle = clean(r.book_title || (r as any).title);
    const bTitle = clean(book.title);
    const bId = clean(book.id);

    // Exact ID or exact Title match
    if (rBookId === bId || rBookId === bTitle) return true;
    if (rBookTitle === bTitle || rBookTitle === bId) return true;

    // Distinguish "الفصل الثاني" / Chapter 2 from Chapter 1
    const rIsCh2 = rBookTitle.includes("الثاني") || rBookId.includes("الثاني");
    const bIsCh2 = bTitle.includes("الثاني") || bId.includes("الثاني");
    if (rIsCh2 !== bIsCh2) return false;

    return (
      (bTitle && rBookId && bTitle.includes(rBookId)) ||
      (bTitle && rBookTitle && bTitle.includes(rBookTitle)) ||
      (rBookTitle && bTitle && rBookTitle.includes(bTitle)) ||
      (rBookId && bTitle && rBookId.includes(bTitle))
    );
  };

  // Deduplicate books by trimmed title so no duplicate book cards appear
  const uniqueBooksMap = new Map<string, Book>();
  for (const b of books || []) {
    const key = (b.title || "").trim();
    const existing = uniqueBooksMap.get(key);
    if (!existing) {
      uniqueBooksMap.set(key, b);
    } else {
      if (
        (b.total_parts || 0) > (existing.total_parts || 0) ||
        (existing.author === "." && b.author !== ".")
      ) {
        uniqueBooksMap.set(key, b);
      }
    }
  }

  const displayedBooks = Array.from(uniqueBooksMap.values()).filter(
    (b) =>
      (b.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.author || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const orphanedRecordings = (recordings || [])
    .filter((r) => r && r.id && typeof r.id === "string")
    .filter((r) => !books.some((b) => isRecordingInBook(r, b)));

  const filtered = (recordings || [])
    .filter((r) => r && r.id && typeof r.id === "string")
    .filter((r) => {
      if (selectedBookView) {
        if (selectedBookView === "___all___") {
          // Show all recordings
        } else if (selectedBookView === "___orphaned___") {
          if (books.some((b) => isRecordingInBook(r, b))) return false;
        } else {
          const targetBook = books.find(
            (b) => b.title === selectedBookView || b.id === selectedBookView,
          );
          if (targetBook) {
            if (!isRecordingInBook(r, targetBook)) return false;
          } else {
            const clean = (s?: string) => (s || "").trim().toLowerCase();
            const sv = clean(selectedBookView);
            const rId = clean(r.bookId);
            const rTitle = clean(r.book_title || (r as any).title);

            const rIsCh2 = rTitle.includes("الثاني") || rId.includes("الثاني");
            const svIsCh2 = sv.includes("الثاني");
            if (rIsCh2 !== svIsCh2) return false;

            if (
              rId !== sv &&
              rTitle !== sv &&
              !rTitle.includes(sv) &&
              !sv.includes(rTitle)
            ) {
              return false;
            }
          }
        }
      }
      const matchesSearch =
        (r.bookId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.book_title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.narratorId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.narrator_name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (r.rawUrl || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.file_name || "").toLowerCase().includes(searchTerm.toLowerCase());

      const rStatus = String(r.status || r.workflowStatus || "").toUpperCase();
      const rWorkflow = String(
        r.workflowStatus || r.status || "",
      ).toUpperCase();
      const fStatus = String(filterStatus || "ALL").toUpperCase();

      const matchesStatus =
        fStatus === "ALL" ||
        rWorkflow === fStatus ||
        rStatus === fStatus ||
        (fStatus === "MASTERED" &&
          (rStatus === "MASTERED" ||
            rWorkflow === "MASTERED" ||
            rWorkflow === "FINAL" ||
            rWorkflow === "FINAL_APPROVED")) ||
        (fStatus === "RAW_QA_PENDING" &&
          (rStatus === "RAW" ||
            rWorkflow === "RAW_QA_PENDING" ||
            rWorkflow === "RAW")) ||
        (fStatus === "RAW" &&
          (rStatus === "RAW" ||
            rWorkflow === "RAW" ||
            rWorkflow === "RAW_QA_PENDING")) ||
        (fStatus === "QA_APPROVED" &&
          (rStatus === "QA_APPROVED" ||
            rWorkflow === "QA_APPROVED" ||
            rWorkflow === "RAW_APPROVED"));

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const partA = Number(a.partNumber ?? a.part_number ?? 0);
      const partB = Number(b.partNumber ?? b.part_number ?? 0);
      return partA - partB;
    });

  return (
    <div className="space-y-6 dir-rtl">
      {/* Upload Queue Active Banner */}
      {uploadQueue.length > 0 && (
        <div className="p-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-blue-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center shrink-0">
              <CloudUpload className="w-5 h-5 text-blue-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-blue-300 flex items-center gap-2">
                <span>طابور الرفع السحابي النشط</span>
                <span className="text-[11px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/40 font-mono">
                  {
                    uploadQueue.filter((q) => q.workflowStatus === "uploading")
                      .length
                  }{" "}
                  قيد الرفع |{" "}
                  {
                    uploadQueue.filter((q) => q.workflowStatus === "failed")
                      .length
                  }{" "}
                  متعثر
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                تتم عمليات الرفع والمزامنة في الخلفية. التسجيلات المتعثرة بسبب
                انقطاع الإنترنت يُعاد جدولتها تلقائياً (Auto-retry).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {uploadQueue.some((q) => q.workflowStatus === "failed") && (
              <button
                onClick={() => uploadQueueManager.resumeAll()}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة محاولة جميع المتعثرات</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div
        className={`p-6 rounded-2xl border transition-all ${
          theme === "dark"
            ? "bg-slate-900/90 border-slate-800"
            : "bg-white border-slate-200 shadow-sm"
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {selectedBookView ? (
              <button
                onClick={() => setSelectedBookView(null)}
                className="w-10 h-10 rounded-xl bg-slate-800/50 hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Headphones className="w-5 h-5 text-amber-400" />
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
                {selectedBookView === "___all___"
                  ? "جميع تسجيلات المنصة (كل المقاطع)"
                  : selectedBookView === "___orphaned___"
                    ? "تسجيلات بدون كتاب (معلقة)"
                    : selectedBookView
                      ? `تسجيلات كتاب: ${selectedBookView}`
                      : "المكتبة الصوتية والأرشيف الرقمي"}
                {selectedBookView && (
                  <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                    {filtered.length} تسجيل
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                {selectedBookView === "___all___"
                  ? "استماع وتصفح لجميع المقاطع المسجلة والمرفوعة في المنصة"
                  : selectedBookView
                    ? "استماع لجميع مقاطع هذا الكتاب مرتبة حسب الأجزاء"
                    : "اختر كتاباً لعرض المقاطع والملفات الصوتية المقسمة الخاصة به"}
              </p>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  selectedBookView
                    ? "ابحث باسم الراوي أو الملف..."
                    : "ابحث باسم الكتاب أو المؤلف..."
                }
                className={`w-full pr-9 pl-3 py-2 rounded-xl text-xs border font-medium focus:outline-none focus:ring-2 ${
                  theme === "dark"
                    ? "bg-slate-950 border-slate-800 text-white focus:ring-amber-500"
                    : "bg-white border-slate-300 focus:ring-amber-500"
                }`}
              />
            </div>

            {selectedBookView && (
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={`px-3 py-2 rounded-xl text-xs border font-bold focus:outline-none ${
                  theme === "dark"
                    ? "bg-slate-950 border-slate-800 text-amber-400"
                    : "bg-white border-slate-300 text-amber-600"
                }`}
              >
                <option value="ALL">جميع الحالات ({recordings.length})</option>
                <option value="RAW_QA_PENDING">🎙️ تسجيل خام (RAW)</option>
                <option value="MASTERING">🎛️ مماستر (MASTERED)</option>
                <option value="RAW_APPROVED">✨ مدقق (QA)</option>
                <option value="PUBLISHED">🚀 نسخة نهائية (FINAL)</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {!selectedBookView ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
          {/* Card: All Recordings In Platform */}
          <div
            onClick={() => {
              setSelectedBookView("___all___");
              setSearchTerm("");
            }}
            className={`p-5 rounded-2xl border transition-all cursor-pointer group hover:-translate-y-1 ${
              theme === "dark"
                ? "bg-gradient-to-br from-amber-500/15 via-slate-900/90 to-slate-900 border-amber-500/30 hover:border-amber-400 hover:shadow-[0_8px_30px_rgba(245,158,11,0.15)]"
                : "bg-gradient-to-br from-amber-50 via-white to-white border-amber-300 hover:border-amber-500 hover:shadow-xl"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="p-3 rounded-xl bg-amber-500 shadow-lg shadow-amber-500/20 flex items-center justify-center">
                <Headphones className="w-6 h-6 text-slate-950 font-bold" />
              </div>
              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 shadow-sm">
                {(recordings || []).length} تسجيل كلي
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-amber-400 group-hover:text-amber-300 transition-colors mb-1">
              جميع تسجيلات المنصة 🎧
            </h3>
            <p className="text-xs text-slate-400 mb-3 font-medium leading-relaxed">
              عرض واستماع لكافة المقاطع الصوتية المسجلة في النظام مع خيارات
              التصفية والتشغيل المباشر.
            </p>
            <div className="flex items-center justify-between text-[11px] text-amber-400 font-bold pt-2 border-t border-amber-500/20">
              <span>تصفح الكل</span>
              <ChevronRight className="w-4 h-4 rotate-180" />
            </div>
          </div>

          {displayedBooks.map((book, index) => {
            const bookRecordingsCount = (recordings || [])
              .filter((r) => r && r.id && typeof r.id === "string")
              .filter((r) => isRecordingInBook(r, book)).length;
            return (
              <div
                key={book.id || `book-${index}`}
                onClick={() => {
                  setSelectedBookView(book.title);
                  setSearchTerm("");
                }}
                className={`p-5 rounded-2xl border transition-all cursor-pointer group hover:-translate-y-1 ${
                  theme === "dark"
                    ? "bg-slate-900/80 border-slate-800 hover:border-amber-500/50 hover:shadow-[0_8px_30px_rgba(245,158,11,0.1)]"
                    : "bg-white border-slate-200 hover:border-amber-500/50 hover:shadow-xl"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`p-3 rounded-xl bg-gradient-to-br ${book.cover_color} shadow-lg flex items-center justify-center`}
                  >
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    {bookRecordingsCount} تسجيل
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-200 group-hover:text-amber-400 transition-colors mb-1 line-clamp-2">
                  {book.title}
                </h3>
                <p className="text-xs text-slate-500 mb-4 line-clamp-1">
                  {book.author}
                </p>
                <div className="w-full bg-slate-800/50 rounded-full h-1.5 overflow-hidden mb-2">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{
                      width: `${(book.completed_parts / book.total_parts) * 100}%`,
                    }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span>
                    تم إنجاز {book.completed_parts} من {book.total_parts}
                  </span>
                  <span>
                    {Math.round(
                      (book.completed_parts / book.total_parts) * 100,
                    )}
                    %
                  </span>
                </div>
              </div>
            );
          })}
          {displayedBooks.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-500">
              <BookOpen className="w-12 h-12 mb-3 opacity-20" />
              <p>لا توجد كتب مطابقة للبحث</p>
            </div>
          )}

          {orphanedRecordings.length > 0 && (
            <div
              onClick={() => {
                setSelectedBookView("___orphaned___");
                setSearchTerm("");
              }}
              className={`p-5 rounded-2xl border transition-all cursor-pointer group hover:-translate-y-1 ${
                theme === "dark"
                  ? "bg-rose-900/20 border-rose-800 hover:border-rose-500/50 hover:shadow-[0_8px_30px_rgba(225,29,72,0.1)]"
                  : "bg-rose-50 border-rose-200 hover:border-rose-500/50 hover:shadow-xl"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 shadow-lg flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  {orphanedRecordings.length} تسجيل
                </span>
              </div>
              <h3
                className={`text-sm font-bold group-hover:text-rose-400 transition-colors mb-1 line-clamp-2 ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}
              >
                ملفات معلقة (بدون كتاب)
              </h3>
              <p
                className={`text-[11px] font-medium ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
              >
                هذه الملفات رُفعت بدون تحديد كتاب، يمكنك النقر هنا لرؤيتها أو
                حذفها.
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Batch Selection Toolbar */}
          {filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t border-slate-800/60 text-xs">
              <button
                onClick={handleSelectAllFiltered}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all cursor-pointer"
              >
                {selectedRecIds.length === filtered.length &&
                filtered.length > 0 ? (
                  <>
                    <CheckSquare className="w-4 h-4 text-amber-400" />
                    <span>إلغاء تحديد الكل ({selectedRecIds.length})</span>
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4 text-slate-400" />
                    <span>
                      تحديد جميع التسجيلات المعروضة ({filtered.length})
                    </span>
                  </>
                )}
              </button>

              {selectedRecIds.length > 0 && (
                <button
                  onClick={() => setShowBatchDeleteModal(true)}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold shadow-lg shadow-rose-600/30 transition-all cursor-pointer animate-pulse"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>
                    حذف المقاطع المحددة ({selectedRecIds.length} تسجيل)
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Alert Notice Banner */}
          {alertNotice && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="font-bold">{alertNotice}</span>
              </div>
              <button
                onClick={() => setAlertNotice("")}
                className="text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 text-[10px]"
              >
                إغلاق
              </button>
            </div>
          )}

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 text-slate-400 space-y-2">
              <Headphones className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-bold">
                لا توجد تسجيلات مطابقة للبحث الحالي
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((rec, index) => {
                const statusInfo = statusDisplayMap[rec.workflowStatus] || {
                  label: rec.workflowStatus,
                  badge: "bg-slate-800 text-slate-300",
                };
                const isSelected = selectedRecIds.includes(rec.id);

                return (
                  <div
                    key={rec.id || `rec-${index}`}
                    className={`p-5 rounded-2xl border transition-all space-y-3 relative overflow-hidden ${
                      isSelected
                        ? "ring-2 ring-amber-500 bg-amber-500/5 border-amber-500/50"
                        : theme === "dark"
                          ? "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                          : "bg-white border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSelectRec(rec.id)}
                          className="text-slate-400 hover:text-amber-400 cursor-pointer transition-colors"
                          title={
                            isSelected ? "إلغاء التحديد" : "تحديد للحذف الجماعي"
                          }
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-400 fill-amber-500/10" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                          )}
                        </button>
                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-md font-bold border ${statusInfo.badge}`}
                        >
                          {statusInfo.label}
                        </span>
                      </div>

                      {rec.qaRating && (
                        <div className="flex items-center gap-0.5 bg-slate-950/60 px-2 py-0.5 rounded-md border border-slate-800">
                          {Array.from({ length: rec.qaRating }).map((_, i) => (
                            <Star
                              key={i}
                              className="w-3 h-3 text-amber-400 fill-amber-400"
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-amber-400 leading-snug">
                          📖 {rec.book_title || rec.bookId || "تسجيل صوتي"} —{" "}
                          {rec.partNumber === 0
                            ? "كتاب كامل"
                            : `الجزء ${rec.partNumber}`}
                        </h4>
                        {invalidLinks[rec.id] && (
                          <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 w-max">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                            <span className="text-[10px] font-bold text-rose-400">
                              الرابط يبدو معطوباً
                            </span>
                            <button
                              onClick={() => handleFixLink(rec)}
                              disabled={fixingLink === rec.id}
                              className="flex items-center gap-1 px-2 py-0.5 bg-rose-500 text-white rounded text-[10px] hover:bg-rose-600 disabled:opacity-50"
                            >
                              {fixingLink === rec.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RefreshCcw className="w-3 h-3" />
                              )}
                              إصلاح
                            </button>
                          </div>
                        )}
                        {(() => {
                          const queueItem = uploadQueue.find(
                            (q) => q.recId === rec.id,
                          );
                          const isPending = pendingUploads[rec.id];

                          if (!queueItem && !isPending) {
                            if (
                              rec.rawDriveFileId ||
                              (rec as any).driveFileId
                            ) {
                              return (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Google Drive</span>
                                </div>
                              );
                            }
                            if (rec.rawUrl?.includes("/api/local-audio/")) {
                              return (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>محلي مؤقت</span>
                                </div>
                              );
                            }
                            return null;
                          }

                          const progress = queueItem
                            ? queueItem.progress
                            : isPending?.progress || 0;
                          const workflowStatus = queueItem
                            ? queueItem.workflowStatus
                            : "uploading";
                          const errorMsg = queueItem?.error;

                          return (
                            <div className="flex flex-col items-end gap-1.5 w-full sm:w-56 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                              <div className="flex items-center justify-between w-full text-[11px] font-bold">
                                <div className="flex items-center gap-1.5">
                                  {workflowStatus === "uploading" && (
                                    <span className="text-blue-400 flex items-center gap-1">
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      <span>جاري الرفع...</span>
                                    </span>
                                  )}
                                  {workflowStatus === "failed" && (
                                    <span className="text-rose-400 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" />
                                      <span>تعثر الرفع مؤقتاً</span>
                                    </span>
                                  )}
                                  {workflowStatus === "paused" && (
                                    <span className="text-amber-400 flex items-center gap-1">
                                      <Pause className="w-3 h-3" />
                                      <span>متوقف مؤقتاً</span>
                                    </span>
                                  )}
                                  {workflowStatus === "success" && (
                                    <span className="text-emerald-400 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>مكتمل 100%</span>
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-slate-300 font-bold">
                                  {progress}%
                                </span>
                              </div>

                              {/* Dedicated Progress Bar */}
                              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden relative">
                                <div
                                  className={`h-full transition-all durationSeconds-300 rounded-full ${
                                    workflowStatus === "failed"
                                      ? "bg-rose-500"
                                      : workflowStatus === "success"
                                        ? "bg-emerald-500"
                                        : "bg-gradient-to-r from-blue-500 to-amber-500"
                                  }`}
                                  style={{ width: `${Math.max(5, progress)}%` }}
                                />
                              </div>

                              {workflowStatus === "failed" && (
                                <div className="w-full space-y-1.5 mt-1">
                                  <div className="text-[10px] text-amber-300/90 flex items-center justify-between">
                                    <span>المحاولة القادمة (Auto-retry):</span>
                                    <span className="font-bold text-amber-400">
                                      تلقائياً خلال 5د
                                    </span>
                                  </div>
                                  {errorMsg && (
                                    <p
                                      className="text-[9px] text-rose-300/80 truncate dir-ltr text-right"
                                      title={errorMsg}
                                    >
                                      {errorMsg}
                                    </p>
                                  )}
                                  <button
                                    onClick={() =>
                                      uploadQueueManager.retryItemByRecId(
                                        rec.id,
                                      )
                                    }
                                    className="flex items-center justify-center w-full gap-1.5 text-[10px] font-bold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 py-1.5 px-2 border border-rose-500/40 rounded-lg transition-all shadow-sm cursor-pointer"
                                    title={`إعادة المحاولة للتسجيل ${rec.id}`}
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>
                                      إعادة المحاولة الآن ({rec.id.slice(-6)})
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                        <span>
                          الراوي:{" "}
                          <strong className="text-slate-200">
                            {rec.narratorId}
                          </strong>
                        </span>
                        {rec.durationSeconds && (
                          <span className="font-mono text-[10px] text-slate-500">
                            {rec.durationSeconds}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="font-mono text-[11px] text-slate-400 bg-slate-950 p-2 rounded-xl border border-slate-800/80 dir-ltr text-right truncate">
                      {rec.masteredUrl ||
                        rec.rawUrl ||
                        (rec as any).file_url ||
                        (rec as any).mastered_file_url ||
                        (rec.rawDriveFileId || (rec as any).drive_file_id
                          ? `/api/audio/${rec.rawDriveFileId || (rec as any).drive_file_id}`
                          : "ملف صوتي سحابي")}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800/50">
                      <button
                        onClick={() => onPlayAudio(rec)}
                        className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>تشغيل</span>
                      </button>

                      {(rec.masteredUrl ||
                        rec.rawUrl ||
                        (rec as any).file_url ||
                        (rec as any).mastered_file_url ||
                        rec.rawDriveFileId ||
                        (rec as any).drive_file_id) && (
                        <button
                          onClick={() => downloadRecordingDirectly(rec)}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition-colors cursor-pointer"
                          title="تحميل الملف"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isAuditor && (
                        <button
                          onClick={() => setReRecordModalRec(rec)}
                          className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                          title="طلب إعادة تسجيل (للمدققين فقط)"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => setDeletingRecording(rec)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700 transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Delete Recording Confirmation Modal */}
          {deletingRecording && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
              <div className="w-full max-w-md p-6 rounded-3xl border border-rose-500/40 bg-slate-900 text-white shadow-2xl space-y-4">
                <div className="flex items-center gap-3 text-rose-400">
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">
                      حذف التسجيل الصوتي
                    </h3>
                    <p className="text-xs text-rose-300">
                      تأكيد عملية حذف الملف بشكل نهائي
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                  هل أنت متأكد حتماً من حذف هذا التسجيل لكتاب{" "}
                  <strong className="text-amber-400">
                    "{""}" —{" "}
                    {deletingRecording.partNumber === 0
                      ? "كتاب كامل"
                      : `الجزء ${deletingRecording.partNumber}`}
                  </strong>{" "}
                  بصوت الراوي{" "}
                  <span className="text-slate-100">
                    {deletingRecording.narratorId}
                  </span>
                  ؟
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={confirmDeleteRec}
                    className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30 cursor-pointer transition-all"
                  >
                    نعم، أكد حذف المقطع
                  </button>
                  <button
                    onClick={() => setDeletingRecording(null)}
                    className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Batch Delete Confirmation Modal */}
          {showBatchDeleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
              <div className="w-full max-w-md p-6 rounded-3xl border border-rose-500/40 bg-slate-900 text-white shadow-2xl space-y-4">
                <div className="flex items-center gap-3 text-rose-400">
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">
                      حذف جماعي للتسجيلات ({selectedRecIds.length})
                    </h3>
                    <p className="text-xs text-rose-300">
                      مسح المقاطع الصوتية المحددة نهائياً
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                  هل أنت متأكد حتماً من حذف{" "}
                  <strong className="text-amber-400 font-bold">
                    {selectedRecIds.length}
                  </strong>{" "}
                  تسجيلات صوتية تم تحديدها نهائياً من المكتبة الصوتية؟
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={confirmBatchDeleteRecordings}
                    className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30 cursor-pointer transition-all"
                  >
                    نعم، أكد حذف التسجيلات المحددة
                  </button>
                  <button
                    onClick={() => setShowBatchDeleteModal(false)}
                    className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Auditor Request Re-record Modal */}
          {reRecordModalRec && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
              <div className="w-full max-w-lg p-6 rounded-3xl border border-rose-500/40 bg-slate-900 text-white shadow-2xl space-y-4">
                <div className="flex items-center gap-3 text-rose-400">
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                    <RotateCcw className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      <span>طلب إعادة تسجيل (Auditor Review)</span>
                      <span className="text-[10px] bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30 font-mono">
                        needs_revision
                      </span>
                    </h3>
                    <p className="text-xs text-rose-300">
                      إشعار الراوي بإعادة التسجيل بسبب ملاحظات التدقيق والجودة
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                  <div>
                    كتاب:{" "}
                    <strong className="text-amber-400">
                      {""} —{" "}
                      {reRecordModalRec.partNumber === 0
                        ? "كتاب كامل"
                        : `الجزء ${reRecordModalRec.partNumber}`}
                    </strong>
                  </div>
                  <div>
                    الراوي المكلف:{" "}
                    <span className="text-slate-200 font-bold">
                      {reRecordModalRec.narratorId}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>أسباب وملاحظات طلب إعادة التسجيل (تظهر للراوي):</span>
                  </label>
                  <textarea
                    value={reRecordReason}
                    onChange={(e) => setReRecordReason(e.target.value)}
                    placeholder="أدخل ملاحظات الجودة، مثل: نطق المخارج غير واضح، وجود تشويش بالخلفية، خطأ في قراءة صفحة معينة..."
                    rows={3}
                    className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleConfirmReRecord}
                    className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30 cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>تأكيد طلب إعادة التسجيل وتحديث Firestore</span>
                  </button>
                  <button
                    onClick={() => setReRecordModalRec(null)}
                    className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
