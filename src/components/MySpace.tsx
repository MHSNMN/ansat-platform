import React from "react";
import { User, Book, AudioRecording, ThemeMode } from "../types";
import {
  BookOpen,
  Mic,
  CheckCircle,
  Clock,
  AlertCircle,
  Sparkles,
  Activity,
} from "lucide-react";

interface MySpaceProps {
  currentUser: User;
  books: Book[];
  recordings: AudioRecording[];
  theme: ThemeMode;
  onNavigate: (tab: any, bookTitle?: string) => void;
}

export const MySpace: React.FC<MySpaceProps> = ({
  currentUser,
  books,
  recordings,
  theme,
  onNavigate,
}) => {
  const isNarrator = currentUser.can_upload_raw;
  const isReviewer = currentUser.can_qa_review;
  const isEngineer = currentUser.can_master_audio;

  const identityMatches = (value?: string) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    if (!normalized) return false;
    const myId = String(currentUser.id || "")
      .trim()
      .toLowerCase();
    const myName = String(currentUser.name || "")
      .trim()
      .toLowerCase();
    const myEmail = String(currentUser.email || "")
      .trim()
      .toLowerCase();
    const myUsername = String(currentUser.username || "")
      .trim()
      .toLowerCase();

    return (
      normalized === myId ||
      normalized === myName ||
      normalized === myEmail ||
      normalized === myUsername ||
      (myName.length > 2 &&
        (normalized.includes(myName) || myName.includes(normalized))) ||
      (myUsername.length > 2 &&
        (normalized.includes(myUsername) || myUsername.includes(normalized)))
    );
  };

  // Narrator Tasks: Books assigned to them
  const myBooks = books.filter(
    (b) => b.assigned_narrators && b.assigned_narrators.some(identityMatches),
  );

  // Reviewer Tasks: Recordings waiting for QA
  const pendingQA = recordings.filter(
    (r) => r.workflowStatus === "RAW_QA_PENDING",
  );

  // Engineer Tasks: Recordings waiting for Mastering
  const pendingMastering = recordings.filter(
    (r) =>
      r.workflowStatus === "RAW_APPROVED" || r.workflowStatus === "PUBLISHED",
  );

  // Revisions Tasks:
  const myRevisions = recordings.filter(
    (r) =>
      identityMatches(r.narratorId) &&
      r.workflowStatus === "NARRATOR_REVISION_REQUIRED",
  );

  const myTotalRecordings = recordings.filter((r) =>
    identityMatches(r.narratorId),
  ).length;
  const myApprovedRecordings = recordings.filter(
    (r) =>
      identityMatches(r.narratorId) &&
      (r.workflowStatus === "RAW_APPROVED" ||
        r.workflowStatus === "PUBLISHED" ||
        r.workflowStatus === "MASTERING"),
  ).length;
  const myRejectionRate =
    myTotalRecordings > 0
      ? ((myRevisions.length / myTotalRecordings) * 100).toFixed(0)
      : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 durationSeconds-500">
      {/* Welcome Banner */}
      <div
        className={`p-8 rounded-3xl border relative overflow-hidden flex items-center justify-between ${
          theme === "dark"
            ? "bg-gradient-to-l from-indigo-950/40 to-slate-900 border-indigo-500/20"
            : "bg-gradient-to-l from-indigo-50 to-white border-indigo-100 shadow-sm"
        }`}
      >
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold mb-2 tracking-tight flex items-center gap-3">
            مرحباً بك، {currentUser.name}
            <Sparkles className="w-6 h-6 text-amber-500" />
          </h1>
          <p
            className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
          >
            مساحتك الشخصية لمتابعة مهامك اليومية كـ (
            {currentUser.role_display_ar}).
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      {isNarrator && (
        <div className="grid grid-cols-3 gap-4">
          <div
            className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center ${theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-200"}`}
          >
            <Mic className="w-5 h-5 text-indigo-400 mb-2" />
            <span className="text-2xl font-bold">{myTotalRecordings}</span>
            <span className="text-[10px] opacity-70">
              إجمالي المقاطع المرفوعة
            </span>
          </div>
          <div
            className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center ${theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-200"}`}
          >
            <CheckCircle className="w-5 h-5 text-emerald-400 mb-2" />
            <span className="text-2xl font-bold">{myApprovedRecordings}</span>
            <span className="text-[10px] opacity-70">
              المقاطع المعتمدة (جودة)
            </span>
          </div>
          <div
            className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center ${theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-200"}`}
          >
            <Clock className="w-5 h-5 text-rose-400 mb-2" />
            <span className="text-2xl font-bold">{myRejectionRate}%</span>
            <span className="text-[10px] opacity-70">نسبة الملاحظات</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Narrator Tasks */}
        {isNarrator && (
          <>
            <div
              className={`p-6 rounded-3xl border flex flex-col ${theme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">كتبي المخصصة</h3>
                  <p className="text-xs opacity-70">
                    {myBooks.length} كتب مخصصة لك
                  </p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-60 custom-scrollbar">
                {myBooks.length === 0 ? (
                  <p className="text-sm opacity-50 text-center py-4">
                    لا توجد كتب مخصصة لك حالياً
                  </p>
                ) : (
                  myBooks.map((book) => {
                    const completed = recordings.filter(
                      (r) =>
                        r.bookId === book.title &&
                        r.narratorId === currentUser.name &&
                        r.workflowStatus !== "NARRATOR_REVISION_REQUIRED",
                    ).length;
                    return (
                      <div
                        key={book.id}
                        onClick={() => onNavigate("books")}
                        className={`p-3 rounded-xl border transition-colors cursor-pointer group ${theme === "dark" ? "bg-slate-950 border-slate-800 hover:border-indigo-500/50" : "bg-slate-50 border-slate-200 hover:border-indigo-400"}`}
                      >
                        <h4 className="font-bold text-sm mb-1 group-hover:text-indigo-500 transition-colors">
                          {book.title}
                        </h4>
                        <div className="flex items-center justify-between text-xs opacity-70 mb-2">
                          <span>إنجازك: {completed} مقطع</span>
                          <span>
                            متبقي: {book.total_parts - book.completed_parts}
                          </span>
                        </div>
                        <div className="w-full bg-slate-800/20 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full rounded-full"
                            style={{
                              width: `${Math.min(100, (book.completed_parts / book.total_parts) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div
              className={`p-6 rounded-3xl border flex flex-col ${theme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">تعديلات مطلوبة</h3>
                  <p className="text-xs opacity-70">
                    {myRevisions.length} مقاطع تحتاج تعديل
                  </p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-60 custom-scrollbar">
                {myRevisions.length === 0 ? (
                  <p className="text-sm opacity-50 text-center py-4">
                    رائع! ليس لديك أي مقاطع مرفوضة.
                  </p>
                ) : (
                  myRevisions.map((rev) => (
                    <div
                      key={rev.id}
                      onClick={() => onNavigate("studio", rev.bookId)}
                      className={`p-3 rounded-xl border transition-colors cursor-pointer group ${theme === "dark" ? "bg-slate-950 border-slate-800 hover:border-rose-500/50" : "bg-slate-50 border-slate-200 hover:border-rose-400"}`}
                    >
                      <h4 className="font-bold text-sm mb-1 group-hover:text-rose-500 transition-colors">
                        {rev.bookId} (جـ {rev.partNumber})
                      </h4>
                      <p className="text-xs text-rose-500/80 line-clamp-2 mt-1 bg-rose-500/5 p-2 rounded-lg">
                        {rev.qaNotes || "مرفوضة من قبل المراجع"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* QA Reviewer Tasks */}
        {isReviewer && (
          <div
            className={`p-6 rounded-3xl border flex flex-col ${theme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">بانتظار المراجعة</h3>
                <p className="text-xs opacity-70">
                  {pendingQA.length} مقاطع جاهزة للتدقيق
                </p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-60 custom-scrollbar">
              {pendingQA.length === 0 ? (
                <p className="text-sm opacity-50 text-center py-4">
                  لا توجد مقاطع بانتظار المراجعة حالياً
                </p>
              ) : (
                pendingQA.slice(0, 10).map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => onNavigate("studio")}
                    className={`p-3 rounded-xl border transition-colors cursor-pointer group ${theme === "dark" ? "bg-slate-950 border-slate-800 hover:border-amber-500/50" : "bg-slate-50 border-slate-200 hover:border-amber-400"}`}
                  >
                    <h4 className="font-bold text-sm mb-1 group-hover:text-amber-500 transition-colors">
                      {""} (جـ {rec.partNumber})
                    </h4>
                    <p className="text-xs opacity-70">
                      المعلق: {rec.narratorId}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Engineer Tasks */}
        {isEngineer && (
          <div
            className={`p-6 rounded-3xl border flex flex-col ${theme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">بانتظار المونتاج</h3>
                <p className="text-xs opacity-70">
                  {pendingMastering.length} مقاطع معتمدة
                </p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-60 custom-scrollbar">
              {pendingMastering.length === 0 ? (
                <p className="text-sm opacity-50 text-center py-4">
                  لا توجد مقاطع معتمدة للمونتاج حالياً
                </p>
              ) : (
                pendingMastering.slice(0, 10).map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => onNavigate("studio")}
                    className={`p-3 rounded-xl border transition-colors cursor-pointer group ${theme === "dark" ? "bg-slate-950 border-slate-800 hover:border-emerald-500/50" : "bg-slate-50 border-slate-200 hover:border-emerald-400"}`}
                  >
                    <h4 className="font-bold text-sm mb-1 group-hover:text-emerald-500 transition-colors">
                      {""} (جـ {rec.partNumber})
                    </h4>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-md">
                        معتمدة من الجودة
                      </span>
                      <span className="text-xs opacity-70">
                        {rec.qaRating} نجوم
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
