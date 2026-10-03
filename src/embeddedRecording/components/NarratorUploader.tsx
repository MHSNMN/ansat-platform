// @ts-nocheck
import { uploadQueueManager } from "../lib/uploadQueue";
import AudioRecorder from "./AudioRecorder";
import React, { useState, useEffect, useMemo } from "react";
import { User, Book, AudioRecording, ThemeMode } from "../types";
import {
  Upload,
  Mic,
  FileAudio,
  CheckCircle2,
  Sparkles,
  Play,
  Pause,
  Trash2,
  FolderOpen,
  Wand2,
  Link2,
  RefreshCw,
  Plus,
} from "lucide-react";
import {
  addRecording,
  getMaxPartNumberForBook,
  convertDriveUrlToDirectStream,
  fetchBooks,
} from "../lib/supabaseClient";
import { INITIAL_BOOKS } from "../data/mockData";
import { TARGET_DRIVE_FOLDER_URL } from "../lib/firebaseClient";

const RAW_DRIVE_LINK = TARGET_DRIVE_FOLDER_URL;

interface BatchFileItem {
  id?: string;
  file?: File;
  driveUrl?: string;
  bookTitle: string;
  partNumber: number;
  narratorName: string;
  detectedName: string;
}

interface NarratorUploaderProps {
  currentUser: User;
  users?: User[];
  books?: Book[];
  recordings?: AudioRecording[];
  preselectedBookTitle?: string;
  onRecordingAdded: (updatedRecordings: AudioRecording[]) => void;
  theme: ThemeMode;
}

export const NarratorUploader: React.FC<NarratorUploaderProps> = ({
  currentUser,
  users = [],
  books = [],
  recordings = [],
  preselectedBookTitle,
  onRecordingAdded,
  theme,
}) => {
  const [internalBooks, setInternalBooks] = useState<Book[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState<boolean>(false);
  const [customBookMode, setCustomBookMode] = useState<boolean>(false);
  const [customBookInput, setCustomBookInput] = useState<string>("");

  const effectiveBooks = useMemo(() => {
    if (Array.isArray(books) && books.length > 0) return books;
    if (internalBooks.length > 0) return internalBooks;
    try {
      const cached = localStorage.getItem("ensat_hub_books_v1");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return Array.isArray(INITIAL_BOOKS) && INITIAL_BOOKS.length > 0
      ? INITIAL_BOOKS
      : [];
  }, [books, internalBooks]);

  const safeBooks = effectiveBooks;
  const safeUsers = Array.isArray(users) ? users : [];
  const safeRecordings = Array.isArray(recordings) ? recordings : [];

  const [selectedBookTitle, setSelectedBookTitle] = useState<string>(
    preselectedBookTitle || (effectiveBooks[0] ? effectiveBooks[0].title : ""),
  );

  // Auto-fetch books if props didn't provide any
  useEffect(() => {
    if (!books || books.length === 0) {
      setIsLoadingBooks(true);
      fetchBooks()
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setInternalBooks(data);
          }
        })
        .catch((e) =>
          console.warn("Background fetchBooks in NarratorUploader:", e),
        )
        .finally(() => setIsLoadingBooks(false));
    }
  }, [books]);

  // Keep selectedBookTitle synchronized with available books
  useEffect(() => {
    if (effectiveBooks.length > 0) {
      const exists = effectiveBooks.some((b) => b.title === selectedBookTitle);
      if (!selectedBookTitle || !exists) {
        if (
          preselectedBookTitle &&
          effectiveBooks.some((b) => b.title === preselectedBookTitle)
        ) {
          setSelectedBookTitle(preselectedBookTitle);
        } else if (!customBookMode) {
          setSelectedBookTitle(effectiveBooks[0].title);
        }
      }
    }
  }, [effectiveBooks, preselectedBookTitle, selectedBookTitle, customBookMode]);

  const handleRefreshBooks = async () => {
    setIsLoadingBooks(true);
    try {
      const fresh = await fetchBooks(true);
      if (Array.isArray(fresh) && fresh.length > 0) {
        setInternalBooks(fresh);
        if (
          !selectedBookTitle ||
          !fresh.some((b) => b.title === selectedBookTitle)
        ) {
          setSelectedBookTitle(fresh[0].title);
        }
      }
    } catch (e) {
      console.warn("Manual books refresh error:", e);
    } finally {
      setIsLoadingBooks(false);
    }
  };
  const [selectedGlobalNarrator, setSelectedGlobalNarrator] = useState<string>(
    currentUser?.name || "",
  );
  const [partNumber, setPartNumber] = useState<number>(1);
  const [batchItems, setBatchItems] = useState<BatchFileItem[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{
    percent: number;
    chunkIndex: number;
    totalChunks: number;
    fileName: string;
  }>({ percent: 0, chunkIndex: 0, totalChunks: 0, fileName: "" });
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string>("");

  useEffect(() => {
    const handleDriveSyncEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setUploadProgress({
          percent: customEvent.detail.progress || 0,
          chunkIndex: customEvent.detail.chunkIndex || 1,
          totalChunks: customEvent.detail.totalChunks || 1,
          fileName: customEvent.detail.fileName || "",
        });
      }
    };

    window.addEventListener(
      "google-drive-sync-workflowStatus",
      handleDriveSyncEvent,
    );
    return () => {
      window.removeEventListener(
        "google-drive-sync-workflowStatus",
        handleDriveSyncEvent,
      );
    };
  }, []);

  // Manual Drive Link Input
  const [directDriveInput, setDirectDriveInput] = useState<string>("");

  // Audio preview playback state
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [audioElem, setAudioElem] = useState<HTMLAudioElement | null>(null);

  // Sync global narrator default
  useEffect(() => {
    if (currentUser && currentUser.name) {
      setSelectedGlobalNarrator(currentUser.name);
    }
  }, [currentUser]);

  useEffect(() => {
    if (preselectedBookTitle) {
      setSelectedBookTitle(preselectedBookTitle);
    }
  }, [preselectedBookTitle]);

  // Set default book selection
  useEffect(() => {
    if (books.length > 0 && !selectedBookTitle && !preselectedBookTitle) {
      setSelectedBookTitle(books[0].title);
    }
  }, [books, selectedBookTitle, preselectedBookTitle]);

  // Auto-incrementing part number logic querying Supabase / local max part
  useEffect(() => {
    if (!selectedBookTitle) return;
    let isMounted = true;
    async function updateAutoPartNumber() {
      const maxPart = await getMaxPartNumberForBook(selectedBookTitle);
      if (isMounted) {
        setPartNumber(maxPart + 1);
      }
    }
    updateAutoPartNumber();
    return () => {
      isMounted = false;
    };
  }, [selectedBookTitle, recordings]);

  // Enhanced AI / Pattern Parser matching real filenames e.g. كتاب التنانين/الفصل الاول/الصفحة 3/ج_14 /ديمه
  const parseFilenameAI = (
    fileName: string,
    index: number,
    defaultBook: string,
    defaultPart: number,
  ): { book: string; part: number; narrator: string } => {
    const cleanPath = fileName.replace(/\.[^/.]+$/, ""); // remove .mp3 extension

    // Split into segments by slashes, backslashes, underscores, hyphens
    const segments = cleanPath
      .split(/[/\\_-]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    // 1. Detect Book Title
    let detectedBook = defaultBook;
    const cleanLower = cleanPath.toLowerCase();
    for (const b of safeBooks) {
      if (!b || !b.title) continue;
      const bookTitleLower = String(b.title).toLowerCase();
      if (cleanLower.includes(bookTitleLower)) {
        detectedBook = b.title;
        break;
      } else {
        const keywords = String(b.title)
          .split(" ")
          .filter((w) => w.length > 2);
        if (keywords.some((kw) => cleanLower.includes(kw.toLowerCase()))) {
          detectedBook = b.title;
          break;
        }
      }
    }

    // 2. Detect Narrator Name from registered users
    let detectedNarrator = selectedGlobalNarrator;
    for (const u of safeUsers) {
      if (!u || !u.name) continue;
      const uNameLower = String(u.name).toLowerCase();
      if (cleanLower.includes(uNameLower)) {
        detectedNarrator = u.name;
        break;
      }
    }

    // 3. Detect Part Number
    let detectedPart = defaultPart + index;
    let foundPartInSegment = false;

    for (const seg of segments) {
      if (
        /فصل|الفصل|صفحة|الصفحة|صفحه|الصفحه/i.test(seg) &&
        !/ج_|\bج\b|جزء/i.test(seg)
      ) {
        continue;
      }
      const partMatch = seg.match(/(?:ج_|ج\s*|جزء\s*|part\s*|p\s*)(\d{1,3})/i);
      if (partMatch && partMatch[1]) {
        const num = parseInt(partMatch[1], 10);
        if (!isNaN(num) && num > 0 && num <= 300) {
          detectedPart = num;
          foundPartInSegment = true;
          break;
        }
      }
    }

    if (!foundPartInSegment) {
      for (const seg of segments) {
        if (/فصل|الفصل|صفحة|الصفحة|صفحه|الصفحه/i.test(seg)) continue;
        const standaloneMatch = seg.match(/^(\d{1,3})$/);
        if (standaloneMatch && standaloneMatch[1]) {
          const num = parseInt(standaloneMatch[1], 10);
          if (!isNaN(num) && num > 0 && num <= 300) {
            detectedPart = num;
            break;
          }
        }
      }
    }

    return {
      book: detectedBook,
      part: detectedPart,
      narrator: detectedNarrator,
    };
  };

  const processFiles = (files: File[]) => {
    const items: BatchFileItem[] = files.map((file, idx) => {
      const aiResult = parseFilenameAI(
        file.name,
        idx,
        selectedBookTitle,
        partNumber,
      );
      return {
        file,
        bookTitle: aiResult.book,
        partNumber: aiResult.part,
        narratorName: aiResult.narrator,
        detectedName: file.name,
      };
    });
    setBatchItems((prev) => [...prev, ...items]);

    if (files.length > 0) {
      const url = URL.createObjectURL(files[0]);
      setPreviewAudioUrl(url);
    }
  };

  const handleAddDriveLink = () => {
    if (!directDriveInput.trim()) return;
    const directStreamUrl = convertDriveUrlToDirectStream(
      directDriveInput.trim(),
    );
    const newItem: BatchFileItem = {
      driveUrl: directStreamUrl,
      bookTitle: selectedBookTitle,
      partNumber: partNumber + batchItems.length,
      narratorName: selectedGlobalNarrator,
      detectedName: `رابط Google Drive للجزء ${partNumber + batchItems.length}`,
    };
    setBatchItems((prev) => [...prev, newItem]);
    setDirectDriveInput("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const updateBatchItem = (index: number, updates: Partial<BatchFileItem>) => {
    setBatchItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item)),
    );
  };

  const removeBatchItem = (index: number) => {
    setBatchItems((prev) => prev.filter((_, i) => i !== index));
    if (batchItems.length <= 1) {
      setPreviewAudioUrl(null);
    }
  };

  const handleTogglePreviewPlay = async () => {
    if (!previewAudioUrl) return;
    try {
      if (!audioElem) {
        const audio = new Audio(previewAudioUrl);
        audio.onended = () => setIsPlayingPreview(false);
        setAudioElem(audio);
        await audio.play();
        setIsPlayingPreview(true);
      } else {
        if (isPlayingPreview) {
          audioElem.pause();
          setIsPlayingPreview(false);
        } else {
          await audioElem.play();
          setIsPlayingPreview(true);
        }
      }
    } catch (err) {
      console.warn("Playback interrupted safely:", err);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (batchItems.length === 0) return;

    // Validate that all items have a selected book
    const hasEmptyBook = batchItems.some(
      (item) => !item.bookTitle || item.bookTitle.trim() === "",
    );
    if (hasEmptyBook) {
      alert("يرجى تحديد الكتاب لجميع الملفات المضافة قبل الرفع.");
      return;
    }

    // 1. OPTIMISTIC UI UPDATE: Instantly construct recording objects with local Object URLs
    const optimisticNewRecordings: AudioRecording[] = [];
    const backgroundTasks: {
      recId: string;
      item: BatchFileItem;
      autoGeneratedName: string;
      fileSizeMB: string;
    }[] = [];

    const now = Date.now();
    batchItems.forEach((item, idx) => {
      const partStr =
        item.partNumber < 10 ? `0${item.partNumber}` : `${item.partNumber}`;
      const narratorSanitized = item.narratorName.replace(/\s+/g, "_");

      const isWebm = item.file && (item.file.type || "").includes("webm");
      const isMp4 = item.file && (item.file.type || "").includes("mp4");
      const ext = isWebm ? ".webm" : isMp4 ? ".mp4" : ".mp3";
      const autoGeneratedName = `${item.bookTitle}_Part${partStr}_${narratorSanitized}${ext}`;

      let fileSizeMB = "15 MB";
      let localStreamUrl = "";

      if (item.file) {
        fileSizeMB = (item.file.size / (1024 * 1024)).toFixed(1) + " MB";
        localStreamUrl = URL.createObjectURL(item.file);
      } else if (item.driveUrl) {
        localStreamUrl = convertDriveUrlToDirectStream(item.driveUrl);
      } else {
        localStreamUrl = RAW_DRIVE_LINK;
      }

      const recId = `rec-opt-${now}-${idx}`;

      const recObj: AudioRecording = {
        id: recId,
        bookId: item.bookTitle,
        partNumber: item.partNumber,
        narratorId: item.narratorName,
        rawUrl: localStreamUrl || item.driveUrl || RAW_DRIVE_LINK,
        durationSeconds: 930, // 15:30 in seconds
        workflowStatus: "RAW_QA_PENDING",
        createdAt: new Date().toISOString(),
      };

      optimisticNewRecordings.push(recObj);
      backgroundTasks.push({
        recId,
        item,
        autoGeneratedName,
        fileSizeMB,
      });
    });

    // 2. Instantly update UI (0ms latency!) and reset upload form
    const updatedLocally = [...optimisticNewRecordings, ...recordings];
    onRecordingAdded(updatedLocally);

    setUploadSuccessMsg(
      `⚡ تم إدراج (${batchItems.length}) تسجيل فوراً في المكتبة! جاري المزامنة والرفع لخوادم Firebase & Google Drive في الخلفية (Background Worker)...`,
    );
    setBatchItems([]);
    setPreviewAudioUrl(null);
    if (audioElem) {
      audioElem.pause();
      setAudioElem(null);
    }

    // 3. BACKGROUND WORKER: Delegate to Queue Manager for robust background uploads
    (async () => {
      let currentRecordingsState = updatedLocally;

      const queueItems = [];

      for (const bg of backgroundTasks) {
        const isFile = !!bg.item.file;
        const initialFileUrl = bg.item.driveUrl
          ? convertDriveUrlToDirectStream(bg.item.driveUrl)
          : RAW_DRIVE_LINK;

        // Persist doc immediately so it has an ID
        const newRec = await addRecording({
          bookId: bg.item.bookTitle,
          partNumber: bg.item.partNumber,
          narratorId: bg.item.narratorName,
          rawUrl: initialFileUrl || bg.item.driveUrl || RAW_DRIVE_LINK,
          durationSeconds: Number(bg.fileSizeMB),
          workflowStatus: "RAW_QA_PENDING",
        });

        currentRecordingsState = currentRecordingsState.map((r) =>
          r.id === bg.recId ? newRec : r,
        );
        onRecordingAdded(currentRecordingsState);

        const matchingBook = books.find((b) => b.title === bg.item.bookTitle);

        if (isFile && bg.item.file) {
          queueItems.push({
            id: "q-" + Date.now() + Math.random(),
            recId: newRec.id,
            bookId: matchingBook?.id,
            file: bg.item.file,
            fileName: bg.autoGeneratedName,
            bookTitle: bg.item.bookTitle,
            driveFolderId: matchingBook?.rawDriveFileId,
            mimeType: bg.item.file.type || "audio/mpeg",
          });
        }
      }

      if (queueItems.length > 0) {
        uploadQueueManager.addItems(queueItems);
      }

      setTimeout(() => setUploadSuccessMsg(""), 5000);
    })();
  };
  return (
    <div
      className={`p-6 rounded-2xl border transition-all ${
        theme === "dark"
          ? "bg-slate-900/90 border-slate-800"
          : "bg-white border-slate-200"
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Mic className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
              أداة الرفع والتخزين الموحد (Firebase & Google Drive Audio Hub)
            </h2>
            <p className="text-xs text-slate-400">
              اختر الكتاب وابدأ التسجيل أو رفع الملف الصوتي
            </p>
          </div>
        </div>
      </div>

      {uploadSuccessMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{uploadSuccessMsg}</span>
        </div>
      )}

      {/* Rejected Recordings / Revisions Needed */}
      {safeRecordings.filter(
        (r) =>
          r.bookId === selectedBookTitle &&
          r.narratorId === currentUser.name &&
          r.workflowStatus === "NARRATOR_REVISION_REQUIRED",
      ).length > 0 && (
        <div className="mb-6 p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30">
          <h3 className="text-sm font-bold text-rose-400 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            ملاحظات التدقيق المطلوبة لهذا الكتاب:
          </h3>
          <div className="space-y-3">
            {safeRecordings
              .filter(
                (r) =>
                  r.bookId === selectedBookTitle &&
                  r.narratorId === currentUser.name &&
                  r.workflowStatus === "NARRATOR_REVISION_REQUIRED",
              )
              .map((r) => (
                <div
                  key={r.id}
                  className="p-3 bg-slate-900/50 rounded-xl border border-rose-500/20"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded">
                      الجزء {r.partNumber}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      بواسطة: {r.qaReviewedBy || "مراقب الجودة"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed border-r-2 border-rose-500 pr-3">
                    {r.qaNotes || "مرفوض - لا توجد ملاحظات إضافية."}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      <form onSubmit={handleUploadSubmit} className="space-y-6">
        {/* Audio Recorder for instant client-side recordings */}
        <AudioRecorder
          onRecordingComplete={(file) => {
            const newItem: BatchFileItem = {
              id: "local-" + Date.now(),
              file: file,
              bookTitle: selectedBookTitle,
              narratorName: selectedGlobalNarrator,
              partNumber: partNumber,
              detectedName: file.name,
            };
            setBatchItems((prev) => [...prev, newItem]);
            setPartNumber((prev) => prev + 1);
          }}
        />

        {/* Global Settings for Batch */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-300">
                الكتاب الافتراضي المستهدف ({effectiveBooks.length} متاح):
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshBooks}
                  disabled={isLoadingBooks}
                  title="تحديث قائمة الكتب"
                  className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${isLoadingBooks ? "animate-spin" : ""}`}
                  />
                  <span>تحديث</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = !customBookMode;
                    setCustomBookMode(nextMode);
                    if (nextMode && customBookInput) {
                      setSelectedBookTitle(customBookInput);
                    } else if (!nextMode && effectiveBooks.length > 0) {
                      setSelectedBookTitle(effectiveBooks[0].title);
                    }
                  }}
                  className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>
                    {customBookMode ? "اختيار من القائمة" : "كتابة يدوية"}
                  </span>
                </button>
              </div>
            </div>

            {customBookMode ? (
              <input
                type="text"
                placeholder="اكتب عنوان الكتاب هنا..."
                value={customBookInput}
                onChange={(e) => {
                  setCustomBookInput(e.target.value);
                  setSelectedBookTitle(e.target.value);
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium border focus:outline-none focus:ring-2 transition-all ${
                  theme === "dark"
                    ? "bg-slate-900 border-slate-800 focus:ring-amber-500 text-white"
                    : "bg-slate-50 border-slate-300 focus:ring-amber-500 text-slate-900"
                }`}
              />
            ) : (
              <select
                value={selectedBookTitle}
                onChange={(e) => setSelectedBookTitle(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium border focus:outline-none focus:ring-2 transition-all ${
                  theme === "dark"
                    ? "bg-slate-900 border-slate-800 focus:ring-amber-500 text-white"
                    : "bg-slate-50 border-slate-300 focus:ring-amber-500 text-slate-900"
                }`}
              >
                {effectiveBooks.length === 0 ? (
                  <option value="" disabled>
                    جاري تحميل قائمة الكتب المتاحة...
                  </option>
                ) : (
                  effectiveBooks.map((book) => (
                    <option key={book.id} value={book.title}>
                      📖 {book.title} ({book.author})
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              اسم الراوي الافتراضي (اختيار من أعضاء الفريق):
            </label>
            <select
              value={selectedGlobalNarrator}
              onChange={(e) => setSelectedGlobalNarrator(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold border focus:outline-none focus:ring-2 transition-all ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-800 text-amber-300 focus:ring-amber-500"
                  : "bg-slate-100 border-slate-300 text-slate-800 focus:ring-amber-500"
              }`}
            >
              {safeUsers.map((u) => (
                <option key={u.id} value={u.name}>
                  🎙️ {u.name} ({u.role_display_ar})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Option 1: File Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer relative ${
            batchItems.length > 0
              ? "border-amber-500/60 bg-amber-500/5"
              : theme === "dark"
                ? "border-slate-800 hover:border-amber-500/50 bg-slate-950/40"
                : "border-slate-300 hover:border-amber-500 bg-slate-50"
          }`}
        >
          <input
            type="file"
            accept="audio/*"
            multiple
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-1">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-amber-400" />
              <span>
                اسحب وأفلت الملفات الصوتية للرفع المباشر والتحليل الذكي
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-xl mx-auto">
              يتعرف النظام تلقائياً على صيغة التسجيلات مثل:{" "}
              <span className="text-amber-400 font-mono dir-ltr">
                كتاب التنانين/الفصل الاول/الصفحة 3/ج_14/ديمه
              </span>{" "}
              ويستخرج الجزء (ج_14) والكتاب والراوي مباشرة.
            </p>
          </div>
        </div>

        {/* Option 2: Add Direct Google Drive Link */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
          <label className="block text-xs font-semibold text-amber-400 flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            <span>أو إدخال رابط Google Drive للملف/المقطع مباشره:</span>
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://drive.google.com/file/d/.../view"
              value={directDriveInput}
              onChange={(e) => setDirectDriveInput(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
            />
            <button
              type="button"
              onClick={handleAddDriveLink}
              disabled={!directDriveInput.trim()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-amber-400 text-xs font-bold transition-all border border-slate-700"
            >
              إضافة الرابط
            </button>
          </div>
        </div>

        {/* Batch Files AI Detection Table */}
        {batchItems.length > 0 && (
          <div className="space-y-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold text-amber-400 pb-2 border-b border-slate-800">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                قائمة التسجيلات المحللة تلقائياً ({batchItems.length}):
              </span>
              <button
                type="button"
                onClick={() => setBatchItems([])}
                className="text-rose-400 hover:underline text-[11px]"
              >
                مسح القائمة
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {batchItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <FileAudio className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-mono font-bold text-slate-200">
                        {item.file ? item.file.name : item.detectedName}
                      </span>
                      {item.file && (
                        <span className="text-[10px] text-slate-500">
                          ({(item.file.size / (1024 * 1024)).toFixed(1)} MB)
                        </span>
                      )}
                      {item.driveUrl && (
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-mono">
                          Drive Link
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {idx === 0 && previewAudioUrl && (
                        <button
                          type="button"
                          onClick={handleTogglePreviewPlay}
                          className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-[11px] font-semibold flex items-center gap-1"
                        >
                          {isPlayingPreview ? (
                            <Pause className="w-3 h-3" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                          <span>معاينة الصوت</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeBatchItem(idx)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* AI Selected Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800/60">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">
                        الكتاب المحدد:
                      </span>
                      <select
                        value={item.bookTitle}
                        onChange={(e) =>
                          updateBatchItem(idx, { bookTitle: e.target.value })
                        }
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs"
                      >
                        {item.bookTitle &&
                          !safeBooks.some(
                            (b) => b.title === item.bookTitle,
                          ) && (
                            <option value={item.bookTitle}>
                              📖 {item.bookTitle}
                            </option>
                          )}
                        {safeBooks.map((b) => (
                          <option key={b.id} value={b.title}>
                            📖 {b.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] text-amber-400 block mb-1 font-bold">
                        رقم الجزء (0 = كتاب كامل):
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={item.partNumber}
                        onChange={(e) =>
                          updateBatchItem(idx, {
                            partNumber: Number(e.target.value),
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-amber-500/40 text-amber-400 text-xs font-mono font-bold"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">
                        اسم الراوي (اختر من القائمة):
                      </span>
                      <select
                        value={item.narratorName}
                        onChange={(e) =>
                          updateBatchItem(idx, { narratorName: e.target.value })
                        }
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-amber-300 text-xs font-bold"
                      >
                        {safeUsers.map((u) => (
                          <option key={u.id} value={u.name}>
                            {u.name}
                          </option>
                        ))}
                        {!safeUsers.some(
                          (u) => u.name === item.narratorName,
                        ) && (
                          <option value={item.narratorName}>
                            {item.narratorName} (مستخرج)
                          </option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Upload Button */}
        <button
          type="submit"
          disabled={batchItems.length === 0}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {isUploading ? (
            <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span>
            تأكيد الرفع والحفظ الدائم بـ Firebase Firestore لـ (
            {batchItems.length}) مقطع
          </span>
        </button>
      </form>
    </div>
  );
};
