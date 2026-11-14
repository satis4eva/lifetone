import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { getBrand } from "./brand";
import { sessionUserId } from "./session";

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** Signed-in user, only if they belong to this brand (or are the platform admin). */
export async function currentUser() {
  const uid = sessionUserId();
  if (!uid) return null;
  const [user, brand] = await Promise.all([db.user.findUnique({ where: { id: uid } }), getBrand()]);
  if (!user) return null;
  if (user.role !== "PLATFORM_ADMIN" && user.brandId !== brand.id) return null;
  return user;
}

export async function requireBrandAdmin() {
  const user = await currentUser();
  if (!user || (user.role !== "BRAND_ADMIN" && user.role !== "PLATFORM_ADMIN")) redirect("/signin?next=/portal");
  return user;
}

export async function requirePlatformAdmin() {
  const user = await currentUser();
  if (!user || user.role !== "PLATFORM_ADMIN") redirect("/signin?next=/admin");
  return user;
}

/** Creates a one-time sign-in token and returns the raw token for the email link. */
export async function createLoginToken(userId: string, next: string, ttlMinutes = 30) {
  const token = randomBytes(32).toString("base64url");
  await db.loginToken.create({
    data: { tokenHash: hashToken(token), userId, next: safeNext(next), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) },
  });
  return token;
}

/** Only allow redirects to paths on this site. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || /[\\\x00-\x1f]/.test(next)) return "/bookings";
  try {
    const u = new URL(next, "http://x");
    return u.origin === "http://x" ? u.pathname + u.search : "/bookings";
  } catch {
    return "/bookings";
  }
}
