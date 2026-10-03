import React from "react";
import { PublicPortal } from "../components/PublicPortal";
import { ErrorBoundary } from "../shared/components/ErrorBoundary";
import "./styles/public.css";

export function PublicApp() {
  const handleOpenWorkspace = () => {
    window.location.href = "/portal";
  };

  return (
    <ErrorBoundary>
      <div className="public-app-container">
        <PublicPortal onOpenWorkspace={handleOpenWorkspace} />
      </div>
    </ErrorBoundary>
  );
}
export default PublicApp;
