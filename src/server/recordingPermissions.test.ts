import { describe, it, expect } from "vitest";
import { evaluatePermission } from "../lib/recordingPermissions";
import {
  hasPermission,
  normalizeUserPermissions,
} from "../embeddedRecording/lib/permissions";

describe("Recording Permissions RBAC Engine", () => {
  it("does not promote a member based on display name or legacy boolean flags", () => {
    const member = {
      id: "member-1",
      role: "MEMBER",
      role_display_ar: "مدير عام",
      name: "محسن",
      can_upload_raw: true,
      can_manage_books: true,
      can_access_studio: true,
      platformAccess: { recording: false },
    } as any;
    const normalized = normalizeUserPermissions(member);
    expect(normalized.is_super_admin).toBe(false);
    expect(normalized.can_upload_raw).toBe(false);
    expect(normalized.can_manage_books).toBe(false);
    expect(hasPermission(member, "recording.raw.upload")).toBe(false);
  });

  it("honors action DENY even when an old UI flag is true", () => {
    const narrator = {
      id: "narrator-1",
      role: "NARRATOR",
      name: "Narrator",
      can_upload_raw: true,
      actionAccess: { "recording.raw.upload": "DENY" },
    } as any;
    expect(hasPermission(narrator, "can_upload_raw")).toBe(false);
    expect(normalizeUserPermissions(narrator).can_upload_raw).toBe(false);
  });
  it("should return UNAUTHENTICATED if user is null", () => {
    const res = evaluatePermission({
      authenticatedUser: null,
      canonicalRole: "MEMBER",
      platformDecision: "INHERIT",
      actionAccessOverrides: {},
      requestedPermission: "recording.access",
    });
    expect(res.allowed).toBe(false);
    expect(res.reasonCode).toBe("UNAUTHENTICATED");
  });

  it("should deny if platform decision is DENY", () => {
    const res = evaluatePermission({
      authenticatedUser: { id: "1" } as any,
      canonicalRole: "NARRATOR",
      platformDecision: "DENY",
      actionAccessOverrides: {},
      requestedPermission: "recording.access",
    });
    expect(res.allowed).toBe(false);
    expect(res.reasonCode).toBe("PLATFORM_DENIED");
  });

  it("should deny if explicitly overridden to DENY despite role", () => {
    const res = evaluatePermission({
      authenticatedUser: { id: "1" } as any,
      canonicalRole: "NARRATOR",
      platformDecision: "INHERIT",
      actionAccessOverrides: { "recording.audio.record": "DENY" },
      requestedPermission: "recording.audio.record",
    });
    expect(res.allowed).toBe(false);
    expect(res.reasonCode).toBe("EXPLICIT_DENY");
  });

  it("should allow if explicitly overridden to ALLOW despite role", () => {
    const res = evaluatePermission({
      authenticatedUser: { id: "1" } as any,
      canonicalRole: "MEMBER",
      platformDecision: "INHERIT",
      actionAccessOverrides: { "recording.qa_queue.access": "ALLOW" },
      requestedPermission: "recording.qa_queue.access",
    });
    expect(res.allowed).toBe(true);
    expect(res.reasonCode).toBe("EXPLICIT_ALLOW");
  });

  it("should allow based on default role matrix", () => {
    const res = evaluatePermission({
      authenticatedUser: { id: "1" } as any,
      canonicalRole: "AUDIO_ENGINEER",
      platformDecision: "INHERIT",
      actionAccessOverrides: {},
      requestedPermission: "recording.engineering_queue.access",
    });
    expect(res.allowed).toBe(true);
    expect(res.reasonCode).toBe("ROLE_ALLOW");
  });
});
