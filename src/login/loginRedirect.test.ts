/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { getSafeLoginDestination } from "./LoginPage";

describe("login redirect validation", () => {
  it("accepts only known same-origin application routes", () => {
    expect(getSafeLoginDestination("/tasks?tab=mine")).toBe("/tasks?tab=mine");
    expect(getSafeLoginDestination("/recording#queue")).toBe(
      "/recording#queue",
    );
  });

  it("rejects protocol-relative, absolute, encoded, and unknown destinations", () => {
    expect(getSafeLoginDestination("//evil.example")).toBe("/portal");
    expect(getSafeLoginDestination("https://evil.example")).toBe("/portal");
    expect(getSafeLoginDestination("%2F%2Fevil.example")).toBe("/portal");
    expect(getSafeLoginDestination("/not-a-real-route")).toBe("/portal");
  });
});
