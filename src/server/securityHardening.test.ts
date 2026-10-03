import { describe, it, expect } from "vitest";
import { isPrivateOrInternalIp, isAllowedAudioUrl } from "./audioMetadata";
import { validatePasswordStrength } from "./authRoutes";
import { isActionAllowed, ROLE_PERMISSIONS } from "../lib/rbacPolicy";

describe("Comprehensive Security & Guardrail Verification", () => {
  describe("1. Manual Duration Approval Policy & RBAC", () => {
    it("Enforces 'library.approve_manual_duration' permission across authorized roles", () => {
      expect(ROLE_PERMISSIONS.SUPER_ADMIN).toContain(
        "library.approve_manual_duration",
      );
      expect(ROLE_PERMISSIONS.ADMIN).toContain(
        "library.approve_manual_duration",
      );
      expect(ROLE_PERMISSIONS.AUDIO_ENGINEER).toContain(
        "library.approve_manual_duration",
      );

      // Disallowed roles
      expect(ROLE_PERMISSIONS.MEMBER).not.toContain(
        "library.approve_manual_duration",
      );
      expect(ROLE_PERMISSIONS.NARRATOR).not.toContain(
        "library.approve_manual_duration",
      );

      expect(
        isActionAllowed(
          { canonicalRole: "SUPER_ADMIN" },
          "library.approve_manual_duration",
        ),
      ).toBe(true);
      expect(
        isActionAllowed(
          { canonicalRole: "ADMIN" },
          "library.approve_manual_duration",
        ),
      ).toBe(true);
      expect(
        isActionAllowed(
          { canonicalRole: "AUDIO_ENGINEER" },
          "library.approve_manual_duration",
        ),
      ).toBe(true);
      expect(
        isActionAllowed(
          { canonicalRole: "MEMBER" },
          "library.approve_manual_duration",
        ),
      ).toBe(false);
      expect(
        isActionAllowed(
          { canonicalRole: "NARRATOR" },
          "library.approve_manual_duration",
        ),
      ).toBe(false);
    });
  });

  describe("2. SSRF Protection: IP Ranges & DNS Filtering", () => {
    it("Identifies and blocks loopback, link-local, and cloud metadata addresses", () => {
      // Loopback
      expect(isPrivateOrInternalIp("127.0.0.1")).toBe(true);
      expect(isPrivateOrInternalIp("127.0.1.1")).toBe(true);
      expect(isPrivateOrInternalIp("::1")).toBe(true);

      // Cloud Metadata & Link-local (AWS, GCP, Azure 169.254.169.254)
      expect(isPrivateOrInternalIp("169.254.169.254")).toBe(true);
      expect(isPrivateOrInternalIp("169.254.1.1")).toBe(true);

      // RFC 1918 Private ranges
      expect(isPrivateOrInternalIp("10.0.0.1")).toBe(true);
      expect(isPrivateOrInternalIp("10.255.255.255")).toBe(true);
      expect(isPrivateOrInternalIp("192.168.1.1")).toBe(true);
      expect(isPrivateOrInternalIp("192.168.0.100")).toBe(true);
      expect(isPrivateOrInternalIp("172.16.0.1")).toBe(true);
      expect(isPrivateOrInternalIp("172.31.255.255")).toBe(true);

      // Carrier-Grade NAT (RFC 6598)
      expect(isPrivateOrInternalIp("100.64.0.1")).toBe(true);

      // Public routable IPs should NOT be marked private
      expect(isPrivateOrInternalIp("8.8.8.8")).toBe(false);
      expect(isPrivateOrInternalIp("1.1.1.1")).toBe(false);
      expect(isPrivateOrInternalIp("142.250.190.46")).toBe(false);
    });

    it("Only permits whitelisted audio storage hosts with HTTPS", () => {
      expect(
        isAllowedAudioUrl(
          "https://firebasestorage.googleapis.com/v0/b/app/o/audio.mp3",
        ),
      ).toBe(true);
      expect(
        isAllowedAudioUrl(
          "https://storage.googleapis.com/audio-bucket/track.wav",
        ),
      ).toBe(true);

      // Blocks unwhitelisted domains
      expect(isAllowedAudioUrl("https://malicious-site.com/track.mp3")).toBe(
        false,
      );
      expect(
        isAllowedAudioUrl(
          "http://storage.googleapis.com/audio-bucket/track.wav",
        ),
      ).toBe(false); // HTTP rejected
      expect(isAllowedAudioUrl("https://localhost:8080/audio.mp3")).toBe(false);
      expect(
        isAllowedAudioUrl("https://169.254.169.254/computeMetadata/v1/"),
      ).toBe(false);
      expect(
        isAllowedAudioUrl("https://internal.service.local/audio.mp3"),
      ).toBe(false);
    });
  });

  describe("3. Password Strength Policy", () => {
    it("Enforces minimum 8 chars, letters, and numbers", () => {
      expect(validatePasswordStrength("").valid).toBe(false);
      expect(validatePasswordStrength("short1").valid).toBe(false);
      expect(validatePasswordStrength("alllettersonly").valid).toBe(false);
      expect(validatePasswordStrength("1234567890").valid).toBe(false);

      // Valid combinations
      expect(validatePasswordStrength("Passw0rd123!").valid).toBe(true);
      expect(validatePasswordStrength("كلمةسر1234").valid).toBe(true); // Arabic letters + numbers
      expect(validatePasswordStrength("CorrectHorseBattery9").valid).toBe(true);
    });
  });
});
