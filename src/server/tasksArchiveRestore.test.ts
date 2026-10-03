/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import http from "http";
import express from "express";
import { tasksRouter } from "./tasks/tasksRouter";
import * as firebaseAdmin from "./firebaseAdmin";
import * as supabaseAdmin from "./supabaseAdmin";

// Setup test Express app with mocked auth middleware for tasksRouter
const app = express();
app.use(express.json());

// Mock req.user for tests
app.use((req: any, _res, next) => {
  req.user = {
    uid: "admin-user-1",
    canonicalRole: "SUPER_ADMIN",
    permissions: [
      "access_tasks_platform",
      "manage_tasks",
      "tasks.archive_any",
      "tasks.restore",
    ],
  };
  next();
});

app.use("/api/tasks", tasksRouter);

let server: http.Server;
let baseUrl: string;
const tasksStore = new Map<string, any>();

beforeAll(async () => {
  // Seed initial task
  tasksStore.set("task-real-101", {
    title: "تسجيل صوتي للفصل الأول",
    description: "المهمة الموكلة للراوي لتسجيل الفصل الأول",
    assigneeUids: ["user-narrator-1"],
    status: "IN_PROGRESS",
    priority: "HIGH",
    isArchived: false,
    isDeleted: false,
    createdAt: "2026-09-01T10:00:00.000Z",
  });

  const mockFirestore: any = {
    collection: vi.fn((colName: string) => {
      if (colName === "tasks") {
        return {
          doc: vi.fn((docId: string) => ({
            get: vi.fn(async () => {
              const data = tasksStore.get(docId);
              return {
                exists: !!data,
                id: docId,
                data: () => data,
              };
            }),
            update: vi.fn(async (updates: any) => {
              const existing = tasksStore.get(docId) || {};
              tasksStore.set(docId, { ...existing, ...updates });
              return {};
            }),
            set: vi.fn(async (data: any, options?: any) => {
              const existing = options?.merge
                ? tasksStore.get(docId) || {}
                : {};
              tasksStore.set(docId, { ...existing, ...data });
              return {};
            }),
            delete: vi.fn(async () => {
              tasksStore.delete(docId);
              return {};
            }),
          })),
          limit: vi.fn(() => ({
            get: vi.fn(async () => {
              const docs = Array.from(tasksStore.entries()).map(
                ([id, data]) => ({
                  id,
                  data: () => data,
                }),
              );
              return { docs };
            }),
          })),
          where: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(async () => {
                const docs = Array.from(tasksStore.entries()).map(
                  ([id, data]) => ({
                    id,
                    data: () => data,
                  }),
                );
                return { docs };
              }),
            })),
          })),
        };
      }
      if (colName === "audit_logs") {
        return {
          add: vi.fn(async () => ({ id: "audit-1" })),
        };
      }
      return {};
    }),
  };

  vi.spyOn(firebaseAdmin, "getFirebaseAdminFirestore").mockReturnValue(
    mockFirestore,
  );
  vi.spyOn(supabaseAdmin, "getSupabaseAdminClient").mockReturnValue(null);

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

describe("Tasks Lifecycle: Archive, Refresh Check, and Restore Acceptance Tests", () => {
  it("complete acceptance sequence: Active -> Archive -> Refresh (Omitted) -> View in Archive -> Restore -> Refresh (Returned)", async () => {
    // 1. Initial active list contains task
    const res1 = await fetch(`${baseUrl}/api/tasks`);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.success).toBe(true);
    expect(body1.tasks.some((t: any) => t.id === "task-real-101")).toBe(true);

    // 2. Archive the task
    const archiveRes = await fetch(
      `${baseUrl}/api/tasks/task-real-101/archive`,
      { method: "POST" },
    );
    expect(archiveRes.status).toBe(200);
    const archiveBody = await archiveRes.json();
    expect(archiveBody.success).toBe(true);

    // 3. Refresh active tasks (GET /api/tasks) -> task MUST be omitted
    const refreshRes = await fetch(`${baseUrl}/api/tasks`);
    expect(refreshRes.status).toBe(200);
    const refreshBody = await refreshRes.json();
    expect(refreshBody.success).toBe(true);
    const foundInActive = refreshBody.tasks.find(
      (t: any) => t.id === "task-real-101",
    );
    expect(foundInActive).toBeUndefined();

    // 4. Archive view (GET /api/tasks?includeArchived=true) -> task IS present with isArchived = true
    const archiveListRes = await fetch(
      `${baseUrl}/api/tasks?includeArchived=true`,
    );
    expect(archiveListRes.status).toBe(200);
    const archiveListBody = await archiveListRes.json();
    expect(archiveListBody.success).toBe(true);
    const foundInArchive = archiveListBody.tasks.find(
      (t: any) => t.id === "task-real-101",
    );
    expect(foundInArchive).toBeDefined();
    expect(foundInArchive.isArchived).toBe(true);

    // 5. Restore the task
    const restoreRes = await fetch(
      `${baseUrl}/api/tasks/task-real-101/restore`,
      { method: "POST" },
    );
    expect(restoreRes.status).toBe(200);
    const restoreBody = await restoreRes.json();
    expect(restoreBody.success).toBe(true);

    // 6. Refresh active tasks again -> task IS back in the list!
    const restoredListRes = await fetch(`${baseUrl}/api/tasks`);
    expect(restoredListRes.status).toBe(200);
    const restoredListBody = await restoredListRes.json();
    expect(restoredListBody.success).toBe(true);
    const foundRestored = restoredListBody.tasks.find(
      (t: any) => t.id === "task-real-101",
    );
    expect(foundRestored).toBeDefined();
    expect(foundRestored.isArchived).toBe(false);
  });

  it("gracefully returns 404 for non-existent task on archive or restore", async () => {
    const archiveRes = await fetch(
      `${baseUrl}/api/tasks/non-existent-999/archive`,
      { method: "POST" },
    );
    expect(archiveRes.status).toBe(404);
    const archiveBody = await archiveRes.json();
    expect(archiveBody.error).toBe("المهمة غير موجودة");

    const restoreRes = await fetch(
      `${baseUrl}/api/tasks/non-existent-999/restore`,
      { method: "POST" },
    );
    expect(restoreRes.status).toBe(404);
    const restoreBody = await restoreRes.json();
    expect(restoreBody.error).toBe("المهمة غير موجودة");
  });

  it("bulk operations: archives and restores multiple tasks simultaneously", async () => {
    // Seed two tasks
    tasksStore.set("bulk-1", {
      title: "مهمة مجمعة 1",
      assigneeUids: ["user-1"],
      status: "OPEN",
      isArchived: false,
    });
    tasksStore.set("bulk-2", {
      title: "مهمة مجمعة 2",
      assigneeUids: ["user-2"],
      status: "OPEN",
      isArchived: false,
    });

    // 1. Bulk archive both
    const bulkArchiveRes = await fetch(`${baseUrl}/api/tasks/bulk-archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds: ["bulk-1", "bulk-2"] }),
    });
    expect(bulkArchiveRes.status).toBe(200);
    const bulkArchiveBody = await bulkArchiveRes.json();
    expect(bulkArchiveBody.success).toBe(true);
    expect(bulkArchiveBody.count).toBe(2);

    expect(tasksStore.get("bulk-1")?.isArchived).toBe(true);
    expect(tasksStore.get("bulk-2")?.isArchived).toBe(true);

    // 2. Bulk restore both
    const bulkRestoreRes = await fetch(`${baseUrl}/api/tasks/bulk-restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds: ["bulk-1", "bulk-2"] }),
    });
    expect(bulkRestoreRes.status).toBe(200);
    const bulkRestoreBody = await bulkRestoreRes.json();
    expect(bulkRestoreBody.success).toBe(true);
    expect(bulkRestoreBody.count).toBe(2);

    expect(tasksStore.get("bulk-1")?.isArchived).toBe(false);
    expect(tasksStore.get("bulk-2")?.isArchived).toBe(false);

    // 3. Bulk status change
    const bulkStatusRes = await fetch(`${baseUrl}/api/tasks/bulk-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskIds: ["bulk-1", "bulk-2"],
        status: "COMPLETED",
      }),
    });
    expect(bulkStatusRes.status).toBe(200);
    const bulkStatusBody = await bulkStatusRes.json();
    expect(bulkStatusBody.success).toBe(true);
    expect(tasksStore.get("bulk-1")?.status).toBe("COMPLETED");
    expect(tasksStore.get("bulk-2")?.status).toBe("COMPLETED");
  });

  it("updates task deadline via PATCH and returns it in GET /api/tasks", async () => {
    // 1. Update task-real-101 with a specific deadline
    const newDeadline = "2026-10-15";
    const patchRes = await fetch(`${baseUrl}/api/tasks/task-real-101`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate: newDeadline, deadline: newDeadline }),
    });

    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.success).toBe(true);
    expect(patchBody.updates.due_date).toBe(newDeadline);

    // Verify task in memory store was updated
    const updatedStored = tasksStore.get("task-real-101");
    expect(updatedStored?.dueDate || updatedStored?.deadline).toBe(newDeadline);

    // 2. Fetch via GET /api/tasks and verify deadline is persisted and returned
    const getRes = await fetch(`${baseUrl}/api/tasks`);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.success).toBe(true);
    const foundTask = getBody.tasks.find((t: any) => t.id === "task-real-101");
    expect(foundTask).toBeDefined();
    expect(foundTask.deadline).toBe(newDeadline);
    expect(foundTask.dueDate).toBe(newDeadline);
  });

  it("permanently deletes a task via DELETE /api/tasks/:id and ensures it does not reappear", async () => {
    // 1. Seed a task to delete
    tasksStore.set("delete-test-1", {
      title: "مهمة للحذف النهائي",
      description: "سيتم حذفها للأبد",
      isArchived: true,
      status: "ARCHIVED",
      updatedAt: new Date().toISOString(),
    });

    // Verify it exists in list
    const initialList = await (
      await fetch(`${baseUrl}/api/tasks?includeArchived=true`)
    ).json();
    expect(initialList.tasks.some((t: any) => t.id === "delete-test-1")).toBe(
      true,
    );

    // 2. Perform DELETE /api/tasks/:id
    const deleteRes = await fetch(`${baseUrl}/api/tasks/delete-test-1`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(200);
    const deleteBody = await deleteRes.json();
    expect(deleteBody.success).toBe(true);

    // 3. Verify it is permanently gone and does not reappear
    const afterList = await (
      await fetch(`${baseUrl}/api/tasks?includeArchived=true`)
    ).json();
    expect(afterList.tasks.some((t: any) => t.id === "delete-test-1")).toBe(
      false,
    );
  });

  it("permanently deletes multiple tasks via POST /api/tasks/bulk-delete", async () => {
    // 1. Seed two tasks
    tasksStore.set("bulk-del-1", {
      title: "حذف مجمع 1",
      isArchived: true,
      status: "ARCHIVED",
      updatedAt: new Date().toISOString(),
    });
    tasksStore.set("bulk-del-2", {
      title: "حذف مجمع 2",
      isArchived: true,
      status: "ARCHIVED",
      updatedAt: new Date().toISOString(),
    });

    // 2. Perform bulk delete
    const bulkDelRes = await fetch(`${baseUrl}/api/tasks/bulk-delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds: ["bulk-del-1", "bulk-del-2"] }),
    });
    expect(bulkDelRes.status).toBe(200);
    const bulkDelBody = await bulkDelRes.json();
    expect(bulkDelBody.success).toBe(true);
    expect(bulkDelBody.count).toBe(2);

    // 3. Verify they are permanently gone
    const afterList = await (
      await fetch(`${baseUrl}/api/tasks?includeArchived=true`)
    ).json();
    expect(
      afterList.tasks.some(
        (t: any) => t.id === "bulk-del-1" || t.id === "bulk-del-2",
      ),
    ).toBe(false);
  });
});
