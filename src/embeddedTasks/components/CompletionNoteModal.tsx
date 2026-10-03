// @ts-nocheck
import React, { useState } from "react";
import { CheckCircle2, MessageSquare, X } from "lucide-react";

interface CompletionNoteModalProps {
  isOpen: boolean;
  taskTitle: string;
  onClose: () => void;
  onConfirm: (note: string) => void;
}

export const CompletionNoteModal: React.FC<CompletionNoteModalProps> = ({
  isOpen,
  taskTitle,
  onClose,
  onConfirm,
}) => {
  const [note, setNote] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(note.trim());
    setNote("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm font-['Cairo'] animate-in fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-2xl space-y-4 text-right">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              تسليم المهمة وإضافة ملاحظة
            </h3>
            <p className="text-xs text-slate-400 line-clamp-1">{taskTitle}</p>
          </div>
        </div>

        {/* Note Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>ملاحظة تسليم الشغل للإدارة (اختياري):</span>
            </label>
            <textarea
              rows={3}
              placeholder="اكتب توضيحاً للإدارة (مثال: تم رفع ملف الصوت المحسّن في مجلد Drive بدقة عالية، تم تعديل الفصل الثاني...)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              تأكيد وتسليم العمل
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
