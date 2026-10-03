import { describe, expect, it } from "vitest";
import {
  canAssignMemberRole,
  canManageMemberRole,
  isAssignableMemberRole,
} from "./adminRoutes";
import {
  activationEmailMatchesAccount,
  isFirebaseUserBoundToActivation,
} from "./publicRoutes";

describe("member role hierarchy", () => {
  const superAdmin = { canonicalRole: "SUPER_ADMIN" };
  const admin = { canonicalRole: "ADMIN" };
  const delegatedManager = { canonicalRole: "MEMBER" };

  it("rejects unknown roles and blocks assignments at or above caller authority", () => {
    expect(isAssignableMemberRole("OWNER")).toBe(false);
    expect(canAssignMemberRole(admin, "SUPER_ADMIN")).toBe(false);
    expect(canAssignMemberRole(admin, "ADMIN")).toBe(false);
    expect(canAssignMemberRole(delegatedManager, "CONTENT_MANAGER")).toBe(
      false,
    );
    expect(canAssignMemberRole(delegatedManager, "NARRATOR")).toBe(true);
    expect(canAssignMemberRole(superAdmin, "SUPER_ADMIN")).toBe(true);
  });

  it("blocks peer and higher-account management", () => {
    expect(canManageMemberRole(admin, "SUPER_ADMIN")).toBe(false);
    expect(canManageMemberRole(admin, "ADMIN")).toBe(false);
    expect(canManageMemberRole(admin, "MEMBERS_MANAGER")).toBe(true);
    expect(canManageMemberRole(delegatedManager, "OPERATIONS_MANAGER")).toBe(
      false,
    );
    expect(canManageMemberRole(delegatedManager, "MEMBER")).toBe(true);
  });
});

describe("PIN activation identity binding", () => {
  it("requires a stored account email to match submitted email", () => {
    expect(
      activationEmailMatchesAccount(
        "member@example.com",
        " MEMBER@example.com ",
      ),
    ).toBe(true);
    expect(
      activationEmailMatchesAccount("member@example.com", "victim@example.com"),
    ).toBe(false);
    expect(activationEmailMatchesAccount("member@example.com", "")).toBe(false);
    expect(activationEmailMatchesAccount("", "new@example.com")).toBe(true);
  });

  it("does not bind an unrelated Firebase user selected by email", () => {
    expect(
      isFirebaseUserBoundToActivation(
        "firebase-uid",
        "legacy-id",
        "firebase-uid",
      ),
    ).toBe(true);
    expect(
      isFirebaseUserBoundToActivation("legacy-id", "legacy-id", undefined),
    ).toBe(true);
    expect(
      isFirebaseUserBoundToActivation("victim-uid", "legacy-id", "member-uid"),
    ).toBe(false);
  });
});
