import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./lib/api";
import App from "./App.tsx";
import "./index.css";

// Automatically reload the page if Vite encounters a stale or failed module preload
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", () => {
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
