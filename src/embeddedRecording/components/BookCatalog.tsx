// @ts-nocheck
import React, { useState } from "react";
import { MainTab, Book, ThemeMode, User, AudioRecording } from "../types";
import {
  BookOpen,
  Plus,
  Users,
  Edit3,
  Trash2,
  X,
  Search,
  BookMarked,
  CheckSquare,
  Square,
  Headphones,
  PackageCheck,
  ExternalLink,
  Mic,
} from "lucide-react";
import {
  addBook,
  updateBook,
  deleteBook,
  deleteMultipleBooks,
} from "../lib/supabaseClient";
import { driveClient } from "../lib/googleDriveClient";
import { BookDetailsModal } from "./BookDetailsModal";
import { NarratorSelector } from "./NarratorSelector";
import { hasPermission } from "../lib/permissions";

interface BookCatalogProps {
  books: Book[];
  recordings?: AudioRecording[];
  onPlayAudio?: (rec: AudioRecording) => void;
  onBooksUpdated: (updatedBooks: Book[]) => void;
  onSelectTab?: (tab: MainTab, bookTitle?: string) => void;
  currentUser?: User | null;
  users?: User[];
  theme: ThemeMode;
}

export const BookCatalog: React.FC<BookCatalogProps> = ({
  books,
  recordings = [],
  onPlayAudio,
  onBooksUpdated,
  onSelectTab,
  currentUser,
  users = [],
  theme,
}) => {
  const canManageBooks = Boolean(
    currentUser?.is_super_admin ||
    currentUser?.can_manage_books ||
    (currentUser as any)?.permissions?.can_manage_books ||
    hasPermission(currentUser, "can_manage_books") ||
    [
      "SUPER_ADMIN",
      "ADMIN",
      "CONTENT_MANAGER",
      "OPERATIONS_MANAGER",
      "RECORDING_MANAGER",
      "COORDINATOR",
      "PROJECT_MANAGER",
    ].includes(String(currentUser?.role || "").toUpperCase()),
  );

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [deletingBook, setDeletingBook] = useState<Book | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBatchDeleteModal, setShowBatchDeleteModal] =
    useState<boolean>(false);
  const [selectedBookForDetails, setSelectedBookForDetails] =
    useState<Book | null>(null);

  // Search, Filter & Sort States
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "COMPLETED" | "IN_PROGRESS"
  >("ALL");
  const [sortBy, setSortBy] = useState<"title" | "progress" | "parts">("title");

  // Form states
  const [title, setTitle] = useState<string>("");
  const [author, setAuthor] = useState<string>("");
  const [totalParts, setTotalParts] = useState<number>(12);
  const [completedParts, setCompletedParts] = useState<number>(0);
  const [category, setCategory] = useState<string>("تطوير الذات والنجاح");
  const [assignedNarrators, setAssignedNarrators] = useState<string>("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [driveFolderId, setDriveFolderId] = useState("");
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const categoriesList = [
    "تطوير الذات والنجاح",
    "الفكر والإسلاميات",
    "الأدب والروايات",
    "التاريخ والحضارات",
    "العلوم والتكنولوجيا",
    "إدارة الأعمال والقيادة",
  ];

  const openAddModal = () => {
    if (!canManageBooks) return;
    setTitle("");
    setAuthor("");
    setTotalParts(12);
    setCompletedParts(0);
    setCategory("تطوير الذات والنجاح");
    setAssignedNarrators("");
    setShowAddModal(true);
  };

  const openEditModal = (b: Book) => {
    if (!canManageBooks) return;
    setEditingBook(b);
    setTitle(b.title);
    setAuthor(b.author);
    setTotalParts(b.total_parts);
    setCompletedParts(b.completed_parts || 0);
    setCategory(b.category || "كتاب صوتي");
    setAssignedNarrators(
      b.assigned_narrators ? b.assigned_narrators.join("، ") : "",
    );
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) return;

    setIsUploading(true);
    let pdfUrl = "";
    let pdfFileId = "";

    if (pdfFile) {
      try {
        const uploadRes = await driveClient.uploadPdfToDrive(
          pdfFile,
          title.trim(),
        );
        if (uploadRes) {
          pdfUrl = uploadRes.url;
          pdfFileId = uploadRes.id;
        }
      } catch (e) {
        console.warn("Failed to upload PDF", e);
      }
    }

    const narratorsList = assignedNarrators
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const newBookObj: Book = {
      id: `book-${Date.now()}`,
      title: title.trim(),
      author: author.trim(),
      total_parts: Math.max(1, totalParts),
      completed_parts: Math.min(totalParts, Math.max(0, completedParts)),
      assigned_narrators: narratorsList,
      category: category.trim() || "عام",
      cover_color: "from-amber-600 to-amber-950",
      createdAt: new Date().toISOString(),
      ...(pdfUrl ? { pdf_url: pdfUrl, pdf_file_id: pdfFileId } : {}),
    };

    // 1. Instant 0ms Optimistic UI Update & Modal Close
    onBooksUpdated([
      newBookObj,
      ...books.filter((b) => b.id !== newBookObj.id),
    ]);
    setIsUploading(false);
    setShowAddModal(false);
    setPdfFile(null);
    setDriveFolderId("");

    // 2. Background async save
    try {
      const updated = await addBook(newBookObj, currentUser?.name || "المدير");
      if (updated && Array.isArray(updated) && updated.length > 0) {
        const hasNew = updated.some((b) => b.id === newBookObj.id);
        onBooksUpdated(hasNew ? updated : [newBookObj, ...updated]);
      }
    } catch (err) {
      console.warn("Background add book error:", err);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook || !title.trim()) return;

    setIsUploading(true);
    let pdfUrl = editingBook.pdf_url;
    let pdfFileId = editingBook.pdf_file_id;

    if (pdfFile) {
      try {
        const uploadRes = await driveClient.uploadPdfToDrive(
          pdfFile,
          title.trim(),
        );
        if (uploadRes) {
          pdfUrl = uploadRes.url;
          pdfFileId = uploadRes.id;
        }
      } catch (e) {
        console.warn("Failed to upload PDF on edit", e);
      }
    }

    const narratorsList = assignedNarrators
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const bookId = editingBook.id;

    const updatePayload = {
      title: title.trim(),
      author: author.trim(),
      total_parts: Math.max(1, totalParts),
      completed_parts: Math.min(totalParts, Math.max(0, completedParts)),
      category: category.trim(),
      assigned_narrators: narratorsList,
      ...(pdfUrl ? { pdf_url: pdfUrl, pdf_file_id: pdfFileId } : {}),
    };

    // 1. Instant 0ms Optimistic UI Update & Modal Close
    const optimisticBooks = books.map((b) => {
      if (b.id === bookId) {
        return {
          ...b,
          ...updatePayload,
        };
      }
      return b;
    });

    onBooksUpdated(optimisticBooks);
    setIsUploading(false);
    setEditingBook(null);
    setPdfFile(null);

    // 2. Background async save
    try {
      const updated = await updateBook(
        bookId,
        updatePayload,
        currentUser?.name || "المدير",
      );
      onBooksUpdated(updated);
    } catch (err) {
      console.warn("Background edit book error:", err);
    }
  };

  const handleDelete = (b: Book) => {
    setDeletingBook(b);
  };

  const confirmDeleteBook = async () => {
    if (!deletingBook) return;
    const targetId = deletingBook.id;

    // 1. Instant 0ms Optimistic UI Delete & Modal Close
    const optimisticBooks = books.filter((b) => b.id !== targetId);
    onBooksUpdated(optimisticBooks);
    setDeletingBook(null);

    // 2. Background async delete
    try {
      const updated = await deleteBook(targetId, currentUser?.name || "المدير");
      onBooksUpdated(updated);
    } catch (err) {
      console.warn("Background delete book error:", err);
    }
  };

  const handleSelectBook = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAllFiltered = () => {
    if (
      selectedIds.length === filteredBooks.length &&
      filteredBooks.length > 0
    ) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredBooks.map((b) => b.id));
    }
  };

  const confirmBatchDeleteBooks = async () => {
    if (selectedIds.length === 0) return;
    const idsToDelete = [...selectedIds];

    // 1. Instant 0ms Optimistic UI Batch Delete & Modal Close
    const optimisticBooks = books.filter((b) => !idsToDelete.includes(b.id));
    onBooksUpdated(optimisticBooks);
    setSelectedIds([]);
    setShowBatchDeleteModal(false);

    // 2. Background async delete
    try {
      const updated = await deleteMultipleBooks(
        idsToDelete,
        currentUser?.name || "المدير",
      );
      onBooksUpdated(updated);
    } catch (err) {
      console.warn("Background batch delete books error:", err);
    }
  };

  const handleQuickProgressUpdate = async (b: Book, delta: number) => {
    const nextCompleted = Math.max(
      0,
      Math.min(b.total_parts, b.completed_parts + delta),
    );

    // 1. Instant 0ms Optimistic Update
    const optimisticBooks = books.map((item) =>
      item.id === b.id ? { ...item, completed_parts: nextCompleted } : item,
    );
    onBooksUpdated(optimisticBooks);

    // 2. Background async update
    try {
      const updated = await updateBook(
        b.id,
        {
          completed_parts: nextCompleted,
        },
        currentUser?.name || "المدير",
      );
      onBooksUpdated(updated);
    } catch (err) {
      console.warn("Background progress update error:", err);
    }
  };

  // Filtering & Sorting
  const filteredBooks = books
    .filter((b) => {
      const matchesSearch =
        (b.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.author || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.assigned_narrators.some((n) =>
          (n || "").toLowerCase().includes(searchTerm.toLowerCase()),
        );
      const matchesCat =
        selectedCategory === "ALL" || b.category === selectedCategory;
      const isCompleted = b.completed_parts >= b.total_parts;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "COMPLETED" && isCompleted) ||
        (statusFilter === "IN_PROGRESS" && !isCompleted);
      return matchesSearch && matchesCat && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === "progress") {
        const pA = a.completed_parts / a.total_parts;
        const pB = b.completed_parts / b.total_parts;
        return pB - pA;
      }
      if (sortBy === "parts") return b.total_parts - a.total_parts;
      return a.title.localeCompare(b.title, "ar");
    });

  return (
    <div className="space-y-6 dir-rtl">
      {/* Header Banner */}
      <div
        className={`p-6 rounded-3xl border transition-all ${
          theme === "dark"
            ? "bg-slate-900/90 border-slate-800"
            : "bg-white border-slate-200 shadow-lg"
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-amber-400 flex items-center gap-2">
                <span>فهرس المشاريع ومكتبة الكتب الصوتية الشاملة</span>
                <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/30 font-mono">
                  {books.length} كتاب
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                إضافة وإدارة الكتب الصوتية، متابعة نسبة إنجاز الأجزاء، وتعيين
                الرواة والمشرفين لكل مشروع
              </p>
            </div>
          </div>

          <button
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs shadow-xl shadow-amber-500/20 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة كتاب جديد بنقرة واحدة</span>
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 mt-4 border-t border-slate-800/80">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث باسم الكتاب، المؤلف، أو الراوي..."
              className={`w-full pr-9 pl-3 py-2 rounded-xl text-xs border font-medium focus:outline-none focus:ring-2 ${
                theme === "dark"
                  ? "bg-slate-950 border-slate-800 text-white focus:ring-amber-500"
                  : "bg-slate-50 border-slate-300 text-slate-900 focus:ring-amber-500"
              }`}
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-xs border font-bold focus:outline-none ${
                theme === "dark"
                  ? "bg-slate-950 border-slate-800 text-amber-400"
                  : "bg-slate-50 border-slate-300 text-slate-900"
              }`}
            >
              <option value="ALL">جميع التصنيفات ({books.length})</option>
              {categoriesList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className={`w-full px-3 py-2 rounded-xl text-xs border font-bold focus:outline-none ${
                theme === "dark"
                  ? "bg-slate-950 border-slate-800 text-amber-400"
                  : "bg-slate-50 border-slate-300 text-slate-900"
              }`}
            >
              <option value="title">ترتيب حسب العنوان</option>
              <option value="progress">ترتيب حسب نسبة الإنجاز الأعلى</option>
              <option value="parts">ترتيب حسب عدد الأجزاء</option>
            </select>
          </div>
        </div>

        {/* Batch Selection Toolbar */}
        {filteredBooks.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t border-slate-800/60 text-xs">
            <button
              onClick={handleSelectAllFiltered}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all cursor-pointer"
            >
              {selectedIds.length === filteredBooks.length &&
              filteredBooks.length > 0 ? (
                <>
                  <CheckSquare className="w-4 h-4 text-amber-400" />
                  <span>إلغاء تحديد الكل ({selectedIds.length})</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-slate-400" />
                  <span>
                    تحديد كافة الكتب المعروضة ({filteredBooks.length})
                  </span>
                </>
              )}
            </button>

            {selectedIds.length > 0 && (
              <button
                onClick={() => setShowBatchDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold shadow-lg shadow-rose-600/30 transition-all cursor-pointer animate-pulse"
              >
                <Trash2 className="w-4 h-4" />
                <span>حذف المحدد بنقرة واحدة ({selectedIds.length} كتاب)</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Book Grid */}
      {filteredBooks.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 text-slate-400 space-y-3">
          <BookMarked className="w-10 h-10 text-amber-500/40 mx-auto" />
          <p className="text-sm font-bold">لا توجد كتب مطابقة لنتائج البحث</p>
          <button
            onClick={openAddModal}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            إضافة كتاب جديد الآن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredBooks.map((b) => {
            const progressPercent =
              Math.round((b.completed_parts / b.total_parts) * 100) || 0;
            const isSelected = selectedIds.includes(b.id);

            return (
              <div
                key={b.id}
                className={`p-6 rounded-3xl border transition-all relative overflow-hidden space-y-4 shadow-lg ${
                  isSelected
                    ? "ring-2 ring-amber-500 bg-amber-500/5 border-amber-500/50"
                    : theme === "dark"
                      ? "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                      : "bg-white border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleSelectBook(b.id)}
                      className="mt-1 text-slate-400 hover:text-amber-400 cursor-pointer transition-colors"
                      title={
                        isSelected ? "إلغاء التحديد" : "تحديد للحذف الجماعي"
                      }
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-amber-400 fill-amber-500/10" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-600 hover:text-slate-400" />
                      )}
                    </button>
                    <div className="space-y-1">
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded-md border border-amber-500/20 font-bold inline-block">
                        {b.category || "كتاب صوتي"}
                      </span>
                      <h3 className="text-base font-extrabold text-amber-400 leading-snug">
                        📖 {b.title}
                      </h3>
                      <p className="text-xs text-slate-400">
                        المؤلف:{" "}
                        <span className="text-slate-200 font-bold">
                          {b.author}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-left font-mono">
                      <div className="text-lg font-black text-amber-400">
                        {progressPercent}%
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold">
                        {b.completed_parts} / {b.total_parts} جزء
                      </div>
                    </div>

                    {/* Edit & Delete & Actions Buttons */}
                    <div className="flex items-center gap-1 pt-1">
                      {onSelectTab && (
                        <>
                          <button
                            onClick={() =>
                              onSelectTab("audio_library", b.title)
                            }
                            title="فتح تسجيلات الكتاب"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer font-bold text-[10px]"
                          >
                            <Headphones className="w-3.5 h-3.5" />
                            <span>فتح</span>
                          </button>
                          <button
                            onClick={() => onSelectTab("studio", b.title)}
                            title="تسجيل الكتاب"
                            className="p-2 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                          >
                            <Mic className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {b.pdf_url && (
                        <a
                          href={b.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          title="فتح ملف الكتاب (PDF)"
                          className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500 hover:text-slate-950 text-rose-400 border border-slate-700 transition-all cursor-pointer flex items-center justify-center"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {b.drive_folder_link && (
                        <a
                          href={b.drive_folder_link}
                          target="_blank"
                          rel="noreferrer"
                          title="فتح مجلد الكتاب في الدرايف"
                          className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 border border-slate-700 transition-all cursor-pointer flex items-center justify-center"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => openEditModal(b)}
                        title="تعديل بيانات الكتاب"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(b)}
                        title="حذف الكتاب نهائياً"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500 hover:text-white text-rose-400 border border-slate-700 hover:border-rose-500 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Quick Part Increments */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                    <span>تقدم الإنتاج والتسجيل:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleQuickProgressUpdate(b, -1)}
                        className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center text-xs font-black"
                        title="إنقاص جزء متمم"
                      >
                        -
                      </button>
                      <span className="font-mono text-amber-400">
                        {b.completed_parts}
                      </span>
                      <button
                        onClick={() => handleQuickProgressUpdate(b, 1)}
                        className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center text-xs font-black"
                        title="زيادة جزء متمم"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all durationSeconds-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Action button to open book details & download ZIP */}
                <button
                  onClick={() => setSelectedBookForDetails(b)}
                  className="w-full py-2.5 px-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer flex items-center justify-between gap-2 shadow-md group"
                >
                  <div className="flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span>عرض تسجيلات الكتاب والمراجعة</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-extrabold flex items-center gap-1 shrink-0">
                    <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>تنزيل ZIP</span>
                  </span>
                </button>

                {/* Assigned Narrators Footer */}
                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400 truncate">
                    <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>الرواة المكلفين:</span>
                    <span className="text-slate-200 font-bold truncate">
                      {b.assigned_narrators && b.assigned_narrators.length > 0
                        ? b.assigned_narrators.join(" • ")
                        : "لم يتم تعيين رواة بعد"}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0">
                    {b.createdAt}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Book Details & ZIP Download Modal */}
      {selectedBookForDetails && (
        <BookDetailsModal
          book={selectedBookForDetails}
          recordings={recordings}
          onClose={() => setSelectedBookForDetails(null)}
          theme={theme}
          onPlayRecording={onPlayAudio}
        />
      )}

      {/* Add Book Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div
            className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4 ${
              theme === "dark"
                ? "bg-slate-900 border-slate-800 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                إضافة مشروع كتاب صوتي جديد
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  اسم الكتاب الكامل:
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: فن الذكاء الاجتماعي"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 ${
                    theme === "dark"
                      ? "bg-slate-950 border-slate-800 focus:ring-amber-500 text-white"
                      : "bg-slate-50 border-slate-300 focus:ring-amber-500"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  اسم المؤلف:
                </label>
                <input
                  type="text"
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="مثال: د. إبراهيم الفقي"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 ${
                    theme === "dark"
                      ? "bg-slate-950 border-slate-800 focus:ring-amber-500 text-white"
                      : "bg-slate-50 border-slate-300 focus:ring-amber-500"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    إجمالي الأجزاء:
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={totalParts}
                    onChange={(e) => setTotalParts(Number(e.target.value))}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 ${
                      theme === "dark"
                        ? "bg-slate-950 border-slate-800 focus:ring-amber-500 text-white"
                        : "bg-slate-50 border-slate-300 focus:ring-amber-500"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    رقم الجزء الحالي / المنجز:
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={completedParts}
                    onChange={(e) => setCompletedParts(Number(e.target.value))}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 ${
                      theme === "dark"
                        ? "bg-slate-950 border-slate-800 focus:ring-amber-500 text-white"
                        : "bg-slate-50 border-slate-300 focus:ring-amber-500"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    التصنيف:
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 ${
                      theme === "dark"
                        ? "bg-slate-950 border-slate-800 focus:ring-amber-500 text-amber-400 font-bold"
                        : "bg-slate-50 border-slate-300 focus:ring-amber-500"
                    }`}
                  >
                    {categoriesList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <NarratorSelector
                value={assignedNarrators}
                onChange={setAssignedNarrators}
                users={users}
                currentUser={currentUser}
                theme={theme}
              />

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ملف الكتاب (PDF) - اختياري:
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 ${
                    theme === "dark"
                      ? "bg-slate-950 border-slate-800 focus:ring-amber-500 text-white"
                      : "bg-slate-50 border-slate-300 focus:ring-amber-500"
                  }`}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUploading
                    ? "جاري الرفع والإضافة..."
                    : "حفظ إضافة الكتاب ومزامنة قاعدة البيانات"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isUploading}
                  className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Book Modal */}
      {editingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div
            className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4 ${
              theme === "dark"
                ? "bg-slate-900 border-slate-800 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                تعديل كتاب: {editingBook.title}
              </h3>
              <button
                onClick={() => setEditingBook(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  عنوان الكتاب:
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 ${
                    theme === "dark"
                      ? "bg-slate-950 border-slate-800 focus:ring-amber-500 text-white"
                      : "bg-slate-50 border-slate-300 focus:ring-amber-500"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  اسم المؤلف:
                </label>
                <input
                  type="text"
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 ${
                    theme === "dark"
                      ? "bg-slate-950 border-slate-800 focus:ring-amber-500 text-white"
                      : "bg-slate-50 border-slate-300 focus:ring-amber-500"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    إجمالي الأجزاء:
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={totalParts}
                    onChange={(e) => setTotalParts(Number(e.target.value))}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 ${
                      theme === "dark"
                        ? "bg-slate-950 border-slate-800 focus:ring-amber-500 text-white"
                        : "bg-slate-50 border-slate-300 focus:ring-amber-500"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    رقم الجزء الحالي / المنجز:
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={completedParts}
                    onChange={(e) => setCompletedParts(Number(e.target.value))}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 ${
                      theme === "dark"
                        ? "bg-slate-950 border-slate-800 focus:ring-amber-500 text-white"
                        : "bg-slate-50 border-slate-300 focus:ring-amber-500"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    التصنيف:
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 ${
                      theme === "dark"
                        ? "bg-slate-950 border-slate-800 focus:ring-amber-500 text-white"
                        : "bg-slate-50 border-slate-300 focus:ring-amber-500"
                    }`}
                  />
                </div>
              </div>

              <NarratorSelector
                value={assignedNarrators}
                onChange={setAssignedNarrators}
                users={users}
                currentUser={currentUser}
                theme={theme}
              />

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  تحديث ملف الكتاب (PDF) - اختياري:
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 ${
                    theme === "dark"
                      ? "bg-slate-950 border-slate-800 focus:ring-amber-500 text-white"
                      : "bg-slate-50 border-slate-300 focus:ring-amber-500"
                  }`}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUploading
                    ? "جاري الرفع والحفظ..."
                    : "حفظ التعديلات والتحديث"}
                </button>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => setEditingBook(null)}
                  className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-3xl border border-rose-500/40 bg-slate-900 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">
                  تأكيد حذف الكتاب
                </h3>
                <p className="text-xs text-rose-300">
                  إجراء حساس ولا يمكن التراجع عنه
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              هل أنت متأكد من حذف مشروع كتاب{" "}
              <strong className="text-amber-400">"{deletingBook.title}"</strong>{" "}
              للمؤلف{" "}
              <span className="text-slate-100">{deletingBook.author}</span>؟
              سيمحى الكتاب من قاعدة البيانات والمنصة بشكل نهائي.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={confirmDeleteBook}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30 cursor-pointer transition-all"
              >
                نعم، أكد الحذف النهائياً
              </button>
              <button
                onClick={() => setDeletingBook(null)}
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
                  حذف جماعي للكتب ({selectedIds.length})
                </h3>
                <p className="text-xs text-rose-300">
                  حذف مجموعة كتب دفعة واحدة
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              هل أنت متأكد حتماً من حذف{" "}
              <strong className="text-amber-400 font-bold">
                {selectedIds.length}
              </strong>{" "}
              كتب تم تحديدها بشكل نهائي من قاعدة البيانات والمنصة؟
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={confirmBatchDeleteBooks}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30 cursor-pointer transition-all"
              >
                نعم، حذف الكتب المحددة نهائياً
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
    </div>
  );
};
