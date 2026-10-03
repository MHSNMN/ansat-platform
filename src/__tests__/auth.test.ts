import { describe, it, expect } from "vitest";
import { decodeAndValidateTokenStrict } from "../server/authMiddleware";

describe("Auth Middleware Strict Mode", () => {
  it("rejects the legacy mock-token format even when it claims to be an admin", async () => {
    const decoded = await decodeAndValidateTokenStrict(
      "mock_token:SUPER_ADMIN:user_123",
    );
    expect(decoded).toBeNull();
  });

  it("rejects an empty token before it reaches Firebase Admin", async () => {
    const decoded = await decodeAndValidateTokenStrict("");
    expect(decoded).toBeNull();
  });
});
