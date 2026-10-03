// @ts-nocheck
import { apiFetch } from "../lib/api";
import { AudioRecording } from "../types";
import {
  deleteRecording,
  deleteMultipleRecordings,
  updateRecording,
} from "../lib/supabaseClient";

export const recordingService = {
  async removeRecording(
    recId: string,
    actorName: string,
  ): Promise<AudioRecording[]> {
    return await deleteRecording(recId, actorName);
  },

  async updateRecordingStatus(
    recId: string,
    updates: Partial<AudioRecording>,
    actorName: string,
  ): Promise<AudioRecording[]> {
    if (!recId) {
      console.warn("updateRecording skipped: 'id' is undefined or missing.");
      return [];
    }
    // 1. Database Update
    const result = await updateRecording(recId, updates, actorName);

    // 2. Trigger Google Drive Lifecycle Move (Background Pipeline)
    // If workflowStatus changed, let's call the background process to move it
    if (updates.workflowStatus) {
      let stage = "raw";
      if (updates.workflowStatus === "RAW_APPROVED") stage = "qa_approved";
      if (updates.workflowStatus === "PUBLISHED") stage = "final";
      if (
        updates.workflowStatus === "ENGINEER_REVISION_REQUIRED" ||
        updates.workflowStatus === "ENGINEER_REVISION_REQUIRED" ||
        updates.workflowStatus === "ENGINEER_REVISION_REQUIRED"
      )
        stage = "qa_rejected";
      if (updates.workflowStatus === "MASTERING") stage = "engineered";

      // Fire and forget (0ms perceived latency on client)
      apiFetch("/api/drive-lifecycle-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recId,
          newStage: stage,
          newName: stage === "final" ? updates.masteredUrl : undefined,
        }),
      }).catch(console.error);
    }

    return result;
  },

  async batchRemove(
    recIds: string[],
    actorName: string,
  ): Promise<AudioRecording[]> {
    return await deleteMultipleRecordings(recIds, actorName);
  },
};
