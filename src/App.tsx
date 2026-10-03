import React, { Suspense, lazy } from "react";
import { AuthProvider } from "./auth/AuthProvider";
import PublicApp from "./public/PublicApp";

function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<any>,
  exportName?: string,
) {
  return lazy(async () => {
    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const module = await factory();
        if (exportName && module[exportName]) {
          return { default: module[exportName] };
        }
        if (module.default) {
          return { default: module.default };
        }
        return module;
      } catch (error) {
        lastError = error;
        console.warn(
          `[App] Dynamic import attempt ${attempt} failed, retrying...`,
          error,
        );
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 400));
        }
      }
    }

    console.warn(
      "[App] All dynamic import attempts failed, attempting window reload...",
      lastError,
    );
    const hasRetried = window.sessionStorage.getItem("chunk_reload_retry");
    if (!hasRetried) {
      window.sessionStorage.setItem("chunk_reload_retry", "true");
      window.location.reload();
    }
    throw lastError;
  });
}

const LoginPage = lazyWithRetry(() => import("./login/LoginPage"), "LoginPage");
const PortalPage = lazyWithRetry(
  () => import("./portal/PortalPage"),
  "PortalPage",
);
const RecordingApp = lazyWithRetry(
  () => import("./recording/RecordingApp"),
  "RecordingApp",
);
const TasksApp = lazyWithRetry(() => import("./tasks/TasksApp"), "TasksApp");
const RewardsApp = lazyWithRetry(
  () => import("./rewards/RewardsApp"),
  "RewardsApp",
);
const AdminApp = lazyWithRetry(() => import("./admin/AdminApp"), "AdminApp");
const WorkspaceApp = lazyWithRetry(
  () => import("./workspace/WorkspaceApp"),
  "WorkspaceApp",
);
const CertificateVerificationPage = lazyWithRetry(
  () => import("./components/CertificateVerificationPage"),
  "CertificateVerificationPage",
);

function RouteLoading() {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#f8f5ec] flex flex-col items-center justify-center gap-4"
    >
      <div className="w-8 h-8 border-4 border-[#f7c62f] border-t-[#30266f] rounded-full animate-spin"></div>
      <p className="text-[#30266f] font-bold">جارٍ تحميل المنصة...</p>
    </div>
  );
}

export default function App() {
  const path = window.location.pathname;

  return (
    <AuthProvider>
      <Suspense fallback={<RouteLoading />}>
        {(() => {
          if (path === "/login") {
            return <LoginPage />;
          }
          if (path === "/portal") {
            return <PortalPage />;
          }
          if (path === "/recording" || path.startsWith("/recording/")) {
            return <RecordingApp />;
          }
          if (path === "/tasks" || path.startsWith("/tasks/")) {
            return <TasksApp />;
          }
          if (path === "/rewards" || path.startsWith("/rewards/")) {
            return <RewardsApp />;
          }
          if (path === "/admin" || path.startsWith("/admin/")) {
            return <AdminApp />;
          }
          if (path === "/workspace" || path.startsWith("/workspace/")) {
            return <WorkspaceApp />;
          }
          if (path.startsWith("/verify/")) {
            return <CertificateVerificationPage />;
          }
          return <PublicApp />;
        })()}
      </Suspense>
    </AuthProvider>
  );
}
