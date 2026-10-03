import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initializeFirebaseAdmin,
  getFirebaseAdminAuth,
} from "../firebaseAdmin";
import * as firebaseAdminApp from "firebase-admin/app";
import * as firebaseAdminAuth from "firebase-admin/auth";

// Mock the firebase-admin modules
vi.mock("firebase-admin/app", () => ({
  initializeApp: vi.fn(),
  cert: vi.fn(),
  getApps: vi.fn(() => []),
  applicationDefault: vi.fn(),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(),
}));

describe("firebaseAdmin", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalConsoleError: any;
  let originalConsoleWarn: any;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    console.error = vi.fn();
    console.warn = vi.fn();

    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  it("should return null and warn when environment variables are missing", () => {
    const app = initializeFirebaseAdmin();
    expect(app).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Warning: No service account credentials found"),
    );
  });

  it("should replace newlines in private key and call initializeApp when variables are present", () => {
    process.env.FIREBASE_PROJECT_ID = "test-project";
    process.env.FIREBASE_CLIENT_EMAIL = "test@example.com";
    process.env.FIREBASE_PRIVATE_KEY =
      '"MOCK_TEST_KEY_LINE1\\nMOCK_TEST_KEY_LINE2"';

    const mockApp = { name: "[DEFAULT]" };
    vi.mocked(firebaseAdminApp.initializeApp).mockReturnValueOnce(
      mockApp as any,
    );

    const app = initializeFirebaseAdmin();

    expect(app).toBe(mockApp);
    expect(firebaseAdminApp.cert).toHaveBeenCalledWith({
      projectId: "test-project",
      clientEmail: "test@example.com",
      privateKey: "MOCK_TEST_KEY_LINE1\nMOCK_TEST_KEY_LINE2",
    });
    expect(firebaseAdminApp.initializeApp).toHaveBeenCalledTimes(1);
  });

  it("should return null from getFirebaseAdminAuth if app fails to initialize", () => {
    const auth = getFirebaseAdminAuth();
    expect(auth).toBeNull();
    expect(firebaseAdminAuth.getAuth).not.toHaveBeenCalled();
  });

  it("should initialize app only once (returns existing app if already initialized)", () => {
    const mockApp = { name: "[DEFAULT]" };
    vi.mocked(firebaseAdminApp.getApps).mockReturnValueOnce([mockApp] as any);

    const app = initializeFirebaseAdmin();

    expect(app).toBe(mockApp);
    expect(firebaseAdminApp.initializeApp).not.toHaveBeenCalled();
  });
});
