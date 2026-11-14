"use server";
import { revalidatePath } from "next/cache";
import type { Audience } from "@prisma/client";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { requireBrandAdmin } from "@/lib/auth";
import { parseRupees } from "@/lib/money";
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
    if (price >= 10000) await db.listing.update({ where: { id: l.id }, data: { price } });
  }
  revalidatePath("/portal/listings");
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
