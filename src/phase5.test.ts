import { describe, expect, it } from "vitest";
import {
  canGiftGems,
  gemPackageCost,
  isWindowActive,
  leaderboardPointsForGems,
} from "./lib/rewardPolicy";
import { canUpdateTaskStatus, isTaskStatus } from "./lib/taskPolicy";
import { idempotencyDigest } from "./lib/idempotency";

describe("phase 5 task and reward policy", () => {
  it("accepts only the published gem packages and computes their exact costs", () => {
    expect(gemPackageCost(1)).toBe(5);
    expect(gemPackageCost(3)).toBe(12);
    expect(gemPackageCost(5)).toBe(18);
    expect(gemPackageCost(2)).toBeNull();
  });

  it("prevents self-gifting and overspending gems", () => {
    expect(canGiftGems("a", "b", 3, 2)).toBe(true);
    expect(canGiftGems("a", "a", 3, 2)).toBe(false);
    expect(canGiftGems("a", "b", 1, 2)).toBe(false);
  });

  it("converts received gems to leaderboard points without accepting negatives", () => {
    expect(leaderboardPointsForGems(4)).toBe(12);
    expect(leaderboardPointsForGems(-4)).toBe(0);
  });

  it("recognises the 24-hour purchase window deterministically", () => {
    const now = Date.parse("2026-01-02T00:00:00.000Z");
    expect(isWindowActive("2026-01-01T12:00:00.000Z", now)).toBe(true);
    expect(isWindowActive("2025-12-31T23:59:59.000Z", now)).toBe(false);
  });

  it("keeps task status changes and admin-only management explicit", () => {
    expect(isTaskStatus("in_review")).toBe(true);
    expect(isTaskStatus("delete_everything")).toBe(false);
    expect(canUpdateTaskStatus("u1", "member", ["u1"])).toBe(true);
    expect(canUpdateTaskStatus("u2", "member", ["u1"])).toBe(false);
    expect(canUpdateTaskStatus("u2", "admin", [])).toBe(true);
  });

  it("requires a sufficiently unique idempotency key and hashes it", () => {
    expect(idempotencyDigest("short")).toBeNull();
    const digest = idempotencyDigest("client-operation-2026-0001");
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(idempotencyDigest("client-operation-2026-0001")).toBe(digest);
  });
});
