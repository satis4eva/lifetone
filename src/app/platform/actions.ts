"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { saveImage } from "@/lib/media";
import { HEX, PRESETS, isPreset, FONT_PAIRS } from "@/lib/theme";
import { COUNTRIES, isCountry } from "@/lib/country";
import { isBusinessType } from "@/lib/coach";
import { createLoginToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

/**
 * Emails a brand admin a sign-in link (valid 7 days) to their Client portal on the brand's own site.
 * Returns false when the brand has no web address yet.
 */
async function inviteAdmin(brandId: string, userId: string): Promise<boolean> {
  const brand = await db.brand.findUnique({ where: { id: brandId } });
  const user = await db.user.findFirst({ where: { id: userId, brandId, role: "BRAND_ADMIN" } });
  const site = brand?.domains.find(d => d !== "localhost" && !d.endsWith(".localhost"));
  if (!brand || !user || !site) return false;
  const next = user.passwordHash ? "/portal" : "/account/password?next=/portal";
  const token = await createLoginToken(user.id, next, 7 * 24 * 60);
  await sendEmail(brand, {
    to: user.email,
    subject: `${brand.name}: your Client portal is ready`,
    text: [
      `Hello,`,
      ``,
      `You've been made an admin of ${brand.name}. In the Client portal you manage bookings, quote requests, listings and photos, payouts, monthly reports and your site's settings.`,
      ``,
      `Open your portal (this link works once and expires in 7 days${user.passwordHash ? "" : "; you'll choose a password first"}):`,
      `https://${site}/auth/verify?token=${token}`,
      ``,
      `After that, sign in any time at https://${site}/signin with this email address.`,
    ].join("\n"),
  });
  return true;
}


const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const parseDomains = (s: string) => [...new Set(s.split(/[\s,]+/).map(d => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter(d => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)))];

export async function createBrand(form: FormData) {
  await requirePlatformAdmin();
  const name = str(form, "name"), slug = str(form, "slug").toLowerCase(), prefix = str(form, "prefix").toUpperCase();
  const admin = str(form, "adminEmail").toLowerCase();
  const preset = isPreset(str(form, "preset")) ? str(form, "preset") as keyof typeof PRESETS : "tropical";
  const back = (e: string) => redirect(`/brands/new?error=${encodeURIComponent(e)}`);
  if (!name) back("Enter the brand name.");
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) back("Short name: 2 to 30 lowercase letters, digits or hyphens.");
  if (!/^[A-Z]{2,4}$/.test(prefix)) back("Booking prefix: 2 to 4 capital letters, e.g. EG.");
  if (!EMAIL.test(admin)) back("Enter the brand admin's email.");
  if (await db.brand.findUnique({ where: { slug } })) back("That short name is taken.");
  const p = PRESETS[preset];
  const country = isCountry(str(form, "country")) ? str(form, "country") : "LK";
  const brand = await db.brand.create({
    data: { country, currency: COUNTRIES[country].currency, settleCurrency: COUNTRIES[country].currency, name, slug, bookingPrefix: prefix, domains: parseDomains(str(form, "domains")), tagline: str(form, "tagline"), themePreset: preset, color: p.color, ctaColor: p.ctaColor, bgColor: p.bgColor, fontPair: p.fontPair, platformFeePct: Number(str(form, "platformFeePct")) || 10 },
  });
  const user = await db.user.create({ data: { brandId: brand.id, email: admin, name: `${name} admin`, role: "BRAND_ADMIN" } });
  const invited = await inviteAdmin(brand.id, user.id);
  revalidatePath("/platform");
  redirect(`/brands/${brand.id}?created=1${invited ? `&invited=${encodeURIComponent(admin)}` : "&noinvite=1"}`);
}

export async function saveBrand(form: FormData) {
  await requirePlatformAdmin();
  const b = await db.brand.findUnique({ where: { id: str(form, "id") } });
  if (!b) redirect("/");
  const back = (e?: string) => redirect(`/brands/${b!.id}?${e ? `error=${encodeURIComponent(e)}` : "saved=1"}`);
  const data: Record<string, unknown> = {
    name: str(form, "name") || b!.name,
    tagline: str(form, "tagline"),
    domains: parseDomains(str(form, "domains")),
    heroTitle: str(form, "heroTitle") || null,
    heroText: str(form, "heroText") || null,
    active: form.get("active") === "on",
    providerSignup: form.get("providerSignup") === "on",
  };
  if (isBusinessType(str(form, "businessType"))) data.businessType = str(form, "businessType");
  const country = str(form, "country");
  if (isCountry(country) && country !== b!.country) {
    // Prices are stored in the brand currency, so a currency change needs empty prices or a manual review.
    Object.assign(data, { country, currency: COUNTRIES[country].currency, settleCurrency: COUNTRIES[country].currency });
  }
  const fee = Number(str(form, "platformFeePct"));
  if (Number.isFinite(fee) && fee >= 0 && fee <= 50) data.platformFeePct = fee;
  const preset = str(form, "applyPreset");
  if (isPreset(preset)) {
    const p = PRESETS[preset];
    Object.assign(data, { themePreset: preset, color: p.color, ctaColor: p.ctaColor, bgColor: p.bgColor, fontPair: p.fontPair });
  } else {
    for (const k of ["color", "ctaColor", "bgColor"] as const) if (HEX.test(str(form, k))) data[k] = str(form, k);
    if (str(form, "fontPair") in FONT_PAIRS) data.fontPair = str(form, "fontPair");
  }
  for (const [field, key] of [["logoUrl", "logo"], ["heroImageUrl", "heroImage"]] as const) {
    if (form.get(`remove_${key}`) === "on") { data[field] = null; continue; }
    const file = form.get(key);
    if (file instanceof File && file.size > 0) {
      const saved = await saveImage(file);
      if ("error" in saved) back(`${key === "logo" ? "Logo" : "Hero image"}: ${saved.error}`);
      else data[field] = saved.url;
    }
  }
  await db.brand.update({ where: { id: b!.id }, data });
  revalidatePath("/", "layout");
  back();
}

export async function addBrandAdmin(form: FormData) {
  await requirePlatformAdmin();
  const brandId = str(form, "id"), email = str(form, "email").toLowerCase();
  if (!EMAIL.test(email)) redirect(`/brands/${brandId}?error=${encodeURIComponent("Enter a valid admin email.")}`);
  if (!(await db.brand.findUnique({ where: { id: brandId } }))) redirect("/");
  const user = await db.user.upsert({
    where: { brandId_email: { brandId, email } },
    update: { role: "BRAND_ADMIN" },
    create: { brandId, email, name: "Brand admin", role: "BRAND_ADMIN" },
  });
  const invited = await inviteAdmin(brandId, user.id);
  redirect(`/brands/${brandId}?${invited ? `invited=${encodeURIComponent(email)}` : "noinvite=1"}`);
}

/** Sends the portal invite again, e.g. when the first link expired. */
export async function resendAdminInvite(form: FormData) {
  await requirePlatformAdmin();
  const brandId = str(form, "id");
  const user = await db.user.findFirst({ where: { id: str(form, "userId"), brandId, role: "BRAND_ADMIN" } });
  if (!user) redirect(`/brands/${brandId}`);
  const invited = await inviteAdmin(brandId, user.id);
  redirect(`/brands/${brandId}?${invited ? `invited=${encodeURIComponent(user.email)}` : "noinvite=1"}`);
}

/** Takes admin rights away (the person keeps any bookings as a guest). */
export async function removeBrandAdmin(form: FormData) {
  await requirePlatformAdmin();
  const brandId = str(form, "id");
  await db.user.updateMany({ where: { id: str(form, "userId"), brandId, role: "BRAND_ADMIN" }, data: { role: "GUEST" } });
  redirect(`/brands/${brandId}?saved=1`);
}
