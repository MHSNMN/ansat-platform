import {
  canAccessPlatform,
  PLATFORM_ACCESS,
  getRecommendedPlatformAccess,
} from "./rbacPolicy";
import type { PlatformId, UserRole } from "../types";

export { canAccessPlatform, PLATFORM_ACCESS, getRecommendedPlatformAccess };

/**
 * Returns list of platforms accessible by a given role
 */
export function getAllowedPlatforms(
  role: UserRole | string | undefined | null,
): PlatformId[] {
  const platforms: PlatformId[] = ["recording", "tasks", "rewards"];
  return platforms.filter((p) =>
    canAccessPlatform({ canonicalRole: String(role) } as any, p),
  );
}
