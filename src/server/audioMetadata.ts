import { parseStream, parseBuffer } from "music-metadata";
import { Readable } from "node:stream";
import dns from "node:dns";
import path from "node:path";
import fs from "node:fs";

const ALLOWED_AUDIO_HOSTS = [
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
  "storage.cloud.google.com",
  process.env.FIREBASE_STORAGE_BUCKET,
].filter((host): host is string => Boolean(host));

const MAX_AUDIO_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
const FETCH_TIMEOUT_MS = 15000;

export interface AudioMetadataResult {
  durationSeconds: number;
  format?: string;
  sampleRate?: number;
  channels?: number;
  needsProcessing: boolean;
  error?: string;
}

/**
 * Checks if an IP address belongs to internal, loopback, link-local, or cloud metadata ranges.
 */
export function isPrivateOrInternalIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === "::1" || ip === "127.0.0.1" || ip === "0.0.0.0" || ip === "::")
    return true;
  if (ip.startsWith("169.254.")) return true; // Link-local & Cloud metadata (AWS/GCP)
  if (ip.startsWith("10.")) return true; // Class A private
  if (ip.startsWith("192.168.")) return true; // Class C private
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true; // Class B private
  if (ip.startsWith("127.")) return true; // Loopback
  if (ip.startsWith("100.64.")) return true; // Carrier-grade NAT
  if (
    ip.startsWith("fe80:") ||
    ip.startsWith("fc00:") ||
    ip.startsWith("fd00:")
  )
    return true; // IPv6 local/private
  return false;
}

/**
 * Resolves hostname through DNS and verifies all resolved IP addresses are safe public IPs.
 */
export async function validateDnsResolution(
  hostname: string,
): Promise<boolean> {
  try {
    const addresses = await dns.promises.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) return false;
    for (const record of addresses) {
      if (isPrivateOrInternalIp(record.address)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely performs fetch following redirects manually, verifying each hop against the SSRF whitelist and DNS checks.
 */
export async function safeFetchWithRedirects(
  initialUrl: string,
  options: { signal?: AbortSignal; headers?: Record<string, string> } = {},
): Promise<Response> {
  let currentUrl = initialUrl;
  let hops = 0;
  const maxHops = 5;

  while (hops < maxHops) {
    if (!isAllowedAudioUrl(currentUrl)) {
      throw new Error(
        `SSRF_BLOCKED: URL target is not an allowed audio host: ${currentUrl}`,
      );
    }

    const parsed = new URL(currentUrl);
    const isDnsSafe = await validateDnsResolution(parsed.hostname);
    if (!isDnsSafe) {
      throw new Error(
        `SSRF_BLOCKED: Hostname resolved to a disallowed or private IP: ${parsed.hostname}`,
      );
    }

    const res = await fetch(currentUrl, {
      ...options,
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new Error("REDIRECT_MISSING_LOCATION");
      }
      const nextUrl = new URL(location, currentUrl).toString();
      if (!isAllowedAudioUrl(nextUrl)) {
        throw new Error(
          `SSRF_BLOCKED: Redirect location disallowed: ${nextUrl}`,
        );
      }
      const nextParsed = new URL(nextUrl);
      const isNextDnsSafe = await validateDnsResolution(nextParsed.hostname);
      if (!isNextDnsSafe) {
        throw new Error(
          `SSRF_BLOCKED: Redirect hostname resolved to a disallowed IP: ${nextParsed.hostname}`,
        );
      }
      currentUrl = nextUrl;
      hops++;
      continue;
    }

    return res;
  }

  throw new Error("TOO_MANY_REDIRECTS");
}

/**
 * Validates whether an audio buffer matches authentic audio magic numbers (file signature).
 * Defends against spoofed file extensions and malicious payloads.
 */
export function validateAudioSignature(buffer: Buffer): {
  valid: boolean;
  format: string;
} {
  if (!buffer || buffer.length < 12) {
    return { valid: false, format: "unknown" };
  }

  // MP3 with ID3v2 header: 49 44 33 ("ID3")
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return { valid: true, format: "mp3" };
  }

  // MP3 frame sync word: 11 bits set (0xFF followed by 0xE0 or higher)
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return { valid: true, format: "mp3" };
  }

  // WAV / RIFF header: "RIFF" .... "WAVE"
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WAVE"
  ) {
    return { valid: true, format: "wav" };
  }

  // Ogg container: "OggS"
  if (buffer.toString("ascii", 0, 4) === "OggS") {
    return { valid: true, format: "ogg" };
  }

  // FLAC: "fLaC"
  if (buffer.toString("ascii", 0, 4) === "fLaC") {
    return { valid: true, format: "flac" };
  }

  // M4A / MP4: offset 4-8 is "ftyp"
  if (buffer.toString("ascii", 4, 8) === "ftyp") {
    return { valid: true, format: "m4a" };
  }

  // WebM / Matroska: 1A 45 DF A3
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { valid: true, format: "webm" };
  }

  return { valid: false, format: "unknown" };
}

/**
 * Checks whether a URL is safe to fetch without SSRF risks.
 * Rejects private IPs, loopback, metadata services, and unwhitelisted hosts.
 */
export function isAllowedAudioUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;

  // Safe internal endpoints
  if (
    rawUrl.startsWith("/api/public-audio/") ||
    rawUrl.startsWith("/api/local-audio/") ||
    rawUrl.startsWith("/api/audio/") ||
    rawUrl.startsWith("/uploads/")
  ) {
    return true;
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost, IP addresses, internal hostnames
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "169.254.169.254" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    ) {
      return false;
    }

    // Must match allowed domain
    return ALLOWED_AUDIO_HOSTS.some(
      (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
    );
  } catch {
    return false;
  }
}

/**
 * Parses duration and metadata from a raw Buffer with file signature checking and timeout.
 */
export async function extractAudioMetadataFromBuffer(
  buffer: Buffer,
  mimeType?: string,
): Promise<AudioMetadataResult> {
  const signature = validateAudioSignature(buffer);
  if (!signature.valid) {
    return {
      durationSeconds: 0,
      needsProcessing: true,
      error: "الملف المرفوع لا يحتوي على توقيع صوتي صالح أو غير مدعوم",
    };
  }

  try {
    const parsePromise = parseBuffer(
      buffer,
      {
        mimeType: mimeType || `audio/${signature.format}`,
        size: buffer.length,
      },
      { duration: true, skipCovers: true },
    );

    // 5-second timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("METADATA_TIMEOUT")), 5000),
    );

    const metadata = await Promise.race([parsePromise, timeoutPromise]);
    const duration = metadata?.format?.duration
      ? Math.round(metadata.format.duration)
      : 0;

    if (duration <= 0) {
      return {
        durationSeconds: 0,
        format: signature.format,
        needsProcessing: true,
        error: "تعذر احتساب مدة الملف بدقة، يحتاج إلى معالجة إضافية",
      };
    }

    return {
      durationSeconds: duration,
      format: signature.format,
      sampleRate: metadata.format.sampleRate,
      channels: metadata.format.numberOfChannels,
      needsProcessing: false,
    };
  } catch (err: any) {
    return {
      durationSeconds: 0,
      format: signature.format,
      needsProcessing: true,
      error: err?.message || "فشل تحليل المقطع الصوتي",
    };
  }
}

/**
 * Safely fetches remote audio metadata from a trusted storage URL.
 * Enforces SSRF defense, size limits, redirect validation, and full file streaming if needed (preventing 20MB cutoff for moov atoms).
 */
export async function getAudioDurationSeconds(url: string): Promise<number> {
  if (!url) {
    return 0;
  }

  // If local file path, read directly from disk
  if (
    url.startsWith("/api/public-audio/") ||
    url.startsWith("/api/local-audio/") ||
    url.startsWith("/uploads/recordings/")
  ) {
    const filename = path.basename(url);
    const localPath = path.join(
      process.cwd(),
      "uploads",
      "recordings",
      filename,
    );
    if (fs.existsSync(localPath)) {
      try {
        const buffer = fs.readFileSync(localPath);
        const meta = await extractAudioMetadataFromBuffer(buffer);
        return meta.durationSeconds || 0;
      } catch {
        return 0;
      }
    }
  }

  if (!isAllowedAudioUrl(url)) {
    return 0;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await safeFetchWithRedirects(url, {
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      return 0;
    }

    const contentLength = parseInt(
      response.headers.get("content-length") || "0",
      10,
    );
    if (contentLength > MAX_AUDIO_SIZE_BYTES) {
      return 0;
    }

    const nodeStream = Readable.fromWeb(response.body as any);
    const metadata = await parseStream(
      nodeStream,
      {
        mimeType: response.headers.get("content-type") || undefined,
        size: contentLength || undefined,
      },
      { duration: true, skipCovers: true },
    );

    const duration = metadata?.format?.duration;
    return typeof duration === "number" && !isNaN(duration) && duration > 0
      ? Math.round(duration)
      : 0;
  } catch {
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Validates image signatures (magic numbers) for JPEG, PNG, WebP, GIF.
 * Strictly prevents malicious files or non-image payloads disguised as images.
 */
export function validateImageSignature(buffer: Buffer): {
  valid: boolean;
  format: string;
} {
  if (!buffer || buffer.length < 12) {
    return { valid: false, format: "unknown" };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, format: "jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, format: "png" };
  }

  // WebP: offset 0-4 "RIFF", offset 8-12 "WEBP"
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { valid: true, format: "webp" };
  }

  // GIF: GIF87a or GIF89a
  const gifHeader = buffer.toString("ascii", 0, 6);
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
    return { valid: true, format: "gif" };
  }

  return { valid: false, format: "unknown" };
}

/**
 * Calculates total audio seconds deduplicating by docId or audioUrl,
 * safely excluding archived, non-published, needsProcessing items, and duration <= 0.
 */
export function calculateDeduplicatedAudioDuration(
  items: Array<{
    id?: string;
    audioUrl?: string;
    durationSeconds?: number;
    status?: string;
    isArchived?: boolean;
    needsProcessing?: boolean;
  }>,
  includeDrafts = false,
): number {
  const countedDocIds = new Set<string>();
  const countedAudioUrls = new Set<string>();
  let finalSeconds = 0;

  for (const item of items) {
    if (item.isArchived === true || item.status === "ARCHIVED") continue;
    if (!includeDrafts && item.status !== "PUBLISHED") continue;
    if (item.needsProcessing === true) continue;

    const rawDur = Number(item.durationSeconds);
    if (isNaN(rawDur) || rawDur <= 0) continue;

    const docId = item.id;
    if (docId) {
      if (countedDocIds.has(docId)) continue;
      countedDocIds.add(docId);
    }

    const audioUrl = (item.audioUrl || "").trim();
    if (audioUrl) {
      if (countedAudioUrls.has(audioUrl)) continue;
      countedAudioUrls.add(audioUrl);
    }

    finalSeconds += rawDur;
  }

  return finalSeconds;
}
