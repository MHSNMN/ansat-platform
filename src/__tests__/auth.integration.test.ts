import { describe, it, expect } from "vitest";
import { canAccessPlatform } from "../lib/platformAccess";
import { normalizeUserPermissions } from "../lib/permissions";
import { sanitizeUserFromStorage } from "../lib/rbacPolicy";
import type { User } from "../types";

describe("Auth & Platform Guard Integration", () => {
  const baseUser = {
    id: "usr_member_01",
    name: "سالم العضو",
    email: "member@ansat.org",
    role: "MEMBER",
    role_display_ar: "عضو",
    is_super_admin: false,
    can_access_studio: false,
    can_upload_raw: false,
    can_qa_review: false,
    can_master_audio: false,
  } as User;

  it("permits MEMBER to access Recording studio platform without exception", () => {
    expect(canAccessPlatform(baseUser.role, "recording")).toBe(false);
  });

  it("permits MEMBER to access Tasks and Rewards platforms", () => {
    expect(canAccessPlatform(baseUser.role, "tasks")).toBe(true);
    expect(canAccessPlatform(baseUser.role, "rewards")).toBe(true);
  });

  it("prevents PENDING user from accessing any internal platform", () => {
    expect(canAccessPlatform("PENDING", "recording")).toBe(false);
    expect(canAccessPlatform("PENDING", "tasks")).toBe(false);
    expect(canAccessPlatform("PENDING", "rewards")).toBe(false);
  });

  it("prevents SUSPENDED user from accessing any internal platform", () => {
    expect(canAccessPlatform("SUSPENDED", "recording")).toBe(false);
    expect(canAccessPlatform("SUSPENDED", "tasks")).toBe(false);
    expect(canAccessPlatform("SUSPENDED", "rewards")).toBe(false);
  });

  it("sanitizes client storage tampering preventing unauthorized escalation", () => {
    const registry: User[] = [baseUser];
    const tamperedPayload = {
      id: "usr_member_01",
      name: "سالم العضو",
      role: "SUPER_ADMIN" as any,
      is_super_admin: true,
      can_access_studio: true,
    };

    const sanitized = sanitizeUserFromStorage(tamperedPayload, registry);
    expect(sanitized).not.toBeNull();
    expect(sanitized?.role).toBe("MEMBER");
    expect(sanitized?.is_super_admin).toBe(false);
    expect(sanitized?.can_access_studio).toBe(false);
  });

  it("correctly derives permission flags from normalized roles", () => {
    const narratorUser = normalizeUserPermissions({
      ...baseUser,
      role: "NARRATOR",
    });
    expect(narratorUser.can_access_studio).toBe(true);
    expect(narratorUser.can_upload_raw).toBe(true);
    expect(narratorUser.can_qa_review).toBe(false);

    const engineerUser = normalizeUserPermissions({
      ...baseUser,
      role: "AUDIO_ENGINEER",
    });
    expect(engineerUser.can_access_studio).toBe(true);
    expect(engineerUser.can_master_audio).toBe(true);
  });
});
