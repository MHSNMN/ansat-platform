// @ts-nocheck
import React, { useState, useRef } from "react";
import { Mic, Square, RotateCcw, Plus, X, Play, Pause } from "lucide-react";

interface AudioRecorderProps {
  onRecordingComplete: (file: File) => void;
}

export default function AudioRecorder({
  onRecordingComplete,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Preview State
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const supportedMime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";

      const mediaRecorder = new MediaRecorder(
        stream,
        supportedMime ? { mimeType: supportedMime } : undefined,
      );
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const mime = supportedMime || "audio/webm";
        const ext = (mime || "").includes("mp4") ? "mp4" : "webm";
        const audioBlob = new Blob(chunksRef.current, { type: mime });
        const file = new File([audioBlob], `recording_${Date.now()}.${ext}`, {
          type: mime,
        });
        const url = URL.createObjectURL(file);

        setRecordedFile(file);
        setAudioUrl(url);

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start(200); // chunk every 200ms
      setIsRecording(true);
      setRecordingTime(0);
      setRecordedFile(null);
      setAudioUrl(null);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("تعذر الوصول إلى الميكروفون. يرجى السماح بالصلاحيات.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleAdd = () => {
    if (recordedFile) {
      onRecordingComplete(recordedFile);
      handleCancel(); // Reset state
    }
  };

  const handleCancel = () => {
    setRecordedFile(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingTime(0);
    setIsPlayingPreview(false);
  };

  const handleRetry = () => {
    handleCancel();
    startRecording();
  };

  const togglePlayPreview = async () => {
    if (audioRef.current) {
      try {
        if (isPlayingPreview) {
          audioRef.current.pause();
          setIsPlayingPreview(false);
        } else {
          await audioRef.current.play();
          setIsPlayingPreview(true);
        }
      } catch (err) {
        console.warn("Playback interrupted safely:", err);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col gap-4 bg-slate-900 border border-slate-700 p-4 rounded-xl">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlayingPreview(false)}
          className="hidden"
        />
      )}

      {!isRecording && !recordedFile ? (
        <button
          type="button"
          onClick={startRecording}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all font-bold text-sm w-full sm:w-auto self-start"
        >
          <Mic className="w-5 h-5" />
          بدء تسجيل صوتي جديد
        </button>
      ) : isRecording ? (
        <div className="flex items-center gap-4 w-full">
          <div className="flex items-center gap-2 text-red-500 animate-pulse">
            <Mic className="w-5 h-5" />
            <span className="font-mono text-lg">
              {formatTime(recordingTime)}
            </span>
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all font-bold text-sm"
          >
            <Square className="w-4 h-4" />
            إيقاف التسجيل
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlayPreview}
              className="w-10 h-10 rounded-full bg-amber-500 text-slate-900 flex items-center justify-center hover:scale-105 transition-transform"
            >
              {isPlayingPreview ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-1" />
              )}
            </button>
            <div className="text-slate-300 font-mono text-sm">
              {formatTime(recordingTime)}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto w-full sm:w-auto">
            <button
              type="button"
              onClick={handleRetry}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all text-xs font-bold"
            >
              <RotateCcw className="w-4 h-4" />
              إعادة
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-rose-500/10 text-rose-400 rounded-lg hover:bg-rose-500/20 transition-all text-xs font-bold"
            >
              <X className="w-4 h-4" />
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition-all text-sm font-bold"
            >
              <Plus className="w-4 h-4" />
              إضافة للقائمة
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
