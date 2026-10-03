// @ts-nocheck
import { AudioRecording } from "../types";
import { getAudioCache } from "./audioCache";
import { toastStore } from "./toastStore";

/**
 * Clean and format standardized Arabic file name for recording downloads
 */
export function getStandardizedRecordingFileName(rec: AudioRecording): string {
  const cleanBook = (rec.bookId || "كتاب")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .trim();
  const partStr =
    rec.partNumber < 10 ? `0${rec.partNumber}` : `${rec.partNumber}`;
  const cleanNarrator = (rec.narratorId || "الراوي")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .trim();
  const stageSuffix =
    rec.workflowStatus === "MASTERING" || rec.workflowStatus === "PUBLISHED"
      ? "_مماستر"
      : "";

  if (rec.masteredUrl && rec.masteredUrl.endsWith(".mp3")) {
    return rec.masteredUrl;
  }
  if (rec.rawUrl && rec.rawUrl.endsWith(".mp3")) {
    return rec.rawUrl;
  }
  return `كتاب_${cleanBook}_الجزء_${partStr}_الراوي_${cleanNarrator}${stageSuffix}.mp3`;
}

/**
 * Extract Google Drive File ID if present in recording or URL
 */
export function extractDriveFileId(rec: AudioRecording): string | null {
  if (rec.rawDriveFileId) return rec.rawDriveFileId;
  const rawUrl =
    rec.masteredUrl || rec.rawUrl || rec.rawUrl || rec.rawUrl || "";
  const match =
    rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
    rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    rawUrl.match(/open\?id=([a-zA-Z0-9_-]+)/);
  return match && match[1] ? match[1] : null;
}

/**
 * Directly downloads the recording file to the user's computer/device.
 * Guarantees direct file saving (.mp3) without redirecting to Google Drive preview!
 */
export async function downloadRecordingDirectly(
  rec: AudioRecording,
  customName?: string,
): Promise<boolean> {
  const fileName = customName || getStandardizedRecordingFileName(rec);

  toastStore.addToast({
    type: "info",
    title: "جاري التحميل المباشر",
    message: `جاري تنزيل الملف (${fileName}) مباشرة إلى جهازك...`,
  });

  try {
    // 1. Check if cached locally in memory as Blob URL
    const cachedUrl =
      getAudioCache(rec.id) ||
      getAudioCache(rec.rawUrl) ||
      (rec.rawUrl?.startsWith("blob:") ? rec.rawUrl : null);
    if (cachedUrl) {
      triggerBrowserDownload(cachedUrl, fileName);
      toastStore.addToast({
        type: "success",
        title: "اكتمل التحميل",
        message: `تم تنزيل ${fileName} بنجاح.`,
      });
      return true;
    }

    // 2. Check for Firebase Storage URL (or other direct HTTP links) first
    const targetUrl = rec.masteredUrl || rec.rawUrl || rec.rawUrl;
    if (
      targetUrl &&
      (targetUrl.includes("firebasestorage.googleapis.com") ||
        targetUrl.includes("supabase.co"))
    ) {
      try {
        const response = await fetch(targetUrl);
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          triggerBrowserDownload(blobUrl, fileName);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
          toastStore.addToast({
            type: "success",
            title: "اكتمل التحميل",
            message: `تم تنزيل ${fileName} بنجاح.`,
          });
          return true;
        }
      } catch (fetchErr) {
        console.warn("Direct fetch from Firebase failed:", fetchErr);
      }
    }

    // 3. Fallback to Google Drive backend download endpoint
    const driveId = extractDriveFileId(rec);
    if (driveId) {
      const downloadEndpoint = `/api/audio/download/${driveId}?filename=${encodeURIComponent(fileName)}`;
      triggerBrowserDownload(downloadEndpoint, fileName);
      toastStore.addToast({
        type: "success",
        title: "تم بدء التنزيل",
        message: `جاري حفظ ${fileName} في مجلد التنزيلات (من Drive).`,
      });
      return true;
    }

    // 4. Final fallback trigger
    if (targetUrl) {
      triggerBrowserDownload(targetUrl, fileName);
      return true;
    }

    throw new Error("لا يوجد رابط صوتي متاح للتحميل");
  } catch (error: any) {
    console.error("Download recording error:", error);
    toastStore.addToast({
      type: "error",
      title: "تعذر التحميل المباشر",
      message:
        error?.message ||
        "يرجى التحقق من اتصال الإنترنت أو تجربة إعادة المحاولة.",
    });
    return false;
  }
}

/**
 * Helper to trigger HTML5 direct download using an invisible anchor element
 */
function triggerBrowserDownload(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.setAttribute("download", fileName);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
  }, 300);
}
