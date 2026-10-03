/**
 * Utility functions for ActivityLog timestamps and formatting.
 * Safely handles Firestore Timestamp objects, ISO strings, epoch milliseconds,
 * and missing/null values without throwing exceptions or crashing.
 */

export function parseActivityLogTimestamp(raw?: unknown): string {
  if (raw === undefined || raw === null || raw === "") {
    return new Date().toISOString();
  }

  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? new Date().toISOString() : raw.toISOString();
  }

  // If Firestore Timestamp object with toDate() method
  if (typeof (raw as any)?.toDate === "function") {
    try {
      const date = (raw as any).toDate();
      if (date instanceof Date && !isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch {
      return new Date().toISOString();
    }
  }

  // If Firestore Timestamp plain object representation: { seconds: number, nanoseconds?: number }
  if (typeof raw === "object") {
    const obj = raw as Record<string, any>;
    const sec = obj.seconds ?? obj._seconds;
    if (typeof sec === "number" && !isNaN(sec)) {
      return new Date(sec * 1000).toISOString();
    }
  }

  // If already a valid ISO string or epoch number
  if (typeof raw === "string" || typeof raw === "number") {
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return String(raw);
}
