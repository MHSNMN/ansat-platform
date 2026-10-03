import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterAll,
} from "vitest";
import http from "http";
import express from "express";
import bcrypt from "bcryptjs";
import { authRouter } from "./authRoutes";
import * as firebaseAdmin from "./firebaseAdmin";
import { safeFetchWithRedirects } from "./audioMetadata";

// Setup test Express app
const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

async function postJson(path: string, body: any) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data };
}

describe("Security Audit: Authentication & Phone Login Guardrails", () => {
  let mockFirestore: any;
  let mockAuth: any;
  let usersStore: Map<string, any>;

  beforeEach(() => {
    usersStore = new Map();

    mockFirestore = {
      collection: vi.fn((colName: string) => {
        return {
          doc: vi.fn((docId: string) => ({
            get: vi.fn(async () => {
              const data = usersStore.get(docId);
              return {
                exists: !!data,
                id: docId,
                data: () => data,
              };
            }),
            set: vi.fn(async (val: any, opts: any) => {
              const prev = usersStore.get(docId) || {};
              usersStore.set(docId, opts?.merge ? { ...prev, ...val } : val);
            }),
          })),
          where: vi.fn((field: string, op: string, val: string) => {
            const matches: any[] = [];
            for (const [id, data] of usersStore.entries()) {
              if (data[field] === val) {
                matches.push({
                  id,
                  data: () => data,
                });
              }
            }
            return {
              limit: vi.fn(() => ({
                get: vi.fn(async () => ({
                  empty: matches.length === 0,
                  docs: matches,
                })),
              })),
            };
          }),
          limit: vi.fn(() => ({
            get: vi.fn(async () => ({
              empty: usersStore.size === 0,
              docs: Array.from(usersStore.entries()).map(([id, data]) => ({
                id,
                data: () => data,
              })),
            })),
          })),
          add: vi.fn(async (data: any) => {
            const id = `audit_${Date.now()}`;
            usersStore.set(id, data);
            return { id };
          }),
        };
      }),
    };

    mockAuth = {
      createCustomToken: vi.fn(async (uid: string, claims: any) => {
        return `mock_token_for_${uid}_claims_${JSON.stringify(claims)}`;
      }),
      verifyIdToken: vi.fn(async (token: string, checkRevoked = true) => {
        if (token === "valid_phone_auth_id_token") {
          return {
            uid: "member-phone-auth-1",
            phone_number: "+9647701234567",
            sub: "member-phone-auth-1",
          };
        }
        throw new Error("INVALID_TOKEN");
      }),
    };

    vi.spyOn(firebaseAdmin, "getFirebaseAdminFirestore").mockReturnValue(
      mockFirestore as any,
    );
    vi.spyOn(firebaseAdmin, "getFirebaseAdminAuth").mockReturnValue(
      mockAuth as any,
    );
  });

  it("1. REJECTS login request with member phone number only (WITHOUT password/OTP/PIN) with 401 and issues NO token", async () => {
    // Seed valid member in database
    usersStore.set("member-1", {
      uid: "member-1",
      phone: "+9647701234567",
      phoneNormalized: "+9647701234567",
      name: "أحمد العراقي",
      role: "MEMBER",
      passwordHash: await bcrypt.hash("Secret123!", 10),
    });

    const res = await postJson("/api/auth/login", {
      identifier: "+9647701234567",
      // Notice: NO password provided!
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.customToken).toBeUndefined();
    expect(res.body.token).toBeUndefined();
    expect(mockAuth.createCustomToken).not.toHaveBeenCalled();
  });

  it("2. REJECTS login request with member username only with 401 without issuing a token", async () => {
    usersStore.set("member-2", {
      uid: "member-2",
      username: "ahmed_ensat",
      usernameNormalized: "ahmed_ensat",
      role: "MEMBER",
      passwordHash: await bcrypt.hash("Secret123!", 10),
    });

    const res = await postJson("/api/auth/login", {
      identifier: "ahmed_ensat",
    });

    expect(res.status).toBe(401);
    expect(res.body.customToken).toBeUndefined();
    expect(mockAuth.createCustomToken).not.toHaveBeenCalled();
  });

  it("3. REJECTS login request with wrong password and prevents Account Enumeration via timing mitigation", async () => {
    const bcryptSpy = vi.spyOn(bcrypt, "compare");

    // Case A: User does NOT exist in DB
    const resUnknown = await postJson("/api/auth/login", {
      identifier: "+9647709999999",
      password: "WrongPassword!",
    });

    expect(resUnknown.status).toBe(401);
    expect(resUnknown.body.customToken).toBeUndefined();
    // Timing defense: dummy bcrypt compare must be invoked to avoid response time discrepancy
    expect(bcryptSpy).toHaveBeenCalled();
  });

  it("4. BLOCKS unmigrated legacy members using PIN from bypassing migration: returns 403 PIN_MIGRATION_REQUIRED without issuing token", async () => {
    const pinHash = await bcrypt.hash("1234", 10);
    usersStore.set("legacy-member-1", {
      uid: "legacy-member-1",
      phone: "+9647701111111",
      phoneNormalized: "+9647701111111",
      pinHash,
      // No passwordHash yet
      pinUsed: false,
      role: "MEMBER",
    });

    const res = await postJson("/api/auth/login", {
      identifier: "+9647701111111",
      password: "1234", // Legacy PIN attempted as password
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("PIN_MIGRATION_REQUIRED");
    expect(res.body.customToken).toBeUndefined();
    expect(mockAuth.createCustomToken).not.toHaveBeenCalled();
  });

  it("5. BLOCKS members with already migrated PIN (pinUsed: true) from using PIN: returns 401 without token", async () => {
    usersStore.set("migrated-member-1", {
      uid: "migrated-member-1",
      phone: "+9647702222222",
      phoneNormalized: "+9647702222222",
      passwordHash: await bcrypt.hash("StrongNewPass123!", 10),
      pinUsed: true, // PIN was permanently retired
      role: "MEMBER",
    });

    const res = await postJson("/api/auth/login", {
      identifier: "+9647702222222",
      password: "1234", // Old retired PIN
    });

    expect(res.status).toBe(401);
    expect(res.body.customToken).toBeUndefined();
    expect(mockAuth.createCustomToken).not.toHaveBeenCalled();
  }, 15_000);

  it("6. BLOCKS suspended or disabled accounts: returns 403 without issuing a Custom Token", async () => {
    usersStore.set("banned-user-1", {
      uid: "banned-user-1",
      phone: "+9647703333333",
      phoneNormalized: "+9647703333333",
      passwordHash: await bcrypt.hash("ValidPass123!", 10),
      status: "disabled",
      role: "MEMBER",
    });

    const res = await postJson("/api/auth/login", {
      identifier: "+9647703333333",
      password: "ValidPass123!",
    });

    expect(res.status).toBe(403);
    expect(res.body.customToken).toBeUndefined();
    expect(mockAuth.createCustomToken).not.toHaveBeenCalled();
  });

  it("7. SUCCEEDS with valid phone + valid password and sets MINIMAL custom claims with token_version", async () => {
    const passwordHash = await bcrypt.hash("CorrectPassword123!", 10);
    usersStore.set("member-valid-1", {
      uid: "member-valid-1",
      phone: "+9647704444444",
      phoneNormalized: "+9647704444444",
      passwordHash,
      status: "active",
      role: "MEMBER",
      tokenVersion: 2,
    });

    const res = await postJson("/api/auth/login", {
      identifier: "+9647704444444",
      password: "CorrectPassword123!",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.customToken).toBeDefined();

    // Verify minimal claims: only role and token_version
    expect(mockAuth.createCustomToken).toHaveBeenCalledWith("member-valid-1", {
      role: "MEMBER",
      token_version: 2,
    });
  });

  it("8. Firebase Phone Auth endpoint: validates real Firebase ID token and rejects forged/missing tokens", async () => {
    usersStore.set("member-phone-auth-1", {
      uid: "member-phone-auth-1",
      phone: "+9647701234567",
      phoneNormalized: "+9647701234567",
      status: "active",
      role: "MEMBER",
    });

    // Sub-case A: Missing token
    const resNoToken = await postJson("/api/auth/verify-phone-auth", {});
    expect(resNoToken.status).toBe(401);

    // Sub-case B: Fake / Invalid token
    const resFake = await postJson("/api/auth/verify-phone-auth", {
      idToken: "forged_invalid_token",
    });
    expect(resFake.status).toBe(401);

    // Sub-case C: Genuine Firebase verified ID token
    const resValid = await postJson("/api/auth/verify-phone-auth", {
      idToken: "valid_phone_auth_id_token",
    });
    expect(resValid.status).toBe(200);
    expect(resValid.body.success).toBe(true);
    expect(resValid.body.uid).toBe("member-phone-auth-1");
  });
});

describe("Audio Duration & Publishing Security Verification Gate", () => {
  it("safeFetchWithRedirects blocks redirects to non-whitelisted domains (SSRF protection)", async () => {
    // Attempt redirect to AWS metadata service or localhost
    await expect(
      safeFetchWithRedirects("http://169.254.169.254/latest/meta-data"),
    ).rejects.toThrow(/SSRF_BLOCKED/);

    await expect(
      safeFetchWithRedirects("https://127.0.0.1/admin/audio.mp3"),
    ).rejects.toThrow(/SSRF_BLOCKED/);
  });

  it("calculateDeduplicatedAudioDuration strictly ignores duration=0 and items marked needsProcessing=true", async () => {
    const { calculateDeduplicatedAudioDuration } =
      await import("./audioMetadata");

    const testItems = [
      // Valid published item with genuine duration
      {
        id: "lib-valid-1",
        audioUrl: "https://storage.googleapis.com/audio/book1.mp3",
        durationSeconds: 3600,
        status: "PUBLISHED",
      },
      // Invalid: duration is 0 -> MUST be ignored
      {
        id: "lib-zero-1",
        audioUrl: "https://storage.googleapis.com/audio/book2.mp3",
        durationSeconds: 0,
        status: "PUBLISHED",
      },
      // Invalid: negative or NaN -> MUST be ignored
      {
        id: "lib-neg-1",
        audioUrl: "https://storage.googleapis.com/audio/book3.mp3",
        durationSeconds: -100,
        status: "PUBLISHED",
      },
      // Invalid: needsProcessing is true -> MUST be excluded until verified
      {
        id: "lib-needs-proc-1",
        audioUrl: "https://storage.googleapis.com/audio/book4.mp3",
        durationSeconds: 1800,
        needsProcessing: true,
        status: "PUBLISHED",
      },
      // Duplicate audio url of lib-valid-1 -> MUST be deduplicated
      {
        id: "lib-valid-2",
        audioUrl: "https://storage.googleapis.com/audio/book1.mp3",
        durationSeconds: 3600,
        status: "PUBLISHED",
      },
      // Another valid item
      {
        id: "lib-valid-3",
        audioUrl: "https://storage.googleapis.com/audio/book5.mp3",
        durationSeconds: 1800,
        status: "PUBLISHED",
      },
    ];

    const totalSeconds = calculateDeduplicatedAudioDuration(testItems, false);
    // Only lib-valid-1 (3600) + lib-valid-3 (1800) should be included = 5400
    expect(totalSeconds).toBe(5400);
  });
});
