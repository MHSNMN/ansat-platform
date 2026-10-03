// @ts-nocheck
import React, { useState } from "react";
import { User, AudioRecording, ThemeMode, Book } from "../types";
import {
  Wand2,
  Download,
  Upload,
  FileCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Volume2,
} from "lucide-react";
import { updateRecording } from "../lib/supabaseClient";
import { MasteringUploader } from "./MasteringUploader";
import { uploadQueueManager } from "../lib/uploadQueue";
import { downloadRecordingDirectly } from "../lib/downloadHelper";

interface AudioEngineerStudioProps {
  currentUser: User;
  users: User[];
  books: Book[];
  recordings: AudioRecording[];
  onRecordingsUpdated: (updated: AudioRecording[]) => void;
  theme: ThemeMode;
  onPlayAudio: (rec: AudioRecording) => void;
}

export const AudioEngineerStudio: React.FC<AudioEngineerStudioProps> = ({
  currentUser,
  users,
  books,
  recordings,
  onRecordingsUpdated,
  theme,
  onPlayAudio,
}) => {
  const [activeTab, setActiveTab] = useState<"list" | "batch_upload">("list");
  const [selectedRecForMastering, setSelectedRecForMastering] =
    useState<AudioRecording | null>(null);
  const [masteredFile, setMasteredFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");

  const cleanRecordings =
    recordings?.filter((r) => r && r.id && typeof r.id === "string") || [];
  const rawRecordings = cleanRecordings.filter(
    (r) =>
      r.workflowStatus === "RAW_APPROVED" ||
      r.workflowStatus === "ENGINEER_REVISION_REQUIRED" ||
      r.workflowStatus === "ENGINEER_REVISION_REQUIRED" ||
      r.workflowStatus === "ENGINEER_REVISION_REQUIRED",
  );
  const masteredRecordings = cleanRecordings.filter(
    (r) => r.workflowStatus === "MASTERING" || r.workflowStatus === "PUBLISHED",
  );

  const handleMasteredFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setMasteredFile(e.target.files[0]);
    }
  };

  const handleUploadMasteredSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecForMastering || !masteredFile) return;

    setIsSubmitting(true);
    setSuccessMsg("");

    try {
      const partStr =
        selectedRecForMastering.partNumber < 10
          ? `0${selectedRecForMastering.partNumber}`
          : `${selectedRecForMastering.partNumber}`;

      const autoMasteredFileName = `${selectedRecForMastering.bookId.replace(/\s+/g, "_")}_MASTERED_Part${partStr}_Mahdi.mp3`;
      const initialFileUrl = URL.createObjectURL(masteredFile);

      const updated = await updateRecording(selectedRecForMastering.id, {
        workflowStatus: "MASTERING",
        masteredUrl: initialFileUrl,
        masteredBy: currentUser.name,
      });
      onRecordingsUpdated(updated);

      uploadQueueManager.addItems([
        {
          recId: selectedRecForMastering.id,
          file: masteredFile,
          fileName: autoMasteredFileName,
          bookTitle: selectedRecForMastering.bookId,
          mimeType: masteredFile.type || "audio/mpeg",
          stage: "mastered",
        },
      ]);

      setSuccessMsg(
        `⚡ تم إدراج النسخة المماسترة! جاري المزامنة في الخلفية...`,
      );
      setSelectedRecForMastering(null);
      setMasteredFile(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
                استوديو هندسة الصوت والمونتاج (Mahdi Audio Engineer Studio)
              </h2>
              <p className="text-xs text-slate-400">
                المسؤول عن هندسة ومونتاج التسجيلات الخام: {currentUser.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://drive.google.com/drive/my-drive"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-2 transition-all shadow-md"
            >
              <span>مجلد Drive للمونتاج والهندسة</span>
            </a>

            <span className="text-xs bg-indigo-500/10 text-indigo-400 font-mono px-3 py-2 rounded-xl border border-indigo-500/20 font-semibold">
              Audio Engineer
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab("list")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "list"
              ? "bg-amber-500 text-slate-950"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          قائمة التسجيلات (رفع فردي)
        </button>
        <button
          onClick={() => setActiveTab("batch_upload")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "batch_upload"
              ? "bg-amber-500 text-slate-950"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          الرفع المتعدد للمونتاج (مجموعات)
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {activeTab === "batch_upload" && (
        <MasteringUploader
          currentUser={currentUser}
          users={users}
          books={books}
          recordings={recordings}
          onRecordingAdded={onRecordingsUpdated}
          theme={theme}
        />
      )}

      {activeTab === "list" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* RAW Recordings Waiting for Mastering */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  التسجيلات الخام بانتظار المونتاج والهندسة (
                  {rawRecordings.length}):
                </span>
              </div>

              <div className="space-y-3">
                {rawRecordings.length === 0 ? (
                  <div className="p-8 text-center rounded-xl border border-slate-800 bg-slate-950/40 text-slate-400 text-xs">
                    لا توجد تسجيلات خام بانتظار المونتاج حالياً.
                  </div>
                ) : (
                  rawRecordings.map((rec, index) => {
                    const isSelected = selectedRecForMastering?.id === rec.id;
                    return (
                      <div
                        key={rec.id || `raw-${index}`}
                        className={`p-4 rounded-xl border transition-all ${
                          isSelected
                            ? "bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10"
                            : theme === "dark"
                              ? "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                              : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="text-sm font-bold text-amber-400">
                              📖{" "}
                              {(rec as any).book_title ||
                                (rec as any).bookTitle ||
                                rec.bookId ||
                                "كتاب صوتي"}{" "}
                              - الجزء {rec.partNumber}
                            </h4>
                            <div className="text-xs text-slate-400 mt-0.5">
                              الراوي:{" "}
                              <span className="text-slate-200 font-semibold">
                                {rec.narratorId}
                              </span>{" "}
                              • الحجم: {rec.durationSeconds || "12 MB"}
                            </div>
                          </div>
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono">
                            RAW
                          </span>
                        </div>

                        <div className="font-mono text-[11px] text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 dir-ltr text-right mb-3">
                          {rec.rawUrl}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => onPlayAudio(rec)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
                          >
                            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                            <span>استماع للخام</span>
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => downloadRecordingDirectly(rec)}
                              className="px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 border border-indigo-500/30 cursor-pointer"
                              title="تحميل الملف الخام مباشرة لجهازك"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>تحميل الخام</span>
                            </button>

                            <button
                              onClick={() => setSelectedRecForMastering(rec)}
                              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                            >
                              <Wand2 className="w-3.5 h-3.5" />
                              <span>رفع المونتاج</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Mastering Upload Panel */}
            <div className="lg:col-span-5">
              <div
                className={`p-5 rounded-2xl border sticky top-24 transition-all ${
                  theme === "dark"
                    ? "bg-slate-900 border-slate-800"
                    : "bg-white border-slate-200"
                }`}
              >
                <h3 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  رفع النسخة المماسترة (Mastered Audio)
                </h3>

                {selectedRecForMastering ? (
                  <form
                    onSubmit={handleUploadMasteredSubmit}
                    className="space-y-4"
                  >
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 text-xs space-y-1">
                      <div className="text-slate-400">
                        المقطع المحدد للمونتاج:
                      </div>
                      <div className="font-bold text-amber-300">
                        {(selectedRecForMastering as any).book_title ||
                          (selectedRecForMastering as any).bookTitle ||
                          selectedRecForMastering.bookId ||
                          "كتاب صوتي"}{" "}
                        - الجزء {selectedRecForMastering.partNumber}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        الراوي الأصلي: {selectedRecForMastering.narratorId}
                      </div>
                    </div>

                    {/* Auto Naming Format */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-xs space-y-1">
                      <div className="text-amber-400 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        التسمية الآلية المعتمدة للمونتاج:
                      </div>
                      <div className="font-mono text-[11px] text-amber-300 dir-ltr text-right">
                        {`${selectedRecForMastering.bookId.replace(/\s+/g, "_")}_MASTERED_Part${selectedRecForMastering.partNumber < 10 ? "0" : ""}${selectedRecForMastering.partNumber}_Mahdi.mp3`}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">
                        اختر ملف الصوت بعد الهندسة والمونتاج:
                      </label>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleMasteredFileChange}
                        className="w-full text-xs text-slate-400 file:mr-0 file:ml-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-500/20 file:text-amber-400 hover:file:bg-amber-500/30 cursor-pointer"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || !masteredFile}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      <FileCheck className="w-4 h-4" />
                      <span>حفظ واعتماد النسخة المماسترة</span>
                    </button>
                  </form>
                ) : (
                  <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-400 space-y-2">
                    <Wand2 className="w-8 h-8 text-slate-600 mx-auto" />
                    <p>
                      اختر مقطعاً خاماً من القائمة المجاورة لبدء رفع النسخة
                      المماسترة له.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Already Mastered List */}
          <div className="pt-6 border-t border-slate-800/60">
            <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              التسجيلات المماسترة سابقاً ({masteredRecordings.length}):
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {masteredRecordings.map((rec, index) => (
                <div
                  key={rec.id || `mastered-${index}`}
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
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono">
                      {rec.workflowStatus}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-300 dir-ltr text-right truncate">
                    {rec.masteredUrl || rec.rawUrl}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>هندسة: {rec.masteredBy || "مهدي احمد"}</span>
                    <button
                      onClick={() => onPlayAudio(rec)}
                      className="text-amber-400 hover:underline flex items-center gap-1"
                    >
                      <Volume2 className="w-3 h-3" /> تشغيل
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
