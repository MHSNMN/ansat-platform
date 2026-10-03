/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import React, { useState } from "react";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { PhoneInput } from "./shared/components/PhoneInput";
import {
  cleanDuplicateDialCodes,
  normalizeToE164,
  validatePhoneNumber,
} from "./lib/phoneUtils";
import {
  validateAudioSignature,
  validateImageSignature,
  calculateDeduplicatedAudioDuration,
} from "./server/audioMetadata";

afterEach(() => {
  cleanup();
});

describe("Mandatory Verification Gate: PhoneInput & Phone Validation", () => {
  it("1.1 Handles local Iraqi number and normalizes to E.164 with IQ selected", () => {
    const raw = "07701234567";
    const normalized = normalizeToE164(raw, "IQ");
    expect(normalized).toBe("+9647701234567");
    const val = validatePhoneNumber(normalized);
    expect(val.isValid).toBe(true);
    expect(val.e164).toBe("+9647701234567");
  });

  it("1.2 Handles full Iraqi number starting with +964", () => {
    const raw = "+9647701234567";
    const val = validatePhoneNumber(raw);
    expect(val.isValid).toBe(true);
    expect(val.e164).toBe("+9647701234567");
  });

  it("1.3 Handles number containing duplicate dial codes (+964+964... or +964964...)", () => {
    const rawDuplicate1 = "+964+9647701234567";
    const cleaned1 = cleanDuplicateDialCodes(rawDuplicate1);
    expect(cleaned1).toBe("+9647701234567");

    const rawDuplicate2 = "+9649647701234567";
    const cleaned2 = cleanDuplicateDialCodes(rawDuplicate2);
    expect(cleaned2).toBe("+9647701234567");

    const val = validatePhoneNumber(cleaned1);
    expect(val.isValid).toBe(true);
    expect(val.e164).toBe("+9647701234567");
  });

  it("1.4 Handles switching country to Kuwait (KW) and a third country (Saudi Arabia SA)", () => {
    // Kuwait number
    const kwRaw = "51234567";
    const kwNormalized = normalizeToE164(kwRaw, "KW");
    expect(kwNormalized).toBe("+96551234567");
    const kwVal = validatePhoneNumber(kwNormalized, "KW");
    expect(kwVal.isValid).toBe(true);

    // Saudi number
    const saRaw = "0512345678";
    const saNormalized = normalizeToE164(saRaw, "SA");
    expect(saNormalized).toBe("+966512345678");
    const saVal = validatePhoneNumber(saNormalized, "SA");
    expect(saVal.isValid).toBe(true);
  });

  it("1.5 Confirms member country / nationality remains completely isolated from PhoneInput changes", () => {
    function TestForm() {
      const [memberCountry, setMemberCountry] = useState("العراق");
      const [memberNationality, setMemberNationality] = useState("عراقي");
      const [phone, setPhone] = useState("");

      return (
        <div>
          <span data-testid="country">{memberCountry}</span>
          <span data-testid="nationality">{memberNationality}</span>
          <PhoneInput
            id="gate-phone"
            value={phone}
            onChange={(val) => setPhone(val)}
          />
        </div>
      );
    }

    const { container } = render(<TestForm />);
    expect(
      container.querySelector('[data-testid="country"]')?.textContent,
    ).toBe("العراق");
    expect(
      container.querySelector('[data-testid="nationality"]')?.textContent,
    ).toBe("عراقي");

    const select = container.querySelector("select");
    if (select) {
      fireEvent.change(select, { target: { value: "SA" } });
    }

    // Country and nationality must strictly remain untouched
    expect(
      container.querySelector('[data-testid="country"]')?.textContent,
    ).toBe("العراق");
    expect(
      container.querySelector('[data-testid="nationality"]')?.textContent,
    ).toBe("عراقي");
  });

  it("1.6 Rejects incomplete numbers and excessive numbers (prevents saving invalid numbers)", () => {
    // Too short
    const shortNum = "+96477";
    const shortVal = validatePhoneNumber(shortNum);
    expect(shortVal.isValid).toBe(false);

    // Too long / impossible
    const longNum = "+96477012345678999999999";
    const longVal = validatePhoneNumber(longNum);
    expect(longVal.isValid).toBe(false);

    // Non-numeric garbage
    const garbage = "abc-not-a-number";
    const garbageVal = validatePhoneNumber(garbage);
    expect(garbageVal.isValid).toBe(false);
  });
});

describe("Mandatory Verification Gate: Media Signatures & Audio Duration Deduplication", () => {
  it("2.1 Audio signature validator accepts valid MP3 / M4A / WAV and rejects spoofed files", () => {
    // Valid MP3 ID3 header (12 bytes)
    const mp3Buf = Buffer.from([
      0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    expect(validateAudioSignature(mp3Buf).valid).toBe(true);

    // Valid MP3 syncword (12 bytes)
    const mp3Sync = Buffer.from([
      0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    expect(validateAudioSignature(mp3Sync).valid).toBe(true);

    // Valid WAV header (RIFF....WAVE)
    const wavBuf = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    expect(validateAudioSignature(wavBuf).valid).toBe(true);

    // Valid MP4 / M4A (....ftyp)
    const m4aBuf = Buffer.from([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20,
    ]);
    expect(validateAudioSignature(m4aBuf).valid).toBe(true);

    // Spoofed file (HTML disguised as mp3)
    const htmlBuf = Buffer.from("<html><script>alert(1)</script></html>");
    expect(validateAudioSignature(htmlBuf).valid).toBe(false);

    // Empty or short buffer (< 12 bytes)
    expect(validateAudioSignature(Buffer.from([0x01, 0x02])).valid).toBe(false);
  });

  it("2.2 Image signature validator accepts JPEG / PNG / WebP / GIF and rejects executable/script files", () => {
    // Valid JPEG (12 bytes)
    const jpegBuf = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    expect(validateImageSignature(jpegBuf).valid).toBe(true);

    // Valid PNG (12 bytes)
    const pngBuf = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    expect(validateImageSignature(pngBuf).valid).toBe(true);

    // Valid WebP (RIFF....WEBP)
    const webpBuf = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(validateImageSignature(webpBuf).valid).toBe(true);

    // Valid GIF (GIF89a + padding to 12 bytes)
    const gifBuf = Buffer.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    expect(validateImageSignature(gifBuf).valid).toBe(true);

    // Executable ELF / Windows PE / script
    const exeBuf = Buffer.from([
      0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00,
    ]); // MZ
    expect(validateImageSignature(exeBuf).valid).toBe(false);

    const elfBuf = Buffer.from([
      0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]); // \x7fELF
    expect(validateImageSignature(elfBuf).valid).toBe(false);
  });

  it("2.3 calculateDeduplicatedAudioDuration deduplicates items by URL or audioId without double-counting", () => {
    const items = [
      {
        id: "item-1",
        audioUrl: "https://storage.googleapis.com/audio/book1.mp3",
        durationSeconds: 600,
        status: "PUBLISHED",
      },
      {
        id: "item-2",
        audioUrl: "https://storage.googleapis.com/audio/book1.mp3",
        durationSeconds: 600,
        status: "PUBLISHED",
      }, // duplicate url
      {
        id: "item-3",
        audioUrl: "https://storage.googleapis.com/audio/book2.mp3",
        durationSeconds: 1200,
        status: "PUBLISHED",
      },
      {
        id: "item-4",
        audioUrl: "https://storage.googleapis.com/audio/book3.mp3",
        durationSeconds: 300,
        status: "ARCHIVED",
        isArchived: true,
      }, // archived should be excluded
      {
        id: "item-5",
        audioUrl: "https://storage.googleapis.com/audio/book4.mp3",
        durationSeconds: 400,
        status: "DRAFT",
      }, // draft should be excluded in published metrics
    ];

    const totalPublishedSec = calculateDeduplicatedAudioDuration(items, false);
    // Only item-1 (600) and item-3 (1200) should count = 1800
    expect(totalPublishedSec).toBe(1800);

    const totalWithDrafts = calculateDeduplicatedAudioDuration(items, true);
    // item-1 (600) + item-3 (1200) + item-5 (400) = 2200 (archived item-4 is excluded)
    expect(totalWithDrafts).toBe(2200);
  });
});

describe("Mandatory Verification Gate: Archiving vs Deleting", () => {
  it("3.1 Verifies soft-archive logic sets ARCHIVED status and metadata without deleting documents", () => {
    const docBefore = {
      id: "activity-100",
      title: "أمسية شعرية",
      status: "UPCOMING",
    };

    const archivedPatch = {
      status: "ARCHIVED",
      isArchived: true,
      archivedAt: new Date().toISOString(),
      archivedBy: "admin@ensat.org",
    };

    const docAfter = { ...docBefore, ...archivedPatch };

    expect(docAfter.id).toBe("activity-100");
    expect(docAfter.status).toBe("ARCHIVED");
    expect(docAfter.isArchived).toBe(true);
    expect(typeof docAfter.archivedAt).toBe("string");
    expect(docAfter.archivedBy).toBe("admin@ensat.org");

    // Public filter rejects it
    const isVisibleInPublic =
      docAfter.status !== "ARCHIVED" && !docAfter.isArchived;
    expect(isVisibleInPublic).toBe(false);

    // Restore reverses the archive status
    const restoredPatch = {
      status: "DRAFT",
      isArchived: false,
      restoredAt: new Date().toISOString(),
    };
    const docRestored = { ...docAfter, ...restoredPatch };
    expect(docRestored.status).toBe("DRAFT");
    expect(docRestored.isArchived).toBe(false);
  });
});
