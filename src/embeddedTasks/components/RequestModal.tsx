// @ts-nocheck
import React, { useState } from "react";
import { UserSession, UserSubmitRequest, RequestType } from "../types";
import { X, Send, AlertCircle, MessageSquare, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSession | null;
  onSubmit: (
    request: Omit<
      UserSubmitRequest,
      "id" | "createdAt" | "status" | "adminReply"
    >,
  ) => void;
}

export const RequestModal: React.FC<RequestModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSubmit,
}) => {
  const [type, setType] = useState<RequestType>("طلب");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");

  if (!isOpen || !currentUser) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !details.trim()) return;

    onSubmit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.roleName,
      departmentName: currentUser.departmentName,
      type,
      title: title.trim(),
      details: details.trim(),
    });

    // Reset form
    setType("طلب");
    setTitle("");
    setDetails("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-['Cairo']"
          dir="rtl"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-100">
                    تقديم طلب أو إبلاغ
                  </h2>
                  <p className="text-xs text-slate-400">
                    سيتم مراجعته من قبل الإدارة
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-6 overflow-y-auto"
            >
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-300 block">
                  نوع الطلب
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["طلب", "اعتراض", "إبلاغ"] as RequestType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`py-2 rounded-xl border text-sm font-bold transition-all ${
                        type === t
                          ? "bg-amber-500/10 border-amber-500/50 text-amber-500"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      {t === "إبلاغ" && (
                        <ShieldAlert className="w-4 h-4 inline-block ml-1" />
                      )}
                      {t === "اعتراض" && (
                        <AlertCircle className="w-4 h-4 inline-block ml-1" />
                      )}
                      {t === "طلب" && (
                        <MessageSquare className="w-4 h-4 inline-block ml-1" />
                      )}
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-300 block">
                  العنوان / الموضوع
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: طلب تغيير القسم، اعتراض على التقييم..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-300 block">
                  التفاصيل والأسباب
                </label>
                <textarea
                  required
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="يرجى كتابة كافة التفاصيل التي تساعدنا في مراجعة طلبك بوضوح..."
                  rows={5}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-amber-500 transition-colors resize-none placeholder:text-slate-600 leading-relaxed"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!title.trim() || !details.trim()}
                  className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>إرسال للإدارة</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
