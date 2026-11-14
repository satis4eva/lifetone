"use server";
import { revalidatePath } from "next/cache";
import type { Audience } from "@prisma/client";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { requireBrandAdmin } from "@/lib/auth";
import { parseRupees } from "@/lib/money";
import { cleanImageLink, saveImage } from "@/lib/media";
import { generateImage } from "@/lib/aiImage";
import { redirect } from "next/navigation";
import { emailQuoteGuest } from "@/lib/quotes";
import { cancelBooking, completeBooking, confirmBooking, notify, resolveDateChange } from "@/lib/bookings";

async function ctx() {
  await requireBrandAdmin();
  return getBrand();
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Booking actions from the portal. Every change emails the guest. */
export async function bookingAction(form: FormData) {
  const brand = await ctx();
  const b = await db.booking.findFirst({ where: { id: str(form, "id"), brandId: brand.id } });
  if (!b) return;
  const action = str(form, "action");
  if (action === "confirm" && b.status === "REQUESTED") await confirmBooking(brand, b.id);
  else if (action === "decline" && b.status === "REQUESTED") await cancelBooking(brand, b.id, "declined");
  else if (action === "cancel" && b.status === "CONFIRMED") await cancelBooking(brand, b.id, "cancelled");
  else if (action === "complete" && b.status === "CONFIRMED") await completeBooking(brand, b.id);
  else if (action === "acceptChange") await resolveDateChange(brand, b.id, true);
  else if (action === "declineChange") await resolveDateChange(brand, b.id, false);
  revalidatePath("/portal", "layout");
}

export async function replyToGuest(form: FormData) {
  const brand = await ctx();
  const b = await db.booking.findFirst({ where: { id: str(form, "id"), brandId: brand.id } });
  const body = str(form, "body").slice(0, 2000);
  if (!b || !body) return;
  await db.message.create({ data: { bookingId: b.id, sender: "PROVIDER", body } });
  await notify(brand, b.id, "message", body);
  revalidatePath(`/portal/bookings/${b.ref}`);
}

export async function listingAction(form: FormData) {
  const brand = await ctx();
  const l = await db.listing.findFirst({ where: { id: str(form, "id"), brandId: brand.id } });
  if (!l) return;
  const action = str(form, "action");
  if (action === "approve") {
    await db.listing.update({ where: { id: l.id }, data: { status: "LIVE" } });
    await db.provider.update({ where: { id: l.providerId }, data: { status: "APPROVED" } });
  } else if (action === "reject") {
    await db.listing.update({ where: { id: l.id }, data: { status: "REJECTED" } });
    await db.provider.update({ where: { id: l.providerId }, data: { status: "REJECTED" } });
  } else if (action === "pause" && l.status === "LIVE") {
    await db.listing.update({ where: { id: l.id }, data: { status: "PAUSED" } });
  } else if (action === "resume" && l.status === "PAUSED") {
    await db.listing.update({ where: { id: l.id }, data: { status: "LIVE" } });
  } else if (action === "price") {
    const price = parseRupees(str(form, "price"));
    if (price >= 100) await db.listing.update({ where: { id: l.id }, data: { price } });
  }
  revalidatePath("/portal/listings");
}

/** Sets a listing's photo from an uploaded file or an https link, or removes it. */
export async function listingImage(form: FormData) {
  const brand = await ctx();
  const l = await db.listing.findFirst({ where: { id: str(form, "id"), brandId: brand.id } });
  if (!l) return;
  const back = (msg?: string) => redirect(`/portal/listings${msg ? `?error=${encodeURIComponent(msg)}&id=${l.id}` : ""}#l-${l.id}`);
  if (str(form, "action") === "removeImage") {
    await db.listing.update({ where: { id: l.id }, data: { imageUrl: null, imageIsAi: false } });
  } else if (str(form, "action") === "ai") {
    const made = await generateImage(str(form, "prompt"));
    if ("error" in made) back(made.error);
    else await db.listing.update({ where: { id: l.id }, data: { imageUrl: made.url, imageIsAi: true } });
  } else {
    const file = form.get("file");
    const link = str(form, "link");
    let url: string | null = null;
    if (file instanceof File && file.size > 0) {
      const saved = await saveImage(file);
      if ("error" in saved) back(saved.error);
      else url = saved.url;
    } else if (link) {
      url = cleanImageLink(link);
      if (!url) back("Paste a full image link starting with https://");
    } else back("Choose an image file or paste an image link.");
    await db.listing.update({ where: { id: l.id }, data: { imageUrl: url, imageIsAi: false } });
  }
  revalidatePath("/", "layout");
  back();
}

const AUDIENCES: Audience[] = ["TOURISTS", "PROVIDERS", "DRIVERS_TRANSPORT", "AGENCIES"];
export async function postUpdate(form: FormData) {
  const brand = await ctx();
  const audience = str(form, "audience") as Audience;
  if (!AUDIENCES.includes(audience) || !str(form, "title") || !str(form, "body")) return;
  await db.update.create({ data: { brandId: brand.id, audience, title: str(form, "title"), body: str(form, "body") } });
  revalidatePath("/portal/updates");
  revalidatePath("/");
}

export async function saveSettings(form: FormData) {
  const brand = await ctx();
  const num = (k: string, min: number, max: number, fallback: number) => {
    const n = Number(str(form, k)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const color = /^#[0-9a-fA-F]{6}$/.test(str(form, "color")) ? str(form, "color") : brand.color;
  await db.brand.update({
    where: { id: brand.id },
    data: {
      name: str(form, "name") || brand.name,
      tagline: str(form, "tagline"),
      color,
      emailFrom: str(form, "emailFrom") || null,
      commissionPct: num("commissionPct", 0, 40, Number(brand.commissionPct)),
      serviceFeePct: num("serviceFeePct", 0, 15, Number(brand.serviceFeePct)),
      allowCash: form.get("allowCash") === "on",
      depositPct: Math.round(num("depositPct", 0, 100, brand.depositPct)),
      settleCurrency: ["LKR", "GBP", "USD", "EUR"].includes(str(form, "settleCurrency")) ? str(form, "settleCurrency") : brand.settleCurrency,
      // platformFeePct is set by the platform owner only, not here.
    },
  });
  revalidatePath("/", "layout");
}

/** Brand prices a quote request (or updates a sent price) and emails it to the guest. */
export async function sendQuote(form: FormData) {
  const brand = await ctx();
  const q = await db.quoteRequest.findFirst({ where: { id: str(form, "id"), brandId: brand.id }, include: { guest: true } });
  if (!q || !["NEW", "QUOTED"].includes(q.status)) return;
  const back = `/portal/quotes/${q.ref}`;
  const listing = await db.listing.findFirst({ where: { id: str(form, "listingId"), brandId: brand.id, status: { not: "REJECTED" } } });
  const price = parseRupees(str(form, "price"));
  const days = Math.min(60, Math.max(1, parseInt(str(form, "validDays"), 10) || 7));
  if (!listing) redirect(`${back}?error=${encodeURIComponent("Choose the service (provider) that will deliver this.")}`);
  if (!Number.isFinite(price) || price <= 0) redirect(`${back}?error=${encodeURIComponent("Enter a price above zero.")}`);
  const updated = await db.quoteRequest.update({
    where: { id: q.id },
    data: {
      status: "QUOTED", listingId: listing.id, price, included: str(form, "included").slice(0, 1000) || null,
      allowCash: form.get("allowCash") === "on", validUntil: new Date(Date.now() + days * 86_400_000), quotedAt: new Date(),
    },
    include: { guest: true },
  });
  await emailQuoteGuest(brand, updated, "quoted");
  redirect(`${back}?done=sent`);
}

export async function replyToQuote(form: FormData) {
  const brand = await ctx();
  const q = await db.quoteRequest.findFirst({ where: { id: str(form, "id"), brandId: brand.id }, include: { guest: true } });
  const body = str(form, "body").slice(0, 2000);
  if (!q || !body) return;
  await db.message.create({ data: { quoteId: q.id, sender: "BRAND", body } });
  await emailQuoteGuest(brand, q, "message", body);
  revalidatePath(`/portal/quotes/${q.ref}`);
}

export async function closeQuote(form: FormData) {
  const brand = await ctx();
  await db.quoteRequest.updateMany({ where: { id: str(form, "id"), brandId: brand.id, status: { in: ["NEW", "QUOTED"] } }, data: { status: "CLOSED" } });
  revalidatePath("/portal", "layout");
}
