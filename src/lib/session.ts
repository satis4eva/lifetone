import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless signed cookie: base64url(JSON payload) + "." + HMAC-SHA256 signature.
const COOKIE = "lt_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

interface Payload { uid: string; exp: number }

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  return s;
}
const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

export function setSession(userId: string) {
  const payload: Payload = { uid: userId, exp: Math.floor(Date.now() / 1000) + MAX_AGE };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  cookies().set(COOKIE, `${data}.${sign(data)}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE,
  });
}

export function clearSession() {
  cookies().delete(COOKIE);
}

export function sessionUserId(): string | null {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  const [data, sig] = raw.split(".");
  if (!data || !sig) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString()) as Payload;
    return p.exp > Date.now() / 1000 ? p.uid : null;
  } catch {
    return null;
  }
}
