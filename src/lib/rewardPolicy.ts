export const GEM_PACKAGES = {
  1: 5,
  3: 12,
  5: 18,
} as const;

export const MAX_GEMS_PER_WINDOW = 5;
export const GEM_WINDOW_MS = 24 * 60 * 60 * 1000;
export const REST_DAY_COST = 30;
export const REST_DAY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function gemPackageCost(quantity: number): number | null {
  return quantity in GEM_PACKAGES
    ? GEM_PACKAGES[quantity as keyof typeof GEM_PACKAGES]
    : null;
}

export function canGiftGems(
  senderUid: string,
  recipientUid: string,
  owned: number,
  quantity: number,
): boolean {
  return (
    senderUid !== recipientUid &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= 5 &&
    owned >= quantity
  );
}

export function isWindowActive(
  start: string | undefined,
  now = Date.now(),
  duration = GEM_WINDOW_MS,
): boolean {
  if (!start) return false;
  const timestamp = Date.parse(start);
  return Number.isFinite(timestamp) && now - timestamp < duration;
}

export function leaderboardPointsForGems(gems: number): number {
  return Math.max(0, Math.floor(Number(gems) || 0)) * 3;
}

export function totalRewardImpactPoints(points: number, gems: number): number {
  return points + gems * 3;
}
