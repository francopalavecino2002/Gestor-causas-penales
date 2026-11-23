import { createHmac } from "node:crypto";

/**
 * RFC 6238 one-time codes, as the backend checks them (`Totp.java`): HMAC-SHA1, 6 digits,
 * 30-second steps. The backend accepts one step of drift each way and never the same step twice
 * for a user (anti-replay), so tests pick the step explicitly.
 */
export const STEP_SECONDS = 30;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32, case and spaces ignored, padding optional. */
export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=]/g, "").toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value < 0) throw new Error(`Not a base32 character: ${char}`);
    buffer = ((buffer << 5) | value) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** The step that contains `time` (milliseconds since the epoch). */
export function stepAt(time: number = Date.now()): number {
  return Math.floor(time / 1000 / STEP_SECONDS);
}

/** The 6-digit code of one step (RFC 4226 dynamic truncation). */
export function codeAt(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hash = createHmac("sha1", secret).update(counter).digest();
  const offset = hash.readUInt8(hash.length - 1) & 0x0f;
  const binary = hash.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 1_000_000).padStart(6, "0");
}

/**
 * A code the backend will accept after `lastStep` was used: the first step newer than it and not
 * older than the server's drift window. If that step is still more than one step ahead of now,
 * waits until it is within the window.
 */
export async function nextCode(
  secret: Buffer,
  lastStep: number,
): Promise<{ code: string; step: number }> {
  const step = Math.max(lastStep + 1, stepAt());
  const acceptableFrom = (step - 1) * STEP_SECONDS * 1000;
  const wait = acceptableFrom - Date.now();
  // A little margin so the server's clock is surely in the window too.
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait + 1_000));
  return { code: codeAt(secret, step), step };
}
