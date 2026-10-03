// @ts-nocheck
import { auth } from "./firebaseClient";

/**
 * A central fetch wrapper that automatically attaches the Firebase Auth ID Token
 * as a Bearer authorization header to all API requests.
 */
export async function safeJson<T = any>(
  response: Response,
  fallback: T = {
    success: false,
    error: "تعذر معالجة الاستجابة",
  } as unknown as T,
): Promise<T> {
  try {
    const text = await response.text();
    if (!text || text.trim().startsWith("<")) {
      return fallback;
    }
    return JSON.parse(text) as T;
  } catch (err) {
    return fallback;
  }
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);

  if (auth.currentUser) {
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

  // Include credentials for other potential cookies (though we rely on token)
  const modifiedInit: RequestInit = {
    ...init,
    headers,
  };

  let response = await fetch(input, modifiedInit);

  if (response.status === 401 && auth.currentUser) {
    try {
      const freshToken = await auth.currentUser.getIdToken(true);
      if (freshToken) {
        const retryHeaders = new Headers(init?.headers);
        retryHeaders.set("Authorization", `Bearer ${freshToken}`);
        response = await fetch(input, {
          ...init,
          headers: retryHeaders,
        });
      }
    } catch (refreshErr) {
      console.warn(
        "embedded apiFetch 401 token refresh retry error:",
        refreshErr,
      );
    }
  }

  return response;
}
