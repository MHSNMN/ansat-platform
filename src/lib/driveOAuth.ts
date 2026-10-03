import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth } from "./firebaseClient";

export const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"];

// In-memory token storage (per security guidelines, no tokens in localStorage)
let cachedDriveAccessToken: string | null = null;
let isSigningIn = false;

// Event listeners for Drive Auth changes
type AuthListener = (connected: boolean, user: User | null) => void;
const listeners: Set<AuthListener> = new Set();

export const onDriveAuthChange = (listener: AuthListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notifyListeners = (connected: boolean, user: User | null) => {
  listeners.forEach((l) => {
    try {
      l(connected, user);
    } catch (e) {
      console.error("[DriveOAuth] Listener error:", e);
    }
  });
};

// Listen to Firebase Auth state to clear token on sign-out
if (typeof window !== "undefined") {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedDriveAccessToken = null;
      notifyListeners(false, null);
    }
  });
}

export const getDriveAccessToken = (): string | null => {
  return cachedDriveAccessToken;
};

export const setDriveAccessToken = (token: string | null) => {
  cachedDriveAccessToken = token;
  notifyListeners(Boolean(token), auth.currentUser);
};

export const isDriveConnected = (): boolean => {
  return Boolean(cachedDriveAccessToken);
};

/**
 * Sign in or request Google Drive authorization via Firebase GoogleAuthProvider.
 * Requests the drive.file scope so files created by this app can be saved in Google Drive.
 */
export const signInWithGoogleForDrive = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  if (isSigningIn) {
    throw new Error("عملية تسجيل الدخول جارية بالفعل.");
  }
  try {
    isSigningIn = true;
    const provider = new GoogleAuthProvider();
    DRIVE_SCOPES.forEach((scope) => provider.addScope(scope));
    provider.setCustomParameters({
      prompt: "select_account",
    });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        "تم تسجيل الدخول ولكن لم يتم استلام رمز الصلاحية (Access Token) لـ Google Drive.",
      );
    }

    cachedDriveAccessToken = credential.accessToken;
    notifyListeners(true, result.user);
    return { user: result.user, accessToken: cachedDriveAccessToken };
  } catch (error: any) {
    console.error("[DriveOAuth] Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const disconnectGoogleDrive = () => {
  cachedDriveAccessToken = null;
  notifyListeners(false, null);
};

export const getConnectedGoogleEmail = (): string | null => {
  return auth.currentUser?.email || null;
};
