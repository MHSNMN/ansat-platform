import React from "react";
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="platform-loading" style={{ gap: 16 }}>
            <div style={{ fontSize: "3rem" }}>⚠️</div>
            <h2 style={{ color: "var(--c-danger)" }}>حدث خطأ غير متوقع</h2>
            <p style={{ color: "var(--c-text-muted)" }}>
              {this.state.error?.message ||
                "يرجى تحديث الصفحة أو التواصل مع الدعم."}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              تحديث الصفحة
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
