import { headers } from "next/headers";
import { cache } from "react";
import { db } from "./db";

/** The host the request came in on, without port. */
export function requestHost(): string {
  const h = headers();
  return (h.get("x-forwarded-host") || h.get("host") || "").split(":")[0].toLowerCase();
}

/** The private platform console host (e.g. platform.dbsgroup.io). Never serves a brand. */
export const PLATFORM_HOST = () => (process.env.PLATFORM_HOST || "platform.dbsgroup.io").toLowerCase();
export const isPlatformHost = () => !!PLATFORM_HOST() && requestHost() === PLATFORM_HOST();

/**
 * Base URL for links in emails and payment redirects. Only ever one of the brand's own
 * domains (or APP_URL), never a host taken blindly from the request, so links can't be
 * pointed at another site by spoofing the Host header.
 */
export async function baseUrl(): Promise<string> {
  const host = requestHost();
  if (isPlatformHost()) return `https://${host}`;
  const brand = await getBrand();
  const local = host === "localhost" || host.endsWith(".localhost");
  if (local && process.env.NODE_ENV !== "production") {
    const port = (headers().get("host") || "").split(":")[1];
    return `http://${host}${port ? ":" + port : ""}`;
  }
  if (host && brand.domains.includes(host) && !local) return `https://${host}`;
  const firstReal = brand.domains.find(d => d !== "localhost" && !d.endsWith(".localhost"));
  if (firstReal) return `https://${firstReal}`;
  return process.env.APP_URL || "http://localhost:3000";
}

/**
 * Which brand this request is for. Matched by domain; "<slug>.localhost" works in development;
 * otherwise falls back to DEFAULT_BRAND (Lifetone).
 */
export const getBrand = cache(async () => {
  const host = requestHost();
  const byDomain = host ? await db.brand.findFirst({ where: { domains: { has: host } } }) : null;
  if (byDomain) return byDomain;
  if (host.endsWith(".localhost")) {
    const bySlug = await db.brand.findUnique({ where: { slug: host.split(".")[0] } });
    if (bySlug) return bySlug;
  }
  const fallback = await db.brand.findUnique({ where: { slug: process.env.DEFAULT_BRAND || "lifetone" } });
  if (!fallback) throw new Error("No brand found. Run `npm run db:seed` to create Lifetone.");
  return fallback;
});
