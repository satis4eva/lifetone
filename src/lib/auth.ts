import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { getBrand, isPlatformHost } from "./brand";
import { sessionUserId } from "./session";

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/**
 * Signed-in user for this site. On the platform console only the platform admin counts;
 * on a brand site only that brand's own users count (the platform admin is never signed in there).
 */
export async function currentUser() {
  const uid = sessionUserId();
  if (!uid) return null;
  const user = await db.user.findUnique({ where: { id: uid } });
  if (!user) return null;
  if (isPlatformHost()) return user.role === "PLATFORM_ADMIN" ? user : null;
  const brand = await getBrand();
  return user.role !== "PLATFORM_ADMIN" && user.brandId === brand.id ? user : null;
}

export async function requireBrandAdmin() {
  const user = await currentUser();
  if (!user || user.role !== "BRAND_ADMIN") redirect("/signin?next=/portal");
  return user;
}

/** Only on the platform host: paths there are rewritten, so "/signin" is the console's sign-in. */
export async function requirePlatformAdmin() {
  const user = isPlatformHost() ? await currentUser() : null;
  if (!user || user.role !== "PLATFORM_ADMIN") redirect("/signin");
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
