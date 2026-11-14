import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const MIN_PASSWORD = 10;

/** Hash a password with scrypt and a random salt. Stored as "scrypt$<salt>$<hash>" (base64url). */
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, 32, PARAMS);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(pw: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [scheme, s, h] = stored.split("$");
  if (scheme !== "scrypt" || !s || !h) return false;
  const expected = Buffer.from(h, "base64url");
  const actual = await scrypt(pw, Buffer.from(s, "base64url"), expected.length, PARAMS);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function passwordProblem(pw: string, confirm: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (pw.length > 200) return "That password is too long.";
  if (pw !== confirm) return "The two passwords don't match.";
  return null;
}
