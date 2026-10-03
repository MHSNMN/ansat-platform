import React from "react";
export function Spinner({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "3px solid var(--c-border)",
        borderTopColor: "var(--c-accent)",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}
export function FullPageSpinner({
  label = "جارٍ التحميل...",
}: {
  label?: string;
}) {
  return (
    <div className="platform-loading">
      <Spinner />
      {label && (
        <span style={{ color: "var(--c-text-muted)", fontSize: "0.9rem" }}>
          {label}
        </span>
      )}
    </div>
  );
}
