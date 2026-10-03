import React from "react";
import { useAuth } from "./useAuth";
import { canAccessPlatform } from "../lib/rbacPolicy";
import type { PlatformId } from "../types";

interface PlatformGuardProps {
  platform: PlatformId;
  children: React.ReactNode;
}

/**
 * PlatformGuard: يفحص الصلاحية قبل تحميل بيانات المنصة.
 * لا يعرض المحتوى ثم يخفيه — يفحص أولاً دائماً.
 */
export function PlatformGuard({ platform, children }: PlatformGuardProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="platform-loading">
        <div className="spinner" />
        <span style={{ color: "var(--c-text-muted)", fontSize: "0.9rem" }}>
          جارٍ التحقق من الصلاحيات...
        </span>
      </div>
    );
  }

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  if (!canAccessPlatform(user as any, platform)) {
    return <ForbiddenPage platform={platform} />;
  }

  return <>{children}</>;
}

function ForbiddenPage({ platform }: { platform: PlatformId }) {
  const names: Record<string, string> = {
    recording: "استوديو التسجيل",
    tasks: "منصة المهام",
    rewards: "منصة المجوهرات",
    admin: "لوحة الإدارة",
    public: "الواجهة العامة",
  };
  return (
    <div className="platform-loading" style={{ gap: 24 }}>
      <div style={{ fontSize: "4rem" }}>🚫</div>
      <h1 style={{ fontSize: "1.5rem", color: "var(--c-danger)" }}>
        403 — غير مصرح
      </h1>
      <p
        style={{
          color: "var(--c-text-muted)",
          maxWidth: 400,
          textAlign: "center",
        }}
      >
        ليس لديك صلاحية الوصول إلى{" "}
        <strong style={{ color: "var(--c-text)" }}>{names[platform]}</strong>.
        إذا كنت تعتقد أن هذا خطأ، تواصل مع الإدارة.
      </p>
      <a href="/portal" className="btn btn-primary">
        العودة للبوابة الرئيسية
      </a>
    </div>
  );
}
