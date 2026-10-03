// @ts-nocheck

import { db } from "./firebaseClient";
import { uploadQueueManager } from "./uploadQueue";
import { toastStore } from "./toastStore";

export class BackgroundSyncManager {
  // Drive credentials are strictly managed server-side via environment variables
  async syncDriveConfigFromFirestore() {
    // No-op: Server-side environment variables manage Drive configuration securely
  }

  async saveDriveConfigToFirestore(_config: any) {
    // No-op: Credentials must never be saved to client-accessible Firestore documents
  }
  private unsubscribe: (() => void) | null = null;
  private retryInterval: any = null;

  startSync() {
    this.syncDriveConfigFromFirestore();
    if (!db) {
      console.warn("Firestore is not initialized. Background sync disabled.");
      return;
    }

    console.log(
      "Starting background sync for Google Drive (lightweight mode)...",
    );

    // Continuous onSnapshot listener on entire audio_recordings collection removed
    // to protect Firestore read quotas. Local uploadQueue events handle drive updates.

    // Auto-retry failed items in the local queue every 60 seconds
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }
    this.retryInterval = setInterval(() => {
      // Accessing the private queue array directly for the background service
      const queue = (uploadQueueManager as any).queue || [];
      const failedItems = queue.filter(
        (item: any) => item.workflowStatus === "failed",
      );

      if (failedItems.length > 0) {
        toastStore.addToast({
          type: "info",
          title: "إعادة محاولة المزامنة",
          message: `جاري محاولة رفع ${failedItems.length} ملفات فشل رفعها مسبقاً إلى Drive...`,
        });

        failedItems.forEach((item: any) => {
          uploadQueueManager.retryItem(item.id);
        });
      }
    }, 60000);
  }

  stopSync() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }
}

export const backgroundSync = new BackgroundSyncManager();
