import crypto from "node:crypto";

export function idempotencyDigest(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.trim().length < 16 ||
    value.length > 200
  )
    return null;
  return crypto.createHash("sha256").update(value.trim(), "utf8").digest("hex");
}
