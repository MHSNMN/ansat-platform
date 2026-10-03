import { describe, it, expect } from "vitest";
import {
  CANONICAL_ROLES,
  normalizeRole,
  isActionAllowed,
  ROLE_DISPLAY_NAMES_AR,
} from "../lib/rbacPolicy";
import { canAccessPlatform } from "../lib/platformAccess";

describe("RBAC 8-Canonical Roles & Platform Access", () => {
  it("defines exactly 8 canonical roles", () => {
    expect(CANONICAL_ROLES).toHaveLength(8);
    expect(CANONICAL_ROLES).toEqual([
      "super_admin",
      "admin",
      "audio_engineer",
      "reviewer",
      "narrator",
      "member",
      "pending",
      "suspended",
    ]);
  });

  it("normalizes roles correctly from uppercase or legacy names", () => {
    expect(normalizeRole("SUPER_ADMIN")).toBe("super_admin");
    expect(normalizeRole("ADMIN")).toBe("admin");
    expect(normalizeRole("HR")).toBe("admin");
    expect(normalizeRole("AUDIO_ENGINEER")).toBe("audio_engineer");
    expect(normalizeRole("QA_REVIEWER")).toBe("reviewer");
    expect(normalizeRole("NARRATOR")).toBe("narrator");
    expect(normalizeRole("MEMBER")).toBe("member");
    expect(normalizeRole("PENDING")).toBe("pending");
    expect(normalizeRole("SUSPENDED")).toBe("suspended");
    expect(normalizeRole("CONTENT_MANAGER")).toBe("CONTENT_MANAGER");
    expect(normalizeRole("MEMBERS_MANAGER")).toBe("MEMBERS_MANAGER");
    expect(normalizeRole("OPERATIONS_MANAGER")).toBe("OPERATIONS_MANAGER");
    expect(normalizeRole("REWARDS_MANAGER")).toBe("REWARDS_MANAGER");
    expect(normalizeRole("CERTIFICATE_MANAGER")).toBe("CERTIFICATE_MANAGER");
  });

  it("verifies platform access matrix strictly", () => {
    // Recording Studio
    expect(canAccessPlatform("SUPER_ADMIN", "recording")).toBe(true);
    expect(canAccessPlatform("ADMIN", "recording")).toBe(true);
    expect(canAccessPlatform("AUDIO_ENGINEER", "recording")).toBe(true);
    expect(canAccessPlatform("QA_REVIEWER", "recording")).toBe(true);
    expect(canAccessPlatform("NARRATOR", "recording")).toBe(true);
    expect(canAccessPlatform("MEMBER", "recording")).toBe(false);
    expect(canAccessPlatform("PENDING", "recording")).toBe(false);
    expect(canAccessPlatform("SUSPENDED", "recording")).toBe(false);

    // Tasks Platform
    expect(canAccessPlatform("SUPER_ADMIN", "tasks")).toBe(true);
    expect(canAccessPlatform("ADMIN", "tasks")).toBe(true);
    expect(canAccessPlatform("NARRATOR", "tasks")).toBe(true);
    expect(canAccessPlatform("MEMBER", "tasks")).toBe(true);
    expect(canAccessPlatform("PENDING", "tasks")).toBe(false);
    expect(canAccessPlatform("SUSPENDED", "tasks")).toBe(false);

    // Rewards Platform
    expect(canAccessPlatform("SUPER_ADMIN", "rewards")).toBe(true);
    expect(canAccessPlatform("ADMIN", "rewards")).toBe(true);
    expect(canAccessPlatform("MEMBER", "rewards")).toBe(true);
    expect(canAccessPlatform("PENDING", "rewards")).toBe(false);
    expect(canAccessPlatform("SUSPENDED", "rewards")).toBe(false);
  });

  it("enforces sensitive actions strictly", () => {
    expect(isActionAllowed("ADMIN", "manage_members")).toBe(true);
    expect(isActionAllowed("MEMBER", "manage_members")).toBe(false);
    expect(isActionAllowed("NARRATOR", "upload_raw")).toBe(true);
    expect(isActionAllowed("MEMBER", "upload_raw")).toBe(false);
    expect(isActionAllowed("AUDIO_ENGINEER", "upload_master")).toBe(true);
    expect(isActionAllowed("QA_REVIEWER", "review_recording")).toBe(true);
    expect(isActionAllowed("SUSPENDED", "access_tasks_platform")).toBe(false);
    expect(isActionAllowed("CONTENT_MANAGER", "manage_public_content")).toBe(
      true,
    );
    expect(isActionAllowed("MEMBERS_MANAGER", "manage_members")).toBe(true);
    expect(isActionAllowed("MEMBERS_MANAGER", "manage_public_content")).toBe(
      false,
    );
    expect(isActionAllowed("REWARDS_MANAGER", "grant_points")).toBe(true);
    expect(isActionAllowed("CERTIFICATE_MANAGER", "issue_certificates")).toBe(
      true,
    );
  });

  it("denies studio and Drive management to an ordinary member", () => {
    expect(canAccessPlatform("MEMBER", "recording")).toBe(false);
    expect(isActionAllowed("MEMBER", "manage_drive")).toBe(false);
    expect(isActionAllowed("NARRATOR", "manage_drive")).toBe(false);
  });

  it("requires an administrator role or an explicit grant for the administration platform", () => {
    expect(canAccessPlatform({ canonicalRole: "MEMBER" }, "admin")).toBe(false);
    expect(
      canAccessPlatform(
        { canonicalRole: "MEMBER", platformAccess: { admin: true } },
        "admin",
      ),
    ).toBe(true);
    expect(canAccessPlatform({ canonicalRole: "ADMIN" }, "admin")).toBe(true);
    expect(
      canAccessPlatform({ canonicalRole: "CONTENT_MANAGER" }, "admin"),
    ).toBe(true);
    expect(
      canAccessPlatform({ canonicalRole: "MEMBERS_MANAGER" }, "admin"),
    ).toBe(true);
    expect(canAccessPlatform({ canonicalRole: "MEMBER" }, "admin")).toBe(false);
    expect(
      canAccessPlatform(
        { canonicalRole: "SUPER_ADMIN", platformAccess: { admin: false } },
        "admin",
      ),
    ).toBe(false);
  });

  it("makes explicit denial override inherited administrative actions", () => {
    expect(
      isActionAllowed(
        {
          canonicalRole: "SUPER_ADMIN",
          actionAccess: { manage_members: "DENY" },
        },
        "manage_members",
      ),
    ).toBe(false);
    expect(
      isActionAllowed(
        { canonicalRole: "ADMIN", platformAccess: { recording: false } },
        "upload_raw",
      ),
    ).toBe(false);
  });

  it("has valid Arabic display names for all roles", () => {
    for (const role of CANONICAL_ROLES) {
      expect(ROLE_DISPLAY_NAMES_AR[role]).toBeDefined();
      expect(typeof ROLE_DISPLAY_NAMES_AR[role]).toBe("string");
      expect(ROLE_DISPLAY_NAMES_AR[role].length).toBeGreaterThan(0);
    }
  });
});
