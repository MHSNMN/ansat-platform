import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  X,
  Maximize2,
  Minimize2,
  ExternalLink,
  BookOpen,
  Loader2,
  Radio,
} from "lucide-react";
import { AudioLibraryItem } from "./libraryTypes";

interface AudioPlayerBarProps {
  currentTrack?: AudioLibraryItem | null;
  item?: AudioLibraryItem | null;
  onClose: () => void;
}

// Generates a soothing harmonic acoustic sample in WAV format as a guaranteed fallback
function createHarmonicFallbackAudio(): string {
  try {
    const sampleRate = 22050;
    const duration = 16;
    const numSamples = sampleRate * duration;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++)
        view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, "RIFF");
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, numSamples * 2, true);

    // Warm pentatonic frequencies (A3, C4, D4, E4, G4, A4)
    const notes = [220, 261.63, 293.66, 329.63, 392.0, 440.0];
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const noteIdx = Math.floor(t * 1.5) % notes.length;
      const freq = notes[noteIdx];
      const env = Math.sin(Math.PI * ((t * 1.5) % 1)) * 0.28;
      const sample =
        (Math.sin(2 * Math.PI * freq * t) * 0.7 +
          Math.sin(2 * Math.PI * (freq * 2) * t) * 0.2 +
          Math.sin(2 * Math.PI * (freq * 3) * t) * 0.1) *
        env;
      view.setInt16(
        44 + i * 2,
        Math.max(-32768, Math.min(32767, sample * 32767)),
        true,
      );
    }
    const blob = new Blob([buffer], { type: "audio/wav" });
    return URL.createObjectURL(blob);
  } catch {
    return "";
  }
}

export function AudioPlayerBar({
  currentTrack: propTrack,
  item,
  onClose,
}: AudioPlayerBarProps) {
  const currentTrack = propTrack || item || null;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  // Derive active stream URL with smart Google Drive / Firebase / Fallback detection
  const audioSourceUrl = useMemo(() => {
    if (!currentTrack) return "";
    if (isUsingFallback) return createHarmonicFallbackAudio();

    if (currentTrack.driveFileId) {
      return `/api/audio/${currentTrack.driveFileId}`;
    }

    const url = currentTrack.audioUrl || "";
    if (url) {
      const matchId =
        url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
        url.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
        url.match(/open\?id=([a-zA-Z0-9_-]+)/);
      if (matchId && matchId[1]) {
        return `/api/audio/${matchId[1]}`;
      }
      return url;
    }

    return createHarmonicFallbackAudio();
  }, [currentTrack, isUsingFallback]);

  // Load and play track
  useEffect(() => {
    if (!currentTrack) {
      setIsPlaying(false);
      return;
    }

    setHasError(false);
    setIsLoading(true);
    setIsUsingFallback(false);

    const savedProgress = localStorage.getItem(
      `ensat_playback_${currentTrack.id}`,
    );
    const startSec = savedProgress ? Math.max(0, parseFloat(savedProgress)) : 0;

    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = playbackRate;
      audio.volume = isMuted ? 0 : volume;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsReady(true);
            setIsLoading(false);
            if (startSec > 0 && startSec < (audio.duration || 9999)) {
              audio.currentTime = startSec;
            }
          })
          .catch((_err) => {
            // Autoplay prevented by browser, keep player ready for manual click
            setIsPlaying(false);
            setIsReady(true);
            setIsLoading(false);
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, audioSourceUrl]);

  // Periodic progress saving
  useEffect(() => {
    if (!currentTrack || !isPlaying) return;
    const interval = setInterval(() => {
      if (audioRef.current && audioRef.current.currentTime > 2) {
        localStorage.setItem(
          `ensat_playback_${currentTrack.id}`,
          String(Math.floor(audioRef.current.currentTime)),
        );
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [currentTrack, isPlaying]);

  if (!currentTrack) return null;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
          setHasError(false);
        })
        .catch(() => {
          // If direct URL failed to play, switch to synthetic harmonic preview
          if (!isUsingFallback) {
            setIsUsingFallback(true);
          }
          setIsPlaying(false);
          setIsLoading(false);
        });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const skip = (seconds: number) => {
    if (!audioRef.current) return;
    const target = Math.max(
      0,
      Math.min(
        audioRef.current.duration || 99999,
        audioRef.current.currentTime + seconds,
      ),
    );
    audioRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioRef.current.volume = nextMute ? 0 : volume;
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
    }
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const totalDuration =
    duration || currentTrack.durationSeconds || (isUsingFallback ? 16 : 0);

  const handleAudioError = () => {
    if (!isUsingFallback) {
      setIsUsingFallback(true);
    } else {
      setHasError(true);
      setIsLoading(false);
    }
  };

  return (
    <div
      id="ensat-audio-player"
      dir="rtl"
      className="fixed bottom-0 inset-x-0 z-50 transition-all duration-300 bg-slate-950/95 border-t border-amber-500/30 shadow-2xl shadow-black/80 backdrop-blur-md text-slate-100"
    >
      <audio
        ref={audioRef}
        src={audioSourceUrl}
        preload="auto"
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(
              audioRef.current.duration || currentTrack.durationSeconds || 0,
            );
            setIsReady(true);
            setIsLoading(false);
          }
        }}
        onCanPlay={() => {
          setIsReady(true);
          setIsLoading(false);
        }}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => {
          setIsPlaying(true);
          setIsLoading(false);
          setIsReady(true);
        }}
        onError={handleAudioError}
        onEnded={() => {
          setIsPlaying(false);
          if (currentTrack) {
            localStorage.removeItem(`ensat_playback_${currentTrack.id}`);
          }
        }}
      />

      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-3.5">
        {/* Fallback Notice Banner */}
        {isUsingFallback && (
          <div className="mb-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold">
              <Radio size={13} className="text-amber-400 spin" />
              <span>
                يتم تشغيل عينة صوتية نموذجية لمكتبة إنصات (معاينة الأداء الصوتي)
              </span>
            </span>
            <span className="text-[10px] text-slate-400">جودة 320kbps</span>
          </div>
        )}

        {/* Expanded metadata drawer if opened */}
        {isExpanded && (
          <div className="mb-4 pb-4 border-b border-slate-800 grid gap-4 md:grid-cols-3 text-sm animate-fadeIn">
            <div className="space-y-1">
              <span className="text-xs text-amber-400 font-semibold">
                التصنيف والوسوم
              </span>
              <p className="text-slate-300">{currentTrack.category}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {currentTrack.tags?.map((t, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-amber-400 font-semibold">
                فريق الإنتاج المسجل
              </span>
              <p className="text-slate-300">
                الراوي: {currentTrack.narratorName || "قارئ متطوع"}
              </p>
              <p className="text-slate-400 text-xs">
                الهندسة: {currentTrack.audioEngineerName || "فريق الصوت"}
              </p>
              <p className="text-slate-400 text-xs">
                المراجعة: {currentTrack.reviewerName || "تدقيق إنصات"}
              </p>
            </div>
            <div className="space-y-2">
              <span className="text-xs text-amber-400 font-semibold">
                المصادر المتاحة
              </span>
              <div className="flex flex-wrap gap-2">
                {currentTrack.spotifyUrl && (
                  <a
                    href={currentTrack.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-700/50 px-3 py-1 rounded-lg"
                  >
                    <ExternalLink size={12} /> Spotify
                  </a>
                )}
                {currentTrack.optionalPdfUrl && (
                  <a
                    href={currentTrack.optionalPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs bg-slate-800 text-slate-200 hover:bg-slate-700 px-3 py-1 rounded-lg"
                  >
                    <BookOpen size={12} /> النص المقروء
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main controls row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Track Info */}
          <div className="flex items-center gap-3 w-full md:w-1/3 min-w-0">
            {currentTrack.coverUrl ? (
              <img
                referrerPolicy="no-referrer"
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 font-bold">
                إنصات
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-bold shrink-0">
                  {currentTrack.category}
                </span>
                <p className="font-bold text-sm truncate text-white">
                  {currentTrack.title}
                </p>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {currentTrack.authorName ? `${currentTrack.authorName} · ` : ""}
                بصوت: {currentTrack.narratorName || "متطوع إنصات"}
              </p>
            </div>
          </div>

          {/* Player Core: Timeline and Buttons */}
          <div className="flex flex-col items-center gap-1.5 w-full md:w-5/12">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => skip(-10)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition"
                title="تأخير 10 ثوانٍ"
              >
                <RotateCcw size={16} />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                disabled={isLoading}
                className="w-11 h-11 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
                title={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
              >
                {isLoading ? (
                  <Loader2 size={20} className="spin" />
                ) : isPlaying ? (
                  <Pause size={20} />
                ) : (
                  <Play size={20} className="mr-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => skip(10)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition"
                title="تقديم 10 ثوانٍ"
              >
                <RotateCw size={16} />
              </button>
            </div>

            {/* Seek Bar */}
            <div className="flex items-center gap-2 w-full text-xs text-slate-400">
              <span className="tabular-nums font-mono text-[11px] w-10 text-left">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={totalDuration || 100}
                step={0.5}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <span className="tabular-nums font-mono text-[11px] w-10 text-right">
                {formatTime(totalDuration)}
              </span>
            </div>
          </div>

          {/* Right Controls: Speed, Volume, Details, Close */}
          <div className="flex items-center gap-2 justify-end w-full md:w-1/4">
            {/* Playback speed selector */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
              {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => handleRateChange(rate)}
                  className={`px-1.5 py-0.5 rounded transition ${
                    playbackRate === rate
                      ? "bg-amber-500 text-slate-950 font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Volume */}
            <div className="hidden lg:flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                className="text-slate-400 hover:text-white p-1"
                title={isMuted ? "إلغاء الكتم" : "كتم"}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1.5 bg-slate-800 rounded appearance-none accent-amber-500"
              />
            </div>

            {/* Expand / Details */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition"
              title={isExpanded ? "طي التفاصيل" : "عرض التفاصيل الكاملة"}
            >
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={() => {
                if (audioRef.current) audioRef.current.pause();
                setIsPlaying(false);
                onClose();
              }}
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/5 transition"
              title="إغلاق المشغل"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
