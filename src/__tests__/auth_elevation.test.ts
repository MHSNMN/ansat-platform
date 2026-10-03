import { describe, it, expect } from "vitest";
import { sanitizeUserFromStorage, normalizeRole } from "../lib/rbacPolicy";
import { normalizeUserPermissions, hasPermission } from "../lib/permissions";
import { User } from "../types";

describe("Role Escalation Prevention", () => {
  const trustedRegistry: User[] = [
    {
      id: "uid_narrator_123",
      name: "أحمد القارئ",
      email: "narrator@ansat.org",
      role: "NARRATOR",
      role_display_ar: "راوي / عضو",
      is_super_admin: false,
      can_access_studio: true,
      can_upload_raw: true,
      can_qa_review: false,
      can_master_audio: false,
    } as User,
  ];

  it("rejects untrusted role modification injected from localStorage", () => {
    // Malicious payload pretending to be SUPER_ADMIN in localStorage
    const tamperedPayload = {
      id: "uid_narrator_123",
      name: "أحمد القارئ",
      role: "SUPER_ADMIN" as any,
      is_super_admin: true,
      can_manage_members: true,
    };

    // Sanitize against trusted database record
    const sanitized = sanitizeUserFromStorage(tamperedPayload, trustedRegistry);

    expect(sanitized).not.toBeNull();
    expect(sanitized?.role).toBe("NARRATOR");
    expect(sanitized?.is_super_admin).toBe(false);
    expect(sanitized?.can_manage_members).toBe(false);
  });

  it("defaults unknown or malicious role strings to least-privilege member", () => {
    expect(normalizeRole("HACKER_SUPER_ADMIN")).toBe("member");
    expect(normalizeRole("SYSTEM_OVERRIDE")).toBe("member");
    expect(normalizeRole(null)).toBe("member");
    expect(normalizeRole(undefined)).toBe("member");
  });

  it("prevents narrator from gaining admin permissions via permissions guard", () => {
    const narrator = {
      id: "uid_1",
      name: "القارئ",
      email: "reader@ansat.org",
      role: "NARRATOR",
      role_display_ar: "راوي",
      is_super_admin: false,
      can_access_studio: true,
      can_upload_raw: true,
      can_qa_review: false,
      can_master_audio: false,
    } as User;

    const normalized = normalizeUserPermissions(narrator);

    expect(hasPermission(normalized, "can_manage_members")).toBe(false);
    expect(hasPermission(normalized, "can_access_control_panel")).toBe(false);
    expect(hasPermission(normalized, "can_edit_public_content")).toBe(false);
  });
});
