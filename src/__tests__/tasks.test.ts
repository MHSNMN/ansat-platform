import { describe, it, expect } from "vitest";
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  isTaskStatus,
  normalizeStatus,
  canUpdateTaskStatus,
  MEMBER_ALLOWED_STATUS_CHANGES,
} from "../lib/taskPolicy";

describe("Tasks Policy & Permission Tests", () => {
  it("supports 7 canonical task statuses", () => {
    expect(TASK_STATUSES).toEqual([
      "TODO",
      "IN_PROGRESS",
      "BLOCKED",
      "IN_REVIEW",
      "COMPLETED",
      "CANCELLED",
      "ARCHIVED",
    ]);
  });

  it("validates task status inputs correctly in upper and lowercase", () => {
    expect(isTaskStatus("TODO")).toBe(true);
    expect(isTaskStatus("todo")).toBe(true);
    expect(isTaskStatus("ARCHIVED")).toBe(true);
    expect(isTaskStatus("INVALID_STATUS")).toBe(false);
    expect(isTaskStatus(123)).toBe(false);
  });

  it("normalizes task statuses to uppercase", () => {
    expect(normalizeStatus("in_progress")).toBe("IN_PROGRESS");
    expect(normalizeStatus("completed")).toBe("COMPLETED");
    expect(normalizeStatus("garbage")).toBe("TODO");
  });

  it("allows admins to update any task", () => {
    expect(canUpdateTaskStatus("admin_1", "admin", ["user_a"])).toBe(true);
    expect(canUpdateTaskStatus("super_1", "super_admin", [])).toBe(true);
  });

  it("allows assigned members to update their assigned task only", () => {
    expect(
      canUpdateTaskStatus("user_123", "member", ["user_123", "user_456"]),
    ).toBe(true);
    expect(
      canUpdateTaskStatus("user_999", "member", ["user_123", "user_456"]),
    ).toBe(false);
    expect(canUpdateTaskStatus("user_123", "member", null)).toBe(false);
  });

  it("enforces member allowed status transitions strictly", () => {
    expect(MEMBER_ALLOWED_STATUS_CHANGES.has("IN_PROGRESS")).toBe(true);
    expect(MEMBER_ALLOWED_STATUS_CHANGES.has("COMPLETED")).toBe(true);
    expect(MEMBER_ALLOWED_STATUS_CHANGES.has("BLOCKED")).toBe(true);
    // Members cannot directly archive or mark TODO
    expect(MEMBER_ALLOWED_STATUS_CHANGES.has("ARCHIVED")).toBe(false);
  });

  it("verifies task priorities", () => {
    expect(TASK_PRIORITIES).toContain("LOW");
    expect(TASK_PRIORITIES).toContain("NORMAL");
    expect(TASK_PRIORITIES).toContain("HIGH");
    expect(TASK_PRIORITIES).toContain("URGENT");
  });
});
