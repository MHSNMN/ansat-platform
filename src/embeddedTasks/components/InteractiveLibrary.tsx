// @ts-nocheck
import React, { useMemo, useState, useEffect, useRef } from "react";
import { BOOKS_LIBRARY } from "../data/mockData";
import { Book, BookChapter, BookSentence } from "../types";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  FastForward,
  BookOpen,
  Sparkles,
  Type,
  Bookmark,
  Sun,
  Moon,
} from "lucide-react";

interface InteractiveLibraryProps {
  isPlayingGlobal: boolean;
  onToggleGlobalPlay: () => void;
}

export const InteractiveLibrary: React.FC<InteractiveLibraryProps> = ({
  isPlayingGlobal,
  onToggleGlobalPlay,
}) => {
  const [selectedBook, setSelectedBook] = useState<Book>(BOOKS_LIBRARY[0]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(65); // default 65 seconds chapter 1
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [readerTheme, setReaderTheme] = useState<"dark" | "paper">("dark");
  const [fontSize, setFontSize] = useState<number>(18);
  const [activeSentenceId, setActiveSentenceId] = useState<number>(1);
  const [bookmarkedSentences, setBookmarkedSentences] = useState<number[]>([]);

  const currentChapter: BookChapter = useMemo(
    () =>
      selectedBook.chapters[currentChapterIndex] || {
        id: "c1",
        title: "فصل في المحبة",
        duration: "03:45",
        audioSrc: "",
        sentences: [],
      },
    [currentChapterIndex, selectedBook.chapters],
  );

  // Timer reference for simulated audio time accumulation
  const timerRef = useRef<number | null>(null);

  // Sync sentence highlighting with current timestamp
  useEffect(() => {
    if (!currentChapter.sentences || currentChapter.sentences.length === 0)
      return;

    const currentSentence = currentChapter.sentences.find(
      (s) => currentTime >= s.startTime && currentTime < s.endTime,
    );

    if (currentSentence) {
      setActiveSentenceId(currentSentence.id);
    } else if (
      currentTime >=
      (currentChapter.sentences[currentChapter.sentences.length - 1]?.endTime ||
        60)
    ) {
      // End of chapter loop or pause
      setActiveSentenceId(
        currentChapter.sentences[currentChapter.sentences.length - 1]?.id || 1,
      );
    }
  }, [currentTime, currentChapter]);

  // Handle Playback Loop
  useEffect(() => {
    if (isPlayingGlobal) {
      const intervalMs = 100 / playbackSpeed;
      timerRef.current = window.setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            return 0; // Loop or chapter end
          }
          return prev + 0.1;
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlayingGlobal, duration, playbackSpeed]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
  };

  const handleSentenceClick = (sentence: BookSentence) => {
    setCurrentTime(sentence.startTime);
    setActiveSentenceId(sentence.id);
    if (!isPlayingGlobal) {
      onToggleGlobalPlay();
    }
  };

  const toggleBookmark = (sentenceId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (bookmarkedSentences.includes(sentenceId)) {
      setBookmarkedSentences(
        bookmarkedSentences.filter((id) => id !== sentenceId),
      );
    } else {
      setBookmarkedSentences([...bookmarkedSentences, sentenceId]);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <section
      id="library"
      className="py-24 bg-slate-950 relative overflow-hidden"
    >
      {/* Background Accent Glows */}
      <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-12">
        {/* Section Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800 pb-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
              <Sparkles className="w-4 h-4" />
              <span>قلب المنصة التفاعلية</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white font-['Cairo']">
              المكتبة التفاعلية{" "}
              <span className="text-amber-400">ومشغل تزامن النص والصوت</span>
            </h2>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl">
              اختر الكتاب وافتتح تجربة الإنصات الفريدة؛ حيث يضيء النص المكتوب
              تلقائياً مع الكلمة والجملة المنطوقة، ويمكنك الضغط على أي سطر
              للانتقال الصوتي المباشر إليه.
            </p>
          </div>

          {/* Book Selector Pills */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {BOOKS_LIBRARY.map((book) => (
              <button
                key={book.id}
                onClick={() => {
                  setSelectedBook(book);
                  setCurrentChapterIndex(0);
                  setCurrentTime(0);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedBook.id === book.id
                    ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                    : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"
                }`}
              >
                {book.title}
              </button>
            ))}
          </div>
        </div>

        {/* Core Audio Player & Synchronized Text Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left/Main Column: Synchronized Text Display (Box of Core Functionality) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Reading Settings Control Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>ميزة التزامن: </span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                  مفعلة تلقائياً
                </span>
              </div>

              <div className="flex items-center gap-4">
                {/* Font Size Selector */}
                <div className="flex items-center gap-2">
                  <Type className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] text-slate-400">حجم الخط:</span>
                  <button
                    onClick={() => setFontSize(Math.max(14, fontSize - 2))}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className="font-bold text-white w-4 text-center">
                    {fontSize}
                  </span>
                  <button
                    onClick={() => setFontSize(Math.min(26, fontSize + 2))}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>

                {/* Reader Theme Switcher */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setReaderTheme("dark")}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold ${
                      readerTheme === "dark"
                        ? "bg-amber-500 text-slate-950 font-bold"
                        : "text-slate-400"
                    }`}
                  >
                    <Moon className="w-3 h-3" />
                    <span>داكن</span>
                  </button>
                  <button
                    onClick={() => setReaderTheme("paper")}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold ${
                      readerTheme === "paper"
                        ? "bg-amber-100 text-slate-900 font-bold"
                        : "text-slate-400"
                    }`}
                  >
                    <Sun className="w-3 h-3" />
                    <span>ورقي</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Synchronized Text Box (The Interactive Karaoke Text Canvas) */}
            <div
              className={`p-6 sm:p-10 rounded-3xl border shadow-2xl transition-colors duration-300 min-h-[380px] flex flex-col justify-between ${
                readerTheme === "dark"
                  ? "bg-slate-900/90 border-slate-800 text-slate-100"
                  : "bg-stone-100 border-stone-300 text-stone-900"
              }`}
            >
              {/* Text Header */}
              <div className="flex items-center justify-between pb-6 border-b border-slate-800/60 mb-6">
                <div>
                  <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">
                    النص المتزامن • {selectedBook.title}
                  </span>
                  <h3 className="text-xl font-bold font-['Cairo'] mt-1">
                    {currentChapter.title}
                  </h3>
                </div>
                <div className="text-xs text-slate-400 bg-slate-800/40 px-3 py-1.5 rounded-xl border border-slate-700/50">
                  اضغط على أي جملة للاستماع إليها مباشرة 🎧
                </div>
              </div>

              {/* Sentences Container */}
              <div className="space-y-6 my-4 leading-loose">
                {currentChapter.sentences &&
                currentChapter.sentences.length > 0 ? (
                  currentChapter.sentences.map((sentence) => {
                    const isActive = activeSentenceId === sentence.id;
                    const isBookmarked = bookmarkedSentences.includes(
                      sentence.id,
                    );

                    return (
                      <div
                        key={sentence.id}
                        onClick={() => handleSentenceClick(sentence)}
                        style={{ fontSize: `${fontSize}px` }}
                        className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 relative group font-['Cairo'] ${
                          isActive
                            ? "text-highlight-glow bg-amber-500/15 border-r-4 border-amber-400 font-bold shadow-lg shadow-amber-500/5 scale-[1.01]"
                            : readerTheme === "dark"
                              ? "hover:bg-slate-800/60 text-slate-300"
                              : "hover:bg-stone-200/80 text-stone-800"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          {/* Active Indicator Wave Icon */}
                          <div className="shrink-0 pt-1">
                            {isActive ? (
                              <div className="flex items-center gap-1 h-4">
                                <span className="w-1 bg-amber-400 rounded-full animate-wave-1"></span>
                                <span className="w-1 bg-amber-400 rounded-full animate-wave-2"></span>
                                <span className="w-1 bg-amber-400 rounded-full animate-wave-3"></span>
                              </div>
                            ) : (
                              <span className="text-xs font-mono text-slate-500 group-hover:text-amber-400 transition-colors">
                                {formatTime(sentence.startTime)}
                              </span>
                            )}
                          </div>

                          {/* Sentence Text */}
                          <p className="flex-1 text-right leading-relaxed font-medium">
                            {sentence.text}
                          </p>

                          {/* Bookmark Action */}
                          <button
                            onClick={(e) => toggleBookmark(sentence.id, e)}
                            className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${
                              isBookmarked
                                ? "opacity-100 text-amber-400"
                                : "text-slate-500 hover:text-amber-300"
                            }`}
                            title="إضافة علامة مرجعية"
                          >
                            <Bookmark
                              className={`w-4 h-4 ${isBookmarked ? "fill-current" : ""}`}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-slate-400 space-y-2">
                    <BookOpen className="w-10 h-10 mx-auto text-slate-600 animate-pulse" />
                    <p>جارٍ تجهيز النص المتزامن لهذا الفصل...</p>
                  </div>
                )}
              </div>

              {/* Text Box Footer Info */}
              <div className="pt-6 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-xs text-slate-400">
                <span>قارئ النص التفاعلي - إصدار إنصات v2.4</span>
                <span className="text-amber-400 font-semibold">
                  {bookmarkedSentences.length > 0 &&
                    `علامات مرجعية محفوظة (${bookmarkedSentences.length})`}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Custom Audio Player UI & Book Details */}
          <div className="lg:col-span-4 space-y-6">
            {/* Book Cover & Chapter Player Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
              {/* Cover Image & Metadata */}
              <div className="relative aspect-4/3 rounded-2xl overflow-hidden border border-slate-700/80 group">
                <img
                  src={selectedBook.coverImage}
                  alt={selectedBook.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>

                {/* Playing Badge */}
                <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${isPlayingGlobal ? "bg-amber-400 animate-ping" : "bg-slate-500"}`}
                  ></span>
                  <span>{isPlayingGlobal ? "جارٍ التشغيل" : "متوقف"}</span>
                </div>

                <div className="absolute bottom-3 right-3 left-3 text-right">
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {selectedBook.category}
                  </span>
                  <h4 className="text-lg font-black text-white font-['Cairo'] mt-1">
                    {selectedBook.title}
                  </h4>
                  <p className="text-xs text-slate-300 font-medium">
                    {selectedBook.author}
                  </p>
                </div>
              </div>

              {/* Chapter Selector Dropdown */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 block text-right">
                  اختر الفصل الصوتى:
                </label>
                <select
                  value={currentChapterIndex}
                  onChange={(e) => {
                    setCurrentChapterIndex(Number(e.target.value));
                    setCurrentTime(0);
                  }}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold font-['Cairo'] focus:border-amber-500 focus:outline-none"
                >
                  {selectedBook.chapters.map((ch, idx) => (
                    <option key={ch.id} value={idx}>
                      {ch.title} ({ch.duration})
                    </option>
                  ))}
                </select>
              </div>

              {/* Progress Bar Seek Slider */}
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max={duration}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Main Audio Controls */}
              <div className="flex items-center justify-center gap-4 py-2">
                {/* Rewind 10s */}
                <button
                  onClick={() =>
                    setCurrentTime((prev) => Math.max(0, prev - 10))
                  }
                  className="p-2.5 rounded-full bg-slate-950 hover:bg-slate-800 text-slate-300 transition-colors"
                  title="تأخير 10 ثوانٍ"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>

                {/* Main Play / Pause Button */}
                <button
                  onClick={onToggleGlobalPlay}
                  className="p-5 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black shadow-xl shadow-amber-500/30 hover:scale-105 transition-all"
                  aria-label="تشغيل / إيقاف"
                >
                  {isPlayingGlobal ? (
                    <Pause className="w-7 h-7 fill-current" />
                  ) : (
                    <Play className="w-7 h-7 fill-current ml-0.5" />
                  )}
                </button>

                {/* Forward 10s */}
                <button
                  onClick={() =>
                    setCurrentTime((prev) => Math.min(duration, prev + 10))
                  }
                  className="p-2.5 rounded-full bg-slate-950 hover:bg-slate-800 text-slate-300 transition-colors"
                  title="تقديم 10 ثوانٍ"
                >
                  <FastForward className="w-5 h-5" />
                </button>
              </div>

              {/* Playback Speed Toggles */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800/80 text-xs">
                <span className="text-slate-400 font-bold">سرعة القراءة:</span>
                <div className="flex items-center gap-1">
                  {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all ${
                        playbackSpeed === speed
                          ? "bg-amber-500 text-slate-950 font-black"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-3 text-slate-400 text-xs">
                <button onClick={() => setIsMuted(!isMuted)}>
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-amber-400" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    setIsMuted(false);
                  }}
                  className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Narrator & Translator Info */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">الأداء الصوتي:</span>
                  <span className="text-slate-200 font-bold">
                    {selectedBook.narrator}
                  </span>
                </div>
                {selectedBook.translator && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">الترجمة العربية:</span>
                    <span className="text-slate-200 font-bold">
                      {selectedBook.translator}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
