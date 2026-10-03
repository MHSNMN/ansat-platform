/**
 * SessionManager: يتحقق من حالة الجلسة عند بدء التطبيق.
 * - يجدد Token تلقائياً قبل انتهائه.
 * - لا يخزن Role في localStorage.
 * - عند انتهاء الجلسة يُعيد المستخدم لصفحة Login.
 */
import { auth } from "../lib/firebaseClient";
import { authService } from "../services/authService";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 دقائق قبل الانتهاء
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export async function getValidToken(): Promise<string | null> {
  if (!auth.currentUser) return null;
  try {
    const token = await auth.currentUser.getIdTokenResult(false);
    const expiresAt = new Date(token.expirationTime).getTime();
    const now = Date.now();
    const remaining = expiresAt - now;
    if (remaining < TOKEN_REFRESH_BUFFER_MS) {
      return auth.currentUser.getIdToken(true);
    }
    scheduleRefresh(remaining - TOKEN_REFRESH_BUFFER_MS);
    return token.token;
  } catch {
    return null;
  }
}

function scheduleRefresh(delayMs: number) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    if (auth.currentUser) {
      await auth.currentUser.getIdToken(true).catch(() => null);
    }
  }, delayMs);
}

export function initSessionManager() {
  authService.initialize().catch(console.error);
}
