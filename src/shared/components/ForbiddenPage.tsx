import React from "react";
export function ForbiddenPage({ message }: { message?: string }) {
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
        {message || "ليس لديك الصلاحية الكافية للوصول لهذه الصفحة."}
      </p>
      <a href="/portal" className="btn btn-primary">
        العودة للبوابة الرئيسية
      </a>
    </div>
  );
}
