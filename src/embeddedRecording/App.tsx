// @ts-nocheck
import { apiFetch } from "./lib/api";
import { backgroundSync } from "./lib/background-sync";
import QueueManagerUI from "./components/QueueManagerUI";
import ToastContainer from "./components/ToastContainer";
import NetworkLatencyMonitor from "./components/NetworkLatencyMonitor";
import React, { useState, useEffect } from "react";
import {
  User,
  Book,
  AudioRecording,
  ActivityLog,
  ThemeMode,
  MainTab,
} from "./types";
import {
  fetchUsers,
  fetchBooks,
  fetchRecordings,
  fetchActivityLogs,
  purgeCorruptedRecordings,
} from "./lib/supabaseClient";
import { normalizeUserPermissions } from "./lib/permissions";
import { authService } from "./services/authService";
import {
  Trash2,
  AlertTriangle,
  Lock,
  Mic,
  Sparkles,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react";

import { mapLegacyRecording } from "./lib/dataMapper";
import { hasPermission } from "./lib/permissions";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { MobileNavDrawer } from "./components/MobileNavDrawer";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { LoginModal } from "./components/LoginModal";
import { DashboardOverview } from "./components/DashboardOverview";
import { MySpace } from "./components/MySpace";
import { BookCatalog } from "./components/BookCatalog";
import { AudioLibraryView } from "./components/AudioLibraryView";
import { TeamView } from "./components/TeamView";
import { ActivityLogView } from "./components/ActivityLogView";
import { StudioContainer } from "./components/StudioContainer";
import { AudioPlayerBar } from "./components/AudioPlayerBar";
import { SupabaseSetupModal } from "./components/SupabaseSetupModal";
import { DriveSetupModal } from "./components/DriveSetupModal";
import { ControlPanel } from "./components/ControlPanel";
import SystemDatabaseManager from "./components/SystemDatabaseManager";

import {
  AboutPage,
  PrivacyPage,
  TermsPage,
  SupportPage,
} from "./components/PublicPages";

export default function App({
  initialUser,
  onUnifiedLogout,
}: {
  initialUser?: User | null;
  onUnifiedLogout?: () => void | Promise<void>;
} = {}) {
  // Preserve the original studio identity. Users may still switch to light mode.
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [firestoreStatus, setFirestoreStatus] = useState<
    "connected" | "offline" | "error" | "connecting"
  >("connecting");
  const [activeTab, setActiveTab] = useState<MainTab>("my_space");

  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(
    initialUser ?? null,
  );

  const [gateEmailInput, setGateEmailInput] = useState<string>("");
  const [gatePasswordInput, setGatePasswordInput] = useState<string>("");
  const [isGateLoading, setIsGateLoading] = useState<boolean>(false);
  const [gateErrorMsg, setGateErrorMsg] = useState<string>("");

  const [books, setBooks] = useState<Book[]>([]);
  const booksRef = React.useRef<Book[]>([]);
  booksRef.current = books;
  const [recordings, setRecordings] = useState<AudioRecording[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  const unifiedList = async (path: string, key: string): Promise<any[]> => {
    const response = await apiFetch(path);
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    const body = await response.json();
    return Array.isArray(body[key]) ? body[key] : [];
  };
  const loadBooksForSession = (): Promise<Book[]> =>
    initialUser !== undefined
      ? (unifiedList("/api/recording/books", "books") as Promise<Book[]>)
      : fetchBooks();
  const loadRecordingsForSession = async (): Promise<AudioRecording[]> => {
    if (initialUser === undefined) return fetchRecordings();
    const rows = await unifiedList("/api/recording/recordings", "recordings");
    return rows.map((row) => mapLegacyRecording(row, booksRef.current));
  };
  const loadLogsForSession = (): Promise<ActivityLog[]> =>
    initialUser !== undefined
      ? (unifiedList("/api/recording/activity-logs", "logs") as Promise<
          ActivityLog[]
        >)
      : fetchActivityLogs();

  const [playingRecording, setPlayingRecording] =
    useState<AudioRecording | null>(null);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState<boolean>(false);
  const [isDriveSetupOpen, setIsDriveSetupOpen] = useState<boolean>(false);
  const [showWipeModal, setShowWipeModal] = useState<boolean>(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState<boolean>(false);

  const [pendingUploads, setPendingUploads] = useState<
    Record<string, { progress: number; workflowStatus: string }>
  >({});

  const [studioBookTitle, setStudioBookTitle] = useState<string>("");

  const canOpenTab = React.useCallback(
    (tab: MainTab) => {
      if (!currentUser) return false;
      switch (tab) {
        case "my_space":
        case "books":
        case "audio_library":
          return true;
        case "dashboard":
          return hasPermission(currentUser, "recording.dashboard.view");
        case "team":
          return hasPermission(currentUser, "recording.members.view");
        case "activity_log":
          return hasPermission(currentUser, "can_view_activity_logs");
        case "studio":
          return (
            hasPermission(currentUser, "can_upload_raw") ||
            hasPermission(currentUser, "can_qa_review") ||
            hasPermission(currentUser, "can_master_audio")
          );
        case "settings":
          return hasPermission(currentUser, "can_manage_settings");
        case "control_panel":
        case "system_database":
          return hasPermission(currentUser, "can_access_control_panel");
        default:
          return false;
      }
    },
    [currentUser],
  );

  const handleSelectTab = (tab: MainTab, bookTitle?: string) => {
    if (!canOpenTab(tab)) return;
    setActiveTab(tab);
    if (bookTitle !== undefined) {
      setStudioBookTitle(bookTitle);
    } else {
      setStudioBookTitle("");
    }
  };

  useEffect(() => {
    if (initialUser !== undefined) setCurrentUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    if (currentUser && !canOpenTab(activeTab)) setActiveTab("my_space");
  }, [activeTab, canOpenTab, currentUser]);

  // Google Drive Real-time Synchronization Status State
  const [driveSyncState, setDriveSyncState] = useState<
    "idle" | "syncing" | "success" | "error"
  >("idle");
  const [driveSyncDetails, setDriveSyncDetails] = useState<{
    fileName?: string;
    driveUrl?: string;
    progress?: number;
    chunkIndex?: number;
    totalChunks?: number;
  }>({});

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleDriveSyncEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setDriveSyncState(customEvent.detail.workflowStatus);
        setDriveSyncDetails({
          fileName: customEvent.detail.fileName,
          driveUrl: customEvent.detail.driveUrl,
          progress: customEvent.detail.progress || 0,
          chunkIndex: customEvent.detail.chunkIndex || 1,
          totalChunks: customEvent.detail.totalChunks || 1,
        });

        const recId = customEvent.detail.recId;
        if (recId) {
          setPendingUploads((prev) => {
            const next = { ...prev };
            if (customEvent.detail.workflowStatus === "syncing") {
              next[recId] = {
                progress: customEvent.detail.progress || 0,
                workflowStatus: "syncing",
              };
            } else if (
              customEvent.detail.workflowStatus === "success" ||
              customEvent.detail.workflowStatus === "error"
            ) {
              delete next[recId];
            }
            return next;
          });
        }
      }
    };

    const handleManualDriveLinkUpdate = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { id, driveUrl } = customEvent.detail;
      if (id && driveUrl) {
        setRecordings((prev) =>
          prev.map((r) => (r.id === id ? { ...r, rawUrl: driveUrl } : r)),
        );
        try {
          await apiFetch("/api/update-recording-drive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recId: id, webViewLink: driveUrl }),
          });
          import("./lib/toastStore").then(({ toastStore }) => {
            toastStore.addToast({
              type: "success",
              title: "تم التحديث",
              message: "تم ربط رابط الدرايف بنجاح.",
            });
          });
        } catch (error) {
          console.error("Failed to update link", error);
        }
      }
    };

    const handleDriveSyncUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { id, data, type } = customEvent.detail;
      if (id) {
        if (type === "removed") {
          setRecordings((prev) => prev.filter((r) => r.id !== id));
        } else if (data) {
          setRecordings((prev) => {
            const exists = prev.some((r) => r.id === id);
            if (exists) {
              return prev.map((r) => (r.id === id ? { ...r, ...data } : r));
            } else {
              return [...prev, data];
            }
          });
        }
      }
    };

    window.addEventListener(
      "google-drive-sync-workflowStatus",
      handleDriveSyncEvent,
    );
    window.addEventListener(
      "manual-drive-link-update",
      handleManualDriveLinkUpdate,
    );
    window.addEventListener("drive-sync-update", handleDriveSyncUpdate);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(
        "google-drive-sync-workflowStatus",
        handleDriveSyncEvent,
      );
      window.removeEventListener(
        "manual-drive-link-update",
        handleManualDriveLinkUpdate,
      );
      window.removeEventListener("drive-sync-update", handleDriveSyncUpdate);
    };
  }, []);

  const handleConfirmWipeData = async () => {
    // Bulk deletion is disabled until an authorized, auditable server workflow exists.
    setShowWipeModal(false);
  };

  // Load Initial Data from Firestore & subscribe to real-time updates
  useEffect(() => {
    if (initialUser === null) {
      setUsers([]);
      setBooks([]);
      setRecordings([]);
      setActivityLogs([]);
      return;
    }
    async function loadAllData() {
      if (initialUser === undefined) await purgeCorruptedRecordings();
      // 1. Load pre-warmed auth registry instantly
      const localUsers =
        initialUser !== undefined
          ? [initialUser]
          : authService.getPreWarmedUsers();
      if (localUsers.length > 0) setUsers(localUsers);

      const uData =
        initialUser !== undefined
          ? [initialUser]
          : await authService.preWarmRegistry();
      setUsers(uData);

      // The unified Firebase session is authoritative when embedded. Never
      // replace it with null merely because the legacy registry is empty.
      if (initialUser !== undefined) {
        setCurrentUser(initialUser);
      } else {
        const sessionUser = authService.getSavedSession();
        if (sessionUser) {
          const found = uData.find((u) => u.id === sessionUser.id);
          setCurrentUser(found ? normalizeUserPermissions(found) : null);
        } else {
          setCurrentUser(null);
        }
      }

      const [bData, rData, aData, freshUsersList] = await Promise.all([
        loadBooksForSession().catch((e) => {
          console.warn("fetchBooks error in loadAllData:", e);
          return [];
        }),
        loadRecordingsForSession().catch((e) => {
          console.warn("fetchRecordings error in loadAllData:", e);
          return [];
        }),
        loadLogsForSession().catch((e) => {
          console.warn("fetchActivityLogs error in loadAllData:", e);
          return [];
        }),
        (initialUser !== undefined
          ? hasPermission(initialUser, "can_manage_members")
            ? (unifiedList("/api/admin/users", "users") as Promise<User[]>)
            : Promise.resolve([initialUser])
          : fetchUsers()
        ).catch((e) => {
          console.warn("fetchUsers error in loadAllData:", e);
          return [];
        }),
      ]);

      if (Array.isArray(bData) && bData.length > 0) {
        setBooks(bData);
      }
      setRecordings(rData);
      setActivityLogs(aData);
      if (freshUsersList && freshUsersList.length > 0) {
        setUsers(freshUsersList);
      }
    }
    loadAllData();

    // Firestore continuous onSnapshot listeners disabled to eliminate 50,000 daily read limit exhaustion.
    // Data is loaded via Supabase repositories and synced cleanly on user actions.
    setFirestoreStatus("connected");

    return () => {
      backgroundSync.stopSync();
    };
    // Session bootstrap is intentionally keyed only by the unified-user boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUser]);

  // Theme Switcher Toggle
  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // User session stability
  useEffect(() => {
    if (!currentUser) return;
    if (books.length === 0) {
      loadBooksForSession()
        .then((b) => {
          if (Array.isArray(b) && b.length > 0) setBooks(b);
        })
        .catch(() => {});
    }
    // The stable user id and book count are the only values that should retrigger this recovery fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, initialUser, books.length]);

  // PIN Login Authenticator (0ms Zero-Latency Perceived Login)
  const isStrict = import.meta.env.VITE_RBAC_ENFORCE_STRICT === "true";

  React.useEffect(() => {
    if (initialUser !== undefined) return;
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      import("./lib/firebaseClient").then(({ auth }) => {
        onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            try {
              const idTokenResult = await firebaseUser.getIdTokenResult();
              const role = idTokenResult.claims.role as any;

              const { authService } = await import("./services/authService");
              const { INITIAL_USERS } = await import("./data/mockData");
              const { sanitizeUserFromStorage } =
                await import("./lib/rbacPolicy");

              const preWarmed = authService.getPreWarmedUsers();
              const userRegistry =
                preWarmed.length > 0 ? preWarmed : INITIAL_USERS;
              const targetEmail = (firebaseUser.email || "")
                .toLowerCase()
                .trim();
              const foundUser = userRegistry.find(
                (u) =>
                  u.id === firebaseUser.uid ||
                  (targetEmail &&
                    (u.email || "").toLowerCase().trim() === targetEmail),
              );

              if (foundUser) {
                const resolvedRole = role || foundUser.role;
                const finalUser = { ...foundUser, role: resolvedRole };
                setCurrentUser(
                  sanitizeUserFromStorage(finalUser, userRegistry),
                );
              } else {
                setCurrentUser({
                  id: firebaseUser.uid,
                  name:
                    firebaseUser.displayName ||
                    firebaseUser.email ||
                    "عضو جديد",
                  email: firebaseUser.email || "",
                  role: "MEMBER",
                  role_display_ar: "عضو",
                  is_super_admin: false,
                  can_access_studio: false,
                  can_upload_raw: false,
                  can_qa_review: false,
                  can_master_audio: false,
                  is_active: true,
                });
              }
            } catch (e) {
              console.warn("Error decoding custom claims", e);
            }
          } else {
            setCurrentUser(null);
          }
        });
      });
    });
  }, [initialUser, isStrict]);

  const handleGoogleLogin = async () => {
    setIsGateLoading(true);
    setGateErrorMsg("");
    try {
      const { GoogleAuthProvider, signInWithPopup } =
        await import("firebase/auth");
      const { auth } = await import("./lib/firebaseClient");
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err: any) {
      console.warn("Google Auth Error:", err);
      setGateErrorMsg(
        err?.code === "auth/popup-closed-by-user"
          ? "تم إغلاق نافذة تسجيل الدخول."
          : "تعذر تسجيل الدخول بواسطة Google.",
      );
    } finally {
      setIsGateLoading(false);
    }
  };

  const handleGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gateEmailInput.trim() || !gatePasswordInput) {
      setGateErrorMsg("أدخل البريد الإلكتروني وكلمة المرور.");
      return;
    }

    setIsGateLoading(true);
    setGateErrorMsg("");
    try {
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      const { auth } = await import("./lib/firebaseClient");

      await signInWithEmailAndPassword(
        auth,
        gateEmailInput.trim(),
        gatePasswordInput,
      );
    } catch (err: any) {
      console.warn("Firebase Auth Error:", err);
      if (err.code === "auth/operation-not-allowed") {
        setGateErrorMsg("تسجيل الدخول غير مفعل حالياً من قبل الإدارة.");
      } else if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setGateErrorMsg("بيانات الدخول غير صحيحة.");
      } else {
        setGateErrorMsg("حدث خطأ أثناء الاتصال بالمزود.");
      }
    } finally {
      setIsGateLoading(false);
    }
  };

  const handleLogout = async () => {
    if (onUnifiedLogout) {
      await onUnifiedLogout();
      setCurrentUser(null);
      window.location.assign("/login");
      return;
    }
    const { signOut } = await import("firebase/auth");
    const { auth } = await import("./lib/firebaseClient");
    await signOut(auth);
    authService.logout();
    setCurrentUser(null);
    setGateEmailInput("");
    setGatePasswordInput("");
    setGateErrorMsg("");
  };

  // User Permissions Update Trigger
  const handleUsersUpdated = (updatedUsers: User[]) => {
    setUsers(updatedUsers);
    if (currentUser && !currentUser.id.includes("dev-local-user")) {
      const refreshed = updatedUsers.find((u) => u.id === currentUser.id);
      if (refreshed) {
        setCurrentUser({
          ...refreshed,
          role: currentUser.role,
          is_super_admin: currentUser.is_super_admin,
        });
      }
    }
  };

  // Public Routes (OAuth & Domain Branding)
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  if (path === "/about")
    return (
      <AboutPage
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />
    );
  if (path === "/privacy")
    return (
      <PrivacyPage
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />
    );
  if (path === "/terms")
    return (
      <TermsPage
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />
    );
  if (path === "/support")
    return (
      <SupportPage
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />
    );

  // Full-Screen Authentication Gate if currentUser is null
  if (!currentUser) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[#070A12] text-slate-100 flex items-center justify-center p-4 selection:bg-amber-500 selection:text-slate-950 font-sans relative overflow-hidden"
      >
        {/* Glowing Ambient Backdrop */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-md p-8 rounded-3xl border border-slate-800/80 bg-slate-900/90 backdrop-blur-xl shadow-2xl space-y-6 relative z-10 text-right">
          {/* Brand Header */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/10">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white flex items-center justify-center gap-2">
                <span>منصة إنصات الصوتية</span>
                <Sparkles className="w-5 h-5 text-amber-400" />
              </h1>
              <p className="text-xs text-amber-400/90 font-bold mt-1">
                دخول آمن بالبريد الإلكتروني وكلمة المرور
              </p>
            </div>
          </div>

          {/* Gate Form */}
          <form onSubmit={handleGateSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                تسجيل الدخول:
              </label>
              <div className="relative mb-3">
                <input
                  type="email"
                  value={gateEmailInput}
                  onChange={(e) => {
                    setGateEmailInput(e.target.value);
                    setGateErrorMsg("");
                  }}
                  autoFocus
                  placeholder="البريد الإلكتروني"
                  className="w-full px-4 py-4 rounded-2xl bg-slate-950 border border-slate-800 text-right text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-inner"
                />
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={gatePasswordInput}
                  onChange={(e) => {
                    setGatePasswordInput(e.target.value);
                    setGateErrorMsg("");
                  }}
                  placeholder="كلمة المرور"
                  className="w-full px-4 py-4 rounded-2xl bg-slate-950 border border-slate-800 text-right text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-inner"
                />
              </div>
            </div>

            {gateErrorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{gateErrorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isGateLoading}
              className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isGateLoading ? "جاري الدخول..." : "دخول المنصة"}</span>
            </button>
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-xs">
                أو
              </span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGateLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              الدخول بواسطة حساب Google
            </button>
          </form>

          {/* Security Notice */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed text-center">
            🔐 المنصة مشفرة ومحمية ببروتوكولات صلاحيات دقيقة. بيانات الدخول
            محمية ويتم التحقق منها عبر Firebase Authentication.
          </div>
        </div>
      </div>
    );
  }

  if (
    currentUser &&
    (currentUser.accountStatus === "pending" ||
      currentUser.status === "pending" ||
      currentUser.role === "PENDING" ||
      (currentUser as any).canonicalRole === "PENDING")
  ) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[#070A12] text-slate-100 flex items-center justify-center p-4 selection:bg-amber-500 selection:text-slate-950 font-sans relative overflow-hidden"
      >
        <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl relative z-10 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-amber-500/20 border border-amber-500/30 flex flex-col items-center justify-center mb-6 shadow-[0_0_40px_rgba(245,158,11,0.2)]">
            <Mic className="w-10 h-10 text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            منصة إنصات
          </h1>
          <p className="text-sm font-medium text-amber-500 tracking-wide mb-6">
            الإصدار المركزي V4
          </p>
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 mb-6">
            <h2 className="text-lg font-bold text-slate-200 mb-2">
              بانتظار تفعيل العضوية
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              أهلاً بك يا {currentUser.name}. تم تسجيل حسابك بنجاح، لكن عضويتك
              قيد المراجعة حالياً من قبل إدارة المنصة. ستتمكن من الدخول فور
              اعتماد الصلاحيات الخاصة بك.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-all"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className={`min-h-screen font-sans transition-colors durationSeconds-300 ${
        theme === "dark"
          ? "bg-[#090D16] text-slate-100 selection:bg-amber-500 selection:text-slate-950"
          : "bg-slate-100 text-slate-900 selection:bg-amber-500 selection:text-slate-950"
      }`}
    >
      {/* Top Header Navbar */}
      <Navbar
        currentUser={currentUser}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenLogin={() =>
          initialUser !== undefined
            ? window.location.assign("/portal")
            : setShowLoginModal(true)
        }
        onLogout={handleLogout}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenSupabaseSetup={() => setShowSupabaseModal(true)}
        onOpenMobileMenu={() => setShowMobileDrawer(true)}
      />

      {/* Mobile Side Drawer Navigation */}
      <MobileNavDrawer
        isOpen={showMobileDrawer}
        onClose={() => setShowMobileDrawer(false)}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        theme={theme}
        currentUser={currentUser}
        onToggleTheme={handleToggleTheme}
        onOpenLogin={() =>
          initialUser !== undefined
            ? window.location.assign("/portal")
            : setShowLoginModal(true)
        }
        onLogout={handleLogout}
        onOpenSupabaseSetup={() => setShowSupabaseModal(true)}
      />

      {/* Main Body Layout */}
      <div className="max-w-7xl mx-auto flex min-h-[calc(100vh-4rem)] pb-28 md:pb-24">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          theme={theme}
          currentUser={currentUser}
          books={books}
        />

        {/* Dynamic View Content Area */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto">
          {activeTab === "my_space" && currentUser && (
            <MySpace
              currentUser={currentUser}
              books={books}
              recordings={recordings}
              theme={theme}
              onNavigate={(tab, title) => {
                setActiveTab(tab);
                if (tab === "studio" && title) setStudioBookTitle(title);
              }}
            />
          )}
          {activeTab === "dashboard" && canOpenTab("dashboard") && (
            <DashboardOverview
              currentUser={currentUser!}
              books={books}
              recordings={recordings}
              users={users}
              theme={theme}
              onSelectTab={setActiveTab}
              onPlayAudio={setPlayingRecording}
            />
          )}

          {activeTab === "books" && (
            <BookCatalog
              books={books}
              recordings={recordings}
              onPlayAudio={setPlayingRecording}
              onSelectTab={handleSelectTab}
              onBooksUpdated={async (updated) => {
                setBooks(updated);
                const logs = await loadLogsForSession();
                setActivityLogs(logs);
                const recs = await loadRecordingsForSession();
                setRecordings(recs);
              }}
              currentUser={currentUser}
              users={users}
              theme={theme}
            />
          )}

          {activeTab === "audio_library" && (
            <AudioLibraryView
              books={books}
              recordings={recordings}
              pendingUploads={pendingUploads}
              onPlayAudio={setPlayingRecording}
              preselectedBookTitle={studioBookTitle}
              onRecordingsUpdated={async (updated) => {
                setRecordings(updated);
                const logs = await loadLogsForSession();
                setActivityLogs(logs);
              }}
              currentUser={currentUser}
              theme={theme}
            />
          )}

          {activeTab === "team" && canOpenTab("team") && (
            <TeamView
              users={users}
              theme={theme}
              currentUser={currentUser}
              onUsersUpdated={handleUsersUpdated}
            />
          )}

          {activeTab === "activity_log" && canOpenTab("activity_log") && (
            <ActivityLogView
              logs={activityLogs}
              theme={theme}
              currentUser={currentUser}
            />
          )}

          {activeTab === "studio" && currentUser && canOpenTab("studio") && (
            <StudioContainer
              currentUser={currentUser}
              users={users}
              books={books}
              recordings={recordings}
              preselectedBookTitle={studioBookTitle}
              onRecordingsUpdated={async (updated) => {
                setRecordings(updated);
                const logs = await loadLogsForSession();
                setActivityLogs(logs);
              }}
              onUsersUpdated={async (updated) => {
                handleUsersUpdated(updated);
                const logs = await loadLogsForSession();
                setActivityLogs(logs);
              }}
              onPlayAudio={setPlayingRecording}
              theme={theme}
            />
          )}

          {activeTab === "control_panel" &&
            currentUser &&
            canOpenTab("control_panel") && (
              <ControlPanel
                currentUser={currentUser}
                users={users}
                books={books}
                recordings={recordings}
                activityLogs={activityLogs}
                onWipeDatabase={handleConfirmWipeData}
                theme={theme}
              />
            )}

          {activeTab === "system_database" &&
            currentUser &&
            canOpenTab("system_database") && (
              <SystemDatabaseManager
                currentUser={currentUser}
                theme={theme}
                books={books}
                recordings={recordings}
                onWipeDataClick={() => {}}
                onSetupSupabaseClick={() => setShowSupabaseModal(true)}
                onSetupDriveClick={() => setIsDriveSetupOpen(true)}
              />
            )}

          {activeTab === "settings" &&
            (currentUser &&
            (currentUser.is_super_admin || currentUser.can_manage_settings) ? (
              <div className="space-y-6">
                <div
                  className={`p-6 rounded-2xl border ${
                    theme === "dark"
                      ? "bg-slate-900 border-slate-800"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <h2 className="text-lg font-bold text-amber-400 mb-2">
                    إعدادات المنصة وقواعد البيانات
                  </h2>
                  <p className="text-xs text-slate-400 mb-4">
                    تعديل ربط السحابة Supabase ومزامنة الجداول تلقائياً.
                  </p>
                  <button
                    disabled={
                      !(
                        currentUser.is_super_admin ||
                        currentUser.can_edit_db_urls
                      )
                    }
                    onClick={() => setShowSupabaseModal(true)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs disabled:opacity-40 cursor-pointer"
                  >
                    فتح لوحة إعدادات Supabase
                  </button>
                </div>

                {/* Wipe Data Section */}
                <div
                  className={`p-6 rounded-3xl border border-rose-500/40 shadow-xl ${
                    theme === "dark" ? "bg-slate-900/90" : "bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3 text-rose-400 mb-3">
                    <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                      <Trash2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-white">
                        تصفير المنصة ومسح كافة البيانات (Wipe All Data)
                      </h2>
                      <p className="text-xs text-rose-300">
                        مسح جميع الكتب، التسجيلات، التقييمات، والمهام بضغطة
                        واحدة
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mb-4 leading-relaxed bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    ⚠️ إجراء حرج ولا يمكن التراجع عنه: هذا الزر يقوم بمسح جميع
                    الكتب في الكتالوج، وتصفير جميع التسجيلات الصوتية المرفوعة،
                    وحذف تقييمات الجودة وكافة المهام نهائياً وتفريغ المنصة
                    بالكامل.
                  </p>

                  <button
                    disabled
                    onClick={() => {}}
                    className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs disabled:opacity-40 shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>
                      تصفير المنصة ومسح كل الكتب والتسجيلات والتقييمات فوراً
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-4 max-w-md mx-auto my-12 dir-rtl">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  صفحة الإعدادات محمية 🔒
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  عذراً، الوصول لصفحة الإعدادات وتعديل السحابة محصور بالمدير
                  الرئيسي أو الأعضاء الممنوحين صلاحية{" "}
                  <strong className="text-amber-400">
                    can_manage_settings
                  </strong>
                  .
                </p>
              </div>
            ))}
        </main>
      </div>

      {/* Floating Audio Player Bar */}
      <AudioPlayerBar
        recording={playingRecording}
        onClose={() => setPlayingRecording(null)}
        theme={theme}
      />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        currentUser={currentUser}
        onOpenDrawer={() => setShowMobileDrawer(true)}
      />
      <QueueManagerUI />
      <ToastContainer />

      {/* PIN Login Modal */}
      {showLoginModal && (
        <LoginModal
          users={users}
          currentUser={currentUser}
          onClose={() => setShowLoginModal(false)}
          theme={theme}
        />
      )}

      {/* Supabase Setup Modal */}
      {showSupabaseModal && (
        <SupabaseSetupModal
          onClose={() => setShowSupabaseModal(false)}
          theme={theme}
        />
      )}
      {isDriveSetupOpen && (
        <DriveSetupModal
          onClose={() => setIsDriveSetupOpen(false)}
          theme={theme}
        />
      )}

      {/* Wipe All Data Confirmation Modal */}
      {showWipeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-3xl border border-rose-500/50 bg-slate-900 text-white shadow-2xl space-y-4 dir-rtl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">
                  تأكيد تصفير المنصة نهائياً
                </h3>
                <p className="text-xs text-rose-300">
                  حذف كلي لجميع الكتب والملفات والتقييمات
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-2xl border border-slate-800">
              هل أنت متأكد حتماً من إجراء عملية{" "}
              <strong className="text-rose-400">التصفير الشامل</strong>؟ سيتم
              مسح جميع الكتب، التسجيلات الصوتية المرفوعة، التقييمات، والمهام
              وتصفير النظام بالكامل وتفريغ المنصة.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleConfirmWipeData}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/40 cursor-pointer transition-all"
              >
                نعم، أكد تصفير كل شيء ومسح البيانات
              </button>
              <button
                onClick={() => setShowWipeModal(false)}
                className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Status Bar */}
      <footer className="h-10 border-t border-slate-800 bg-slate-950 px-6 sm:px-8 flex items-center justify-between text-xs text-slate-500 font-mono fixed bottom-0 left-0 right-0 z-30 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar">
          <NetworkLatencyMonitor />
          <span className="flex items-center gap-1.5 shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${
                firestoreStatus === "connected" && isOnline
                  ? "bg-amber-400 animate-pulse"
                  : firestoreStatus === "error" || !isOnline
                    ? "bg-amber-700"
                    : "bg-amber-500/50"
              }`}
            ></span>
            <span
              className={`${
                firestoreStatus === "connected" && isOnline
                  ? "text-amber-400 font-bold"
                  : "text-amber-500/80 font-medium"
              }`}
            >
              {firestoreStatus === "connected" && isOnline
                ? "Firebase Firestore (Active Sync)"
                : !isOnline
                  ? "Firebase Firestore (Offline Mode)"
                  : "Firebase Firestore (Offline Cache / Standby)"}
            </span>
          </span>
          <span className="text-slate-700">•</span>
          <span className="flex items-center gap-1.5 shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}
            ></span>
            <span
              className={`${isOnline ? "text-emerald-400" : "text-red-400"} font-semibold`}
            >
              {isOnline ? "Supabase Cloud" : "Supabase (Offline)"}
            </span>
          </span>
          <span className="hidden sm:inline-block text-slate-700">•</span>

          {/* Real-time Google Drive Synchronization Status with Progress Level */}
          {driveSyncState === "syncing" ? (
            <div className="flex items-center gap-2 text-amber-300 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
              <Loader2 className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
              <span>
                رفع مجزأ (Google Drive):{" "}
                <strong className="text-amber-400 font-mono">
                  {driveSyncDetails.progress || 0}%
                </strong>
              </span>
              <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all durationSeconds-300"
                  style={{ width: `${driveSyncDetails.progress || 0}%` }}
                />
              </div>
              <span className="text-[9px] text-slate-400 font-mono">
                [{driveSyncDetails.chunkIndex || 1}/
                {driveSyncDetails.totalChunks || 1}]
              </span>
            </div>
          ) : driveSyncState === "success" ? (
            <span className="flex items-center gap-1.5 shrink-0 text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
              <Check className="w-3 h-3 text-emerald-400" />
              <span>تمت المزامنة وحفظ الرابط بـ Firestore (100% ✓)</span>
            </span>
          ) : (
            <span className="hidden sm:flex items-center gap-1.5 shrink-0 text-blue-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              <span>Google Drive Audio Hub</span>
            </span>
          )}
        </div>
        <div className="truncate shrink-0">
          Ensat Central Hub v2.5.0 —{" "}
          <strong className="text-amber-400 font-bold">
            {currentUser?.name || "Guest"}
          </strong>
        </div>
      </footer>
    </div>
  );
}
