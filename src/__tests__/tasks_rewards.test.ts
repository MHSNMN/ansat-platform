import { describe, it, expect } from "vitest";
import {
  gemPackageCost,
  canGiftGems,
  isWindowActive,
  leaderboardPointsForGems,
} from "../lib/rewardPolicy";
import { isTaskStatus, canUpdateTaskStatus } from "../lib/taskPolicy";
import { idempotencyDigest } from "../lib/idempotency";

describe("Reward Policy Engine", () => {
  it("calculates gem package costs correctly", () => {
    expect(gemPackageCost(1)).toBe(5);
    expect(gemPackageCost(3)).toBe(12);
    expect(gemPackageCost(5)).toBe(18);
    expect(gemPackageCost(2)).toBeNull();
    expect(gemPackageCost(10)).toBeNull();
  });

  it("prevents self-gifting and invalid gem quantities", () => {
    expect(canGiftGems("user_1", "user_1", 10, 1)).toBe(false);
    expect(canGiftGems("user_1", "user_2", 2, 5)).toBe(false); // insufficient owned
    expect(canGiftGems("user_1", "user_2", 10, 3)).toBe(true);
    expect(canGiftGems("user_1", "user_2", 10, 0)).toBe(false);
  });

  it("calculates leaderboard points for received gems (3 points per gem)", () => {
    expect(leaderboardPointsForGems(0)).toBe(0);
    expect(leaderboardPointsForGems(1)).toBe(3);
    expect(leaderboardPointsForGems(5)).toBe(15);
  });

  it("evaluates active time windows accurately", () => {
    const now = Date.now();
    const recent = new Date(now - 1000 * 60 * 60).toISOString(); // 1 hour ago
    const old = new Date(now - 1000 * 60 * 60 * 48).toISOString(); // 48 hours ago

    expect(isWindowActive(recent, now, 24 * 60 * 60 * 1000)).toBe(true);
    expect(isWindowActive(old, now, 24 * 60 * 60 * 1000)).toBe(false);
    expect(isWindowActive(undefined, now)).toBe(false);
  });
});

describe("Task Policy Engine", () => {
  it("validates valid task statuses", () => {
    expect(isTaskStatus("todo")).toBe(true);
    expect(isTaskStatus("in_progress")).toBe(true);
    expect(isTaskStatus("completed")).toBe(true);
    expect(isTaskStatus("invalid_status")).toBe(false);
  });

  it("enforces task status update permissions", () => {
    // Admin can update any task
    expect(canUpdateTaskStatus("admin_1", "admin", ["user_1"])).toBe(true);
    // Assignee can update their own task
    expect(
      canUpdateTaskStatus("user_1", "narrator", ["user_1", "user_2"]),
    ).toBe(true);
    // Non-assignee cannot update another member's task
    expect(
      canUpdateTaskStatus("user_3", "narrator", ["user_1", "user_2"]),
    ).toBe(false);
  });
});

describe("Idempotency Key Digest", () => {
  it("returns sha256 hex digest for valid strings and null for missing keys", () => {
    const key = "req_1234567890123456";
    const digest1 = idempotencyDigest(key);
    const digest2 = idempotencyDigest(key);
    expect(digest1).toBe(digest2);
    expect(typeof digest1).toBe("string");
    expect(digest1?.length).toBe(64);

    expect(idempotencyDigest(undefined)).toBeNull();
    expect(idempotencyDigest("")).toBeNull();
    expect(idempotencyDigest("short_key")).toBeNull(); // < 16 chars
  });
});
