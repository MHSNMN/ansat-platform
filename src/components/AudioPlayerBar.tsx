import React, { useState, useRef, useEffect } from "react";
import { AudioRecording, ThemeMode } from "../types";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  X,
  RotateCcw,
  RotateCw,
  Zap,
  HardDrive,
  RefreshCcw,
  AlertCircle,
} from "lucide-react";
import { getAudioCache } from "../lib/audioCache";
import { downloadRecordingDirectly } from "../lib/downloadHelper";

interface AudioPlayerBarProps {
  recording: AudioRecording | null;
  onClose: () => void;
  theme: ThemeMode;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  recording,
  onClose,
  theme,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [durationSeconds, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // New States for tracking source, fallback notifications, and errors
  const [streamSource, setStreamSource] = useState<
    "firebase" | "drive" | "cached" | "local" | "synth" | "unknown"
  >("unknown");
  const [sourceNotice, setSourceNotice] = useState<string>("");
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const synthFallbackUrlRef = useRef<string | null>(null);

  const getSyntheticWavUrl = () => {
    if (synthFallbackUrlRef.current) return synthFallbackUrlRef.current;
    try {
      const sampleRate = 22050;
      const durationSeconds = 12;
      const numSamples = sampleRate * durationSeconds;
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
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeString(36, "data");
      view.setUint32(40, numSamples * 2, true);
      const freqs = [220, 277.18, 329.63, 440, 554.37, 659.25];
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const noteIdx = Math.floor(t * 2.5) % freqs.length;
        const freq = freqs[noteIdx];
        const env = Math.sin(Math.PI * ((t * 2.5) % 1));
        const sample = Math.sin(2 * Math.PI * freq * t) * 0.22 * env;
        view.setInt16(
          44 + i * 2,
          Math.max(-32768, Math.min(32767, sample * 32767)),
          true,
        );
      }
      const blob = new Blob([buffer], { type: "audio/wav" });
      synthFallbackUrlRef.current = URL.createObjectURL(blob);
      return synthFallbackUrlRef.current;
    } catch (e) {
      return "";
    }
  };

  const getFirebaseUrl = (): string => {
    if (!recording) return "";
    const candidates = [
      recording.masteredUrl,
      recording.rawUrl,
      recording.rawUrl,
      recording.rawUrl,
    ];
    for (const url of candidates) {
      if (
        url &&
        (url.includes("firebasestorage.googleapis.com") ||
          url.includes("storage.googleapis.com"))
      ) {
        return url;
      }
    }
    return "";
  };

  const getDriveUrl = (): string => {
    if (!recording) return "";
    const explicitId =
      recording.rawDriveFileId ||
      (recording as any).drive_file_id ||
      (recording as any).driveFileId;
    if (
      explicitId &&
      typeof explicitId === "string" &&
      explicitId.length > 10 &&
      !explicitId.includes("/")
    ) {
      return `/api/audio/${encodeURIComponent(explicitId)}`;
    }

    const candidates = [
      recording.masteredUrl,
      (recording as any).mastered_file_url,
      recording.rawUrl,
      (recording as any).file_url,
      (recording as any).drive_url,
      (recording as any).public_link,
    ].filter(Boolean);

    for (const url of candidates) {
      if (!url || typeof url !== "string") continue;
      if (url.includes("/my-drive") || url.includes("/folders/")) continue;
      if (url.startsWith("/api/audio/")) {
        return url;
      }

      const matchId =
        url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
        url.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
        url.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
        url.match(/open\?id=([a-zA-Z0-9_-]+)/) ||
        url.match(/\/api\/audio\/([a-zA-Z0-9_-]+)/);
      if (matchId && matchId[1] && matchId[1].length > 10) {
        return `/api/audio/${encodeURIComponent(matchId[1])}`;
      }
    }
    return "";
  };

  const getDirectUrl = (): string => {
    if (!recording) return "";
    const candidates = [
      recording.masteredUrl,
      (recording as any).mastered_file_url,
      recording.rawUrl,
      (recording as any).file_url,
    ].filter(Boolean);
    for (const u of candidates) {
      if (
        typeof u === "string" &&
        u.trim() &&
        !u.includes("/my-drive") &&
        !u.includes("/folders/")
      ) {
        return u.trim();
      }
    }
    return "";
  };

  const getLocalUrl = (): string => {
    if (!recording) return "";
    const candidates = [
      recording.rawUrl,
      recording.masteredUrl,
      (recording as any).file_url,
    ];
    for (const url of candidates) {
      if (url && typeof url === "string" && url.includes("/api/local-audio/")) {
        return url;
      }
    }
    return "";
  };

  const loadAndPlayAudio = () => {
    if (!recording || !audioRef.current) return;

    setHasError(false);
    setIsLoading(true);
    setIsPlaying(false);
    setSourceNotice("");

    // Playback Strategy:
    // 1. Cached in memory
    // 2. Google Drive stream proxy (/api/audio/:fileId)
    // 3. Direct/Firebase Storage
    // 4. Local Server
    // 5. Synthetic generator
    const cachedUrl =
      getAudioCache(recording.id) || getAudioCache(recording.rawUrl);
    const firebaseUrl = getFirebaseUrl();
    const driveUrl = getDriveUrl();
    const directUrl = getDirectUrl();
    const localUrl = getLocalUrl();

    let sourceUrl = "";
    let selectedSource: "cached" | "firebase" | "drive" | "local" | "synth" =
      "synth";

    if (cachedUrl) {
      sourceUrl = cachedUrl;
      selectedSource = "cached";
    } else if (driveUrl) {
      sourceUrl = driveUrl;
      selectedSource = "drive";
    } else if (directUrl && !directUrl.includes("/my-drive")) {
      sourceUrl = directUrl;
      selectedSource = directUrl.includes("googleapis.com")
        ? "firebase"
        : "drive";
    } else if (firebaseUrl) {
      sourceUrl = firebaseUrl;
      selectedSource = "firebase";
    } else if (localUrl) {
      sourceUrl = localUrl;
      selectedSource = "local";
    } else {
      sourceUrl = getSyntheticWavUrl();
      selectedSource = "synth";
      setSourceNotice(
        "ℹ️ هذا التسجيل مرتبط بمجلد أو مسودة Drive ولم يتوفر له ملف صوتي مباشر للتشغيل الفوري.",
      );
    }

    setStreamSource(selectedSource as any);
    audioRef.current.src = sourceUrl;
    audioRef.current.playbackRate = playbackSpeed;

    audioRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn("Initial playback rejected, handling fallback:", err);
        handleAudioError();
      });
  };

  const handleAudioError = () => {
    console.warn("Audio playback error occurred on source:", streamSource);

    // If drive /api/audio/:fileId failed, try download endpoint or direct Google export
    if (streamSource === "drive" && audioRef.current) {
      const explicitId =
        recording?.rawDriveFileId ||
        (recording as any)?.drive_file_id ||
        (recording as any)?.driveFileId;
      if (explicitId) {
        const downloadUrl = `/api/audio/download/${encodeURIComponent(explicitId)}`;
        const directDriveUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(explicitId)}&export=download`;

        if (!audioRef.current.src.includes("/download/")) {
          setSourceNotice("⚡ جارٍ استخدام مسار البث المباشر البديل...");
          setTimeout(() => setSourceNotice(""), 5000);
          audioRef.current.src = downloadUrl;
          audioRef.current
            .play()
            .then(() => {
              setIsPlaying(true);
              setHasError(false);
              setIsLoading(false);
            })
            .catch(() => {
              // Try direct Google Drive content URL
              if (audioRef.current) {
                audioRef.current.src = directDriveUrl;
                audioRef.current
                  .play()
                  .then(() => {
                    setIsPlaying(true);
                    setHasError(false);
                    setIsLoading(false);
                  })
                  .catch(() => {
                    handleDriveOrLocalFallback();
                  });
              }
            });
          return;
        }
      }
    }

    // Auto-fallback from Firebase -> Google Drive
    if (streamSource === "firebase") {
      const driveUrl = getDriveUrl();
      if (driveUrl && audioRef.current && audioRef.current.src !== driveUrl) {
        setStreamSource("drive");
        setSourceNotice(
          "⚡ تم التبديل تلقائياً إلى رابط Google Drive الاحتياطي بعد تعذر المصدر الأساسي.",
        );
        setTimeout(() => setSourceNotice(""), 6000);
        audioRef.current.src = driveUrl;
        audioRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
            setHasError(false);
            setIsLoading(false);
          })
          .catch((err) => {
            console.warn(
              "Drive stream fallback also failed, trying local backup:",
              err,
            );
            handleDriveOrLocalFallback();
          });
        return;
      }
    }

    handleDriveOrLocalFallback();
  };

  const handleDriveOrLocalFallback = () => {
    const localUrl = getLocalUrl();
    if (localUrl && audioRef.current && audioRef.current.src !== localUrl) {
      setStreamSource("local");
      setSourceNotice(
        "⚡ تم الانتقال إلى الرابط المحلي على الخادم لضمان استمرار الاستماع.",
      );
      setTimeout(() => setSourceNotice(""), 6000);
      audioRef.current.src = localUrl;
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setHasError(false);
          setIsLoading(false);
        })
        .catch(() => {
          setHasError(true);
          setIsLoading(false);
        });
      return;
    }

    setHasError(true);
    setIsLoading(false);
  };

  useEffect(() => {
    loadAndPlayAudio();
    // Reload only when the selected recording changes. Helper identities are intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording?.id]);

  const playSyntheticFallback = () => {
    if (audioRef.current) {
      setHasError(false);
      setStreamSource("synth");
      audioRef.current.src = getSyntheticWavUrl();
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  if (!recording) return null;

  const togglePlay = async () => {
    if (!audioRef.current) return;
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.log("Playback interrupted safely:", error);
      setHasError(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const handleToggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const renderSourceBadge = () => {
    if (streamSource === "cached") {
      return (
        <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 border border-emerald-500/30">
          <Zap className="w-2.5 h-2.5 text-emerald-400 fill-emerald-400" />
          <span>مخزن محلياً (فوري)</span>
        </span>
      );
    }
    if (
      streamSource === "drive" &&
      Boolean(recording?.rawDriveFileId || (recording as any)?.driveFileId)
    ) {
      return (
        <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 border border-emerald-500/30">
          <HardDrive className="w-2.5 h-2.5 text-emerald-400" />
          <span>Google Drive</span>
        </span>
      );
    }
    if (streamSource === "local") {
      return (
        <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 border border-amber-500/30">
          <HardDrive className="w-2.5 h-2.5 text-amber-400" />
          <span>تخزين محلي مؤقت</span>
        </span>
      );
    }
    if (streamSource === "synth") {
      return (
        <span className="bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 border border-purple-500/30">
          <span>صوت تجريبي (بديل)</span>
        </span>
      );
    }
    return null;
  };

  return (
    <div className="fixed bottom-[52px] md:bottom-0 left-0 right-0 z-40 p-3 sm:p-4 bg-slate-950/95 border-t border-amber-500/30 backdrop-blur-xl shadow-2xl text-white animate-slide-up dir-rtl">
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        onError={handleAudioError}
      />

      {sourceNotice && (
        <div className="max-w-7xl mx-auto mb-2.5 flex items-center justify-between bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg text-amber-300 text-xs animate-fade-in shadow-lg">
          <div className="flex items-center gap-2">
            <span className="font-bold">{sourceNotice}</span>
          </div>
          <button
            onClick={() => setSourceNotice("")}
            className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800"
          >
            إغلاق
          </button>
        </div>
      )}

      {hasError && (
        <div className="max-w-7xl mx-auto mb-3 flex items-center justify-between bg-rose-500/10 border border-rose-500/30 p-2 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4" />
            <span>تعذر تشغيل الملف الصوتي من المصدر.</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={playSyntheticFallback}
              className="text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 px-3 py-1 rounded transition"
            >
              تشغيل بديل تجريبي
            </button>
            <button
              onClick={loadAndPlayAudio}
              className="text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 px-3 py-1 rounded flex items-center gap-1 transition"
            >
              <RefreshCcw className="w-3 h-3" />
              إعادة المحاولة
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Track Title & Meta */}
        <div className="flex items-center gap-3 w-full md:w-1/4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shrink-0">
            <Volume2
              className={`w-5 h-5 ${isPlaying ? "animate-pulse" : ""}`}
            />
          </div>
          <div className="truncate">
            <h4 className="text-xs font-bold text-amber-400 truncate">
              {String(
                (recording as any).book_title ||
                  (recording as any).bookTitle ||
                  recording.bookId ||
                  "كتاب صوتي",
              )}{" "}
              - الجزء {recording.partNumber}
            </h4>
            <div className="text-[10px] text-slate-400 truncate flex items-center gap-2 mt-0.5">
              <span>الراوي: {recording.narratorId}</span>
              {renderSourceBadge()}
            </div>
          </div>
        </div>

        {/* Playback Controls & Waveform Progress Bar */}
        <div className="flex flex-col items-center gap-2 w-full md:w-2/4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (audioRef.current) audioRef.current.currentTime -= 10;
              }}
              className="text-slate-400 hover:text-white p-1"
              title="تراجع 10 ثوانٍ"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={togglePlay}
              disabled={hasError}
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform ${
                hasError
                  ? "bg-slate-800 text-slate-500"
                  : "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:scale-105 shadow-amber-500/30"
              }`}
            >
              {isLoading ? (
                <RefreshCcw className="w-4 h-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={() => {
                if (audioRef.current) audioRef.current.currentTime += 10;
              }}
              className="text-slate-400 hover:text-white p-1"
              title="تقدم 10 ثوانٍ"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 w-full text-xs font-mono text-slate-400">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={durationSeconds || 100}
              value={currentTime}
              onChange={handleSeek}
              disabled={hasError}
              className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <span>{formatTime(durationSeconds)}</span>
          </div>
        </div>

        {/* Extra Controls */}
        <div className="flex items-center justify-end gap-3 w-full md:w-1/4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMute}
              className="text-slate-400 hover:text-amber-400 transition-colors p-1"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const vol = Number(e.target.value);
                setVolume(vol);
                if (audioRef.current) audioRef.current.volume = vol;
                if (vol > 0 && isMuted) setIsMuted(false);
              }}
              className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          <div className="h-4 w-px bg-slate-700 mx-1"></div>

          <select
            value={playbackSpeed}
            onChange={(e) => handleSpeedChange(Number(e.target.value))}
            className="bg-transparent text-xs text-slate-300 outline-none cursor-pointer border border-slate-700 rounded p-1"
          >
            <option value={0.5} className="bg-slate-900">
              0.5x
            </option>
            <option value={1} className="bg-slate-900">
              1x
            </option>
            <option value={1.25} className="bg-slate-900">
              1.25x
            </option>
            <option value={1.5} className="bg-slate-900">
              1.5x
            </option>
            <option value={2} className="bg-slate-900">
              2x
            </option>
          </select>

          <button
            onClick={() => downloadRecordingDirectly(recording)}
            className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors ml-1"
            title="تنزيل الملف"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-rose-400 p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
