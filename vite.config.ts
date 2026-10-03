import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(() => {
  return {
    // Express serves Vite in middleware mode; disabling the refresh preamble
    // avoids a blank screen in embedded browsers while keeping normal reloads.
    plugins: [react({ fastRefresh: false }), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(projectRoot),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== "true",
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
    build: {
      sourcemap: false,
      // Firestore is the largest independently cached vendor chunk (~558 kB).
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        onwarn(warning, warn) {
          // These modules intentionally have eager consumers as well as lazy
          // fallback call sites; Rollup correctly keeps them in the eager chunk.
          if (warning.message.includes("dynamically imported") && warning.message.includes("but also statically imported")) return;
          warn(warning);
        },
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("@firebase/auth") || id.includes("firebase/auth")) return "firebase-auth";
            if (id.includes("@firebase/firestore") || id.includes("firebase/firestore")) return "firebase-firestore";
            if (id.includes("@firebase/storage") || id.includes("firebase/storage")) return "firebase-storage";
            if (id.includes("firebase")) return "firebase-core";
            if (id.includes("@supabase")) return "supabase-vendor";
            if (id.includes("recharts") || id.includes("d3-")) return "charts-vendor";
            if (id.includes("jspdf")) return "pdf-vendor";
            if (id.includes("html2canvas")) return "canvas-vendor";
            if (id.includes("jszip")) return "zip-vendor";
            if (id.includes("qrcode")) return "qrcode-vendor";
            if (id.includes("motion") || id.includes("framer-motion")) return "motion-vendor";
            if (id.includes("react") || id.includes("scheduler")) return "react-vendor";
            return undefined;
          },
        },
      },
    },
  };
});
