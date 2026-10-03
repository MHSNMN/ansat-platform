import { describe, it, expect } from "vitest";
import {
  isAllowedAudioUrl,
  validateAudioSignature,
  extractAudioMetadataFromBuffer,
} from "./audioMetadata";

describe("audioMetadata SSRF & Signature Verification", () => {
  it("blocks SSRF attempts on internal, private, and arbitrary domains", () => {
    // SSRF AWS metadata
    expect(isAllowedAudioUrl("http://169.254.169.254/latest/meta-data")).toBe(
      false,
    );
    expect(isAllowedAudioUrl("https://169.254.169.254/latest/meta-data")).toBe(
      false,
    );

    // Localhost / loopback
    expect(isAllowedAudioUrl("http://localhost:3000/audio.mp3")).toBe(false);
    expect(isAllowedAudioUrl("https://127.0.0.1/audio.mp3")).toBe(false);
    expect(isAllowedAudioUrl("https://10.0.0.1/secret.wav")).toBe(false);
    expect(isAllowedAudioUrl("https://192.168.1.1/secret.wav")).toBe(false);

    // Arbitrary external domain
    expect(
      isAllowedAudioUrl("https://attacker-controlled-site.com/exploit.wav"),
    ).toBe(false);

    // Only allowed storage domains
    expect(
      isAllowedAudioUrl(
        "https://firebasestorage.googleapis.com/v0/b/app/o/sample.mp3",
      ),
    ).toBe(true);
    expect(
      isAllowedAudioUrl(
        "https://storage.googleapis.com/ensat-audio/sample.mp3",
      ),
    ).toBe(true);
  });

  it("detects audio file signatures and rejects spoofed files", () => {
    // Plain text / executable disguised as mp3
    const fakeMp3 = Buffer.from("THIS IS JUST TEXT CONTENT NOT AUDIO", "utf-8");
    expect(validateAudioSignature(fakeMp3).valid).toBe(false);

    // ID3v2 header
    const validId3 = Buffer.from([
      0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    expect(validateAudioSignature(validId3).valid).toBe(true);
    expect(validateAudioSignature(validId3).format).toBe("mp3");

    // RIFF WAVE header
    const validWav = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from("WAVE", "ascii"),
    ]);
    expect(validateAudioSignature(validWav).valid).toBe(true);
    expect(validateAudioSignature(validWav).format).toBe("wav");
  });

  it("marks unparseable audio as needsProcessing without guessing duration", async () => {
    // Fake buffer that doesn't have valid audio stream frames
    const fakeBuffer = Buffer.from("MALFORMED_BUFFER_DATA_THAT_IS_NOT_AUDIO");
    const result = await extractAudioMetadataFromBuffer(fakeBuffer);

    expect(result.durationSeconds).toBe(0);
    expect(result.needsProcessing).toBe(true);
    expect(result.error).toBeDefined();
  });
});
