import { describe, it, expect } from "vitest";
import {
  normalizeToE164,
  validatePhoneNumber,
  splitPhoneNumber,
} from "./phoneUtils";

describe("phoneUtils", () => {
  it("normalizes local Kuwait numbers to E.164 with default KW", () => {
    expect(normalizeToE164("51234567", "KW")).toBe("+96551234567");
    expect(normalizeToE164("+965 5123 4567")).toBe("+96551234567");
  });

  it("handles Iraqi numbers: local, +964 prefixed, and duplicate +964 dial codes", () => {
    // 1. Local Iraqi number
    expect(normalizeToE164("07701234567", "IQ")).toBe("+9647701234567");
    expect(normalizeToE164("7701234567", "IQ")).toBe("+9647701234567");

    // 2. Full number starting with +964
    expect(normalizeToE164("+9647701234567")).toBe("+9647701234567");
    expect(normalizeToE164("+964 770 123 4567")).toBe("+9647701234567");

    // 3. Duplicate +964 (e.g. +964+964, +964964, 00964964)
    expect(normalizeToE164("+964+9647701234567")).toBe("+9647701234567");
    expect(normalizeToE164("+9649647701234567")).toBe("+9647701234567");
    expect(normalizeToE164("009649647701234567")).toBe("+9647701234567");

    const validIQ = validatePhoneNumber("+9649647701234567");
    expect(validIQ.isValid).toBe(true);
    expect(validIQ.e164).toBe("+9647701234567");
    expect(validIQ.country).toBe("IQ");
  });

  it("normalizes Saudi Arabia numbers correctly without forcing +965", () => {
    expect(normalizeToE164("0501234567", "SA")).toBe("+966501234567");
    expect(normalizeToE164("+966 50 123 4567")).toBe("+966501234567");
  });

  it("normalizes Egypt numbers correctly without forcing +965", () => {
    expect(normalizeToE164("01012345678", "EG")).toBe("+201012345678");
    expect(normalizeToE164("+20 10 1234 5678")).toBe("+201012345678");
  });

  it("handles Arabic-Indic digits conversion", () => {
    expect(normalizeToE164("٥١٢٣٤٥٦٧", "KW")).toBe("+96551234567");
  });

  it("validates correctly", () => {
    expect(validatePhoneNumber("+96551234567").isValid).toBe(true);
    expect(validatePhoneNumber("+966501234567").isValid).toBe(true);
    expect(validatePhoneNumber("123").isValid).toBe(false);
  });

  it("parses country code and dial code from E.164", () => {
    const detailsKW = splitPhoneNumber("+96551234567");
    expect(detailsKW.countryCode).toBe("KW");
    expect(detailsKW.dialCode).toBe("+965");
    expect(detailsKW.nationalNumber).toBe("51234567");

    const detailsSA = splitPhoneNumber("+966501234567");
    expect(detailsSA.countryCode).toBe("SA");
    expect(detailsSA.dialCode).toBe("+966");
    expect(detailsSA.nationalNumber).toBe("501234567");
  });
});
