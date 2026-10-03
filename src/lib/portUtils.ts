/**
 * Safely resolves the server listening port from environment variables or inputs.
 * Fallback is 3000 if not provided or invalid.
 */
export function resolvePort(portEnv?: string | number | null): number {
  if (portEnv === undefined || portEnv === null || portEnv === "") {
    return 3000;
  }
  const parsed = Number(portEnv);
  if (
    isNaN(parsed) ||
    parsed <= 0 ||
    parsed > 65535 ||
    !Number.isInteger(parsed)
  ) {
    return 3000;
  }
  return parsed;
}
