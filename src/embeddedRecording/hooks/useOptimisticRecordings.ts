// @ts-nocheck
import { AudioRecording } from "../types";
import { recordingService } from "../services/recordingService";

export function useOptimisticRecordings(
  initialRecordings: AudioRecording[],
  onRecordingsUpdated: (recordings: AudioRecording[]) => void,
  currentUser: any,
  setAlertNotice: (msg: string) => void,
) {
  const handleDelete = async (recId: string) => {
    const previousRecordings = [...initialRecordings];
    const optimisticUpdated = initialRecordings.filter((r) => r.id !== recId);

    // Instant 0ms UI update
    onRecordingsUpdated(optimisticUpdated);

    try {
      const updated = await recordingService.removeRecording(
        recId,
        currentUser?.name || "المدير",
      );
      onRecordingsUpdated(updated);
    } catch (error) {
      console.error("Failed to delete recording:", error);
      onRecordingsUpdated(previousRecordings);
      setAlertNotice("لم يتم حفظ التغيير، تم استرجاع الحالة تلقائياً");
    }
  };

  const handleUpdate = async (
    recId: string,
    updates: Partial<AudioRecording>,
    actionNote: string,
  ) => {
    const previousRecordings = [...initialRecordings];
    const optimisticUpdated = initialRecordings.map((r) =>
      r.id === recId ? { ...r, ...updates } : r,
    );

    // Instant 0ms UI update
    onRecordingsUpdated(optimisticUpdated as AudioRecording[]);

    try {
      const updated = await recordingService.updateRecordingStatus(
        recId,
        updates,
        currentUser?.name || actionNote,
      );
      onRecordingsUpdated(updated);
    } catch (error) {
      console.error("Failed to update recording:", error);
      onRecordingsUpdated(previousRecordings);
      setAlertNotice("لم يتم حفظ التغيير، تم استرجاع الحالة تلقائياً");
    }
  };

  const handleBatchDelete = async (recIds: string[]) => {
    const previousRecordings = [...initialRecordings];
    const optimisticUpdated = initialRecordings.filter(
      (r) => !recIds.includes(r.id),
    );

    // Instant 0ms UI update
    onRecordingsUpdated(optimisticUpdated);

    try {
      const updated = await recordingService.batchRemove(
        recIds,
        currentUser?.name || "المدير",
      );
      onRecordingsUpdated(updated);
    } catch (error) {
      console.error("Failed to batch delete recordings:", error);
      onRecordingsUpdated(previousRecordings);
      setAlertNotice("لم يتم حفظ التغيير، تم استرجاع الحالة تلقائياً");
    }
  };

  return { handleDelete, handleUpdate, handleBatchDelete };
}
