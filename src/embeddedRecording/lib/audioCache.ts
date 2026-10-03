// @ts-nocheck
/**
 * In-memory Audio Cache Service for Instant Zero-Latency Playback
 * Caches local Blob URLs and direct Google Drive stream links.
 */

const audioCacheMap = new Map<string, string>();

/**
 * Cache audio URL for a recording ID or file name
 */
export function setAudioCache(key: string, url: string): void {
  if (!key || !url) return;
  audioCacheMap.set(key, url);
  // Also store clean key without spaces or extensions
  const cleanKey = key.trim().toLowerCase();
  audioCacheMap.set(cleanKey, url);
}

/**
 * Retrieve cached audio URL for a recording ID or file name
 */
export function getAudioCache(key?: string): string | null {
  if (!key) return null;
  if (audioCacheMap.has(key)) {
    return audioCacheMap.get(key) || null;
  }
  const cleanKey = key.trim().toLowerCase();
  if (audioCacheMap.has(cleanKey)) {
    return audioCacheMap.get(cleanKey) || null;
  }
  return null;
}

/**
 * Converts any Google Drive URL or File URL into a direct streamable playback link
 */
export function formatDriveStreamUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  const match =
    url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    url.match(/open\?id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `/api/audio/${match[1]}`;
  }
  return url;
}
