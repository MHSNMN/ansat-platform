import { describe, it, expect } from "vitest";

describe("Library Hours Calculation & Status Filtering", () => {
  function computeLibraryMetrics(
    docs: Array<{
      id: string;
      status: string;
      isArchived?: boolean;
      durationSeconds?: number;
    }>,
  ) {
    const countedDocIds = new Set<string>();
    let finalSeconds = 0;
    const publishedItems = [];

    for (const doc of docs) {
      if (doc.isArchived === true || doc.status !== "PUBLISHED") continue;

      if (!countedDocIds.has(doc.id)) {
        countedDocIds.add(doc.id);
        finalSeconds += Math.max(0, Number(doc.durationSeconds) || 0);
        publishedItems.push(doc);
      }
    }

    return {
      finalAudioSeconds: finalSeconds,
      finalAudioHours: Math.round((finalSeconds / 3600) * 10) / 10,
      publishedCount: publishedItems.length,
    };
  }

  it("calculates hours strictly from PUBLISHED items, excluding DRAFT and ARCHIVED items", () => {
    const mockDocs = [
      { id: "lib-1", status: "PUBLISHED", durationSeconds: 3600 }, // 1 hour
      { id: "lib-2", status: "DRAFT", durationSeconds: 7200 }, // Draft -> excluded
      { id: "lib-3", status: "ARCHIVED", durationSeconds: 1800 }, // Archived -> excluded
      {
        id: "lib-4",
        status: "PUBLISHED",
        isArchived: true,
        durationSeconds: 3600,
      }, // Soft archived -> excluded
      { id: "lib-5", status: "PUBLISHED", durationSeconds: 1800 }, // 0.5 hour
    ];

    const result = computeLibraryMetrics(mockDocs);
    // 3600 + 1800 = 5400 seconds = 1.5 hours
    expect(result.finalAudioSeconds).toBe(5400);
    expect(result.finalAudioHours).toBe(1.5);
    expect(result.publishedCount).toBe(2);
  });

  it("prevents double-counting if the same document ID is returned multiple times", () => {
    const duplicateDocs = [
      { id: "lib-unique-1", status: "PUBLISHED", durationSeconds: 3600 },
      { id: "lib-unique-1", status: "PUBLISHED", durationSeconds: 3600 }, // Duplicate doc ID
      { id: "lib-unique-2", status: "PUBLISHED", durationSeconds: 1800 },
    ];

    const result = computeLibraryMetrics(duplicateDocs);
    expect(result.finalAudioSeconds).toBe(5400);
    expect(result.publishedCount).toBe(2);
  });

  it("accurately changes when an item is published or unpublished", () => {
    const libraryState = [
      { id: "book-1", status: "PUBLISHED", durationSeconds: 3600 },
      { id: "book-2", status: "DRAFT", durationSeconds: 3600 },
    ];

    expect(computeLibraryMetrics(libraryState).finalAudioHours).toBe(1.0);

    // Publish book-2
    libraryState[1].status = "PUBLISHED";
    expect(computeLibraryMetrics(libraryState).finalAudioHours).toBe(2.0);

    // Unpublish book-1 (back to draft)
    libraryState[0].status = "DRAFT";
    expect(computeLibraryMetrics(libraryState).finalAudioHours).toBe(1.0);
  });

  it("distinguishes authentic zero hours from missing data", () => {
    const emptyLibrary: any[] = [];
    const result = computeLibraryMetrics(emptyLibrary);

    expect(result.finalAudioSeconds).toBe(0);
    expect(result.finalAudioHours).toBe(0);
    expect(result.publishedCount).toBe(0);
  });
});
