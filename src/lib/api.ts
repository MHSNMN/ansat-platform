import { auth } from "./firebaseClient";
import { getDriveAccessToken } from "./driveOAuth";

/**
 * Universal protection against "Unexpected token < in JSON at position 0".
 * Whenever a server endpoint returns HTML (e.g. 404, 500, 502 Bad Gateway, or Vite SPA fallback)
 * instead of expected JSON, Response.prototype.json gracefully returns a structured error object
 * instead of throwing an unhandled SyntaxError that crashes the React interface.
 */
if (
  typeof Response !== "undefined" &&
  !(Response.prototype as any).__safeJsonGuardInstalled
) {
  (Response.prototype as any).__safeJsonGuardInstalled = true;
  const nativeJson = Response.prototype.json;

  Response.prototype.json = async function <T = any>(): Promise<T> {
    try {
      const text = await this.text();
      if (!text || text.trim().startsWith("<")) {
        console.warn(
          "[SafeResponseJSON] Server returned non-JSON/HTML response:",
          {
            status: this.status,
            statusText: this.statusText,
            preview: text ? text.substring(0, 120) : "(empty)",
          },
        );
        return {
          success: false,
          error: this.ok
            ? "استجابة غير متوقعة من الخادم"
            : `تعذر إتمام الطلب (رمز الخادم: ${this.status})`,
          status: this.status,
          code: "INVALID_JSON_RESPONSE",
        } as unknown as T;
      }
      return JSON.parse(text) as T;
    } catch (err) {
      if (
        err instanceof SyntaxError &&
        (err.message.includes("Unexpected token") ||
          err.message.includes("JSON"))
      ) {
        return {
          success: false,
          error: `تعذر قراءة بيانات الاستجابة (رمز: ${this.status})`,
          status: this.status,
          code: "JSON_PARSE_SYNTAX_ERROR",
        } as unknown as T;
      }
      throw err;
    }
  };
}

/**
 * Safely parse JSON from a Response object, preventing "Unexpected token < in JSON" crashes.
 */
export async function safeJson<T = any>(
  response: Response,
  fallback: T = {
    success: false,
    error: "تعذر معالجة الاستجابة",
  } as unknown as T,
): Promise<T> {
  try {
    let text = "";
    try {
      const cloned = response.clone ? response.clone() : response;
      text = await cloned.text();
    } catch {
      text = await response.text();
    }

    if (!text || text.trim().startsWith("<")) {
      if (typeof fallback === "object" && fallback !== null) {
        const fallbackObj = fallback as Record<string, any>;
        const statusMsg = !response.ok
          ? response.status === 403
            ? "غير مصرح لك بتنفيذ هذا الإجراء (403)"
            : response.status === 401
              ? "انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول (401)"
              : response.status === 404
                ? "المسار أو العنصر المطلوب غير موجود (404)"
                : response.status === 409
                  ? "البيانات المدخلة مسجلة مسبقاً لعضو آخر (409)"
                  : fallbackObj.error ||
                    `خطأ من الخادم (رمز: ${response.status})`
          : fallbackObj.error || "استجابة غير متوقعة من الخادم";
        return {
          ...fallbackObj,
          success: false,
          error: statusMsg,
          status: response.status,
        } as unknown as T;
      }
      return fallback;
    }

    return JSON.parse(text) as T;
  } catch (_err) {
    if (typeof fallback === "object" && fallback !== null) {
      const fallbackObj = fallback as Record<string, any>;
      return {
        ...fallbackObj,
        success: false,
        error: !response.ok
          ? `خطأ في الاتصال بالخادم (رمز: ${response.status})`
          : fallbackObj.error || "تعذر قراءة بيانات الاستجابة",
        status: response.status,
      } as unknown as T;
    }
    return fallback;
  }
}

/**
 * A central fetch wrapper that automatically attaches the Firebase Auth ID Token
 * as a Bearer authorization header to all API requests.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const target = typeof input === "string" ? input : input.toString();
  const isSameOrigin =
    !/^https?:\/\//i.test(target) ||
    new URL(target, window.location.origin).origin === window.location.origin;

  if (auth.currentUser && isSameOrigin) {
    try {
      // Force refresh only if necessary (Firebase SDK handles this automatically in most cases)
      const idToken = await auth.currentUser.getIdToken();
      if (idToken) {
        headers.set("Authorization", `Bearer ${idToken}`);
      }
    } catch (error) {
      console.warn("Failed to get Firebase ID token:", error);
    }
  }

  const driveToken = getDriveAccessToken();
  if (driveToken && isSameOrigin && !headers.has("x-drive-access-token")) {
    headers.set("x-drive-access-token", driveToken);
  }

  // Include credentials for other potential cookies (though we rely on token)
  const modifiedInit: RequestInit = {
    ...init,
    headers,
  };

  let response = await fetch(input, modifiedInit);

  // If response is 401, attempt a one-time force-refresh of Firebase ID token and retry
  if (response.status === 401 && auth.currentUser && isSameOrigin) {
    try {
      const freshToken = await auth.currentUser.getIdToken(true);
      if (freshToken) {
        const retryHeaders = new Headers(init?.headers);
        retryHeaders.set("Authorization", `Bearer ${freshToken}`);
        if (driveToken) {
          retryHeaders.set("x-drive-access-token", driveToken);
        }
        response = await fetch(input, {
          ...init,
          headers: retryHeaders,
        });
      }
    } catch (refreshErr) {
      console.warn("apiFetch 401 token refresh retry error:", refreshErr);
    }
  }

  return response;
}
