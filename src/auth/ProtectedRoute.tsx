import React from "react";
import { useAuth } from "./useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * ProtectedRoute: يمنع الوصول إذا لم يكن المستخدم مسجلاً.
 * يتحقق من الجلسة أولاً — لا يعرض المحتوى ثم يخفيه.
 */
export function ProtectedRoute({
  children,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="platform-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    const currentPath = window.location.pathname + window.location.search;
    const redirectUrl = `${redirectTo}?next=${encodeURIComponent(currentPath)}`;
    window.location.replace(redirectUrl);
    return null;
  }

  // تحقق إضافي: PENDING و SUSPENDED يُعادَن لصفحة خاصة
  if (user.status === "pending" || user.role === "MEMBER") {
    return (
      <div className="platform-loading" style={{ gap: 24 }}>
        <div style={{ fontSize: "3rem" }}>⏳</div>
        <h2 style={{ color: "var(--c-warning)" }}>حسابك قيد المراجعة</h2>
        <p
          style={{
            color: "var(--c-text-muted)",
            maxWidth: 400,
            textAlign: "center",
          }}
        >
          تم إنشاء حسابك بنجاح وهو الآن قيد مراجعة الإدارة. سيتم إشعارك عند
          التفعيل.
        </p>
      </div>
    );
  }

  if (user.status === "disabled") {
    return (
      <div className="platform-loading" style={{ gap: 24 }}>
        <div style={{ fontSize: "3rem" }}>🚫</div>
        <h2 style={{ color: "var(--c-danger)" }}>تم تعليق الحساب</h2>
        <p
          style={{
            color: "var(--c-text-muted)",
            maxWidth: 400,
            textAlign: "center",
          }}
        >
          حسابك معلق. يرجى التواصل مع الإدارة للاستفسار.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
