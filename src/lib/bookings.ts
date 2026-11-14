import type { Brand } from "@prisma/client";
import { db } from "./db";
import { baseUrl } from "./brand";
import { createLoginToken } from "./auth";
import { emailGuest, sendEmail, type BookingEvent } from "./email";
import { moneyFmt } from "./money";
import { PAY_LABEL, UNIT_LABEL, fmtDate } from "./labels";
import { gateway } from "./payments";

export const withDetails = { listing: true, guest: true } as const;

export async function findBooking(brandId: string, ref: string) {
  return db.booking.findFirst({ where: { brandId, ref }, include: withDetails });
}

/** One-time link (valid 7 days) that signs the guest in and opens their booking. */
export async function manageUrl(guestId: string, ref: string) {
  const token = await createLoginToken(guestId, `/bookings/${ref}`, 7 * 24 * 60);
  return `${await baseUrl()}/auth/verify?token=${token}`;
}

export async function notify(brand: Brand, bookingId: string, event: BookingEvent, extra = "") {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: withDetails });
  await emailGuest(brand, b, event, await manageUrl(b.guestId, b.ref), extra);
}

/**
 * Called when the gateway reports a final payment result (webhook or mock checkout).
 * Safe to call more than once and from racing requests: each step only applies once.
 */
export async function applyPaymentResult(reference: string, reported: "SUCCEEDED" | "FAILED", amount?: number, currency?: string) {
  const payment = await db.payment.findUnique({ where: { reference }, include: { booking: { include: { listing: true, brand: true, quote: { select: { id: true } } } } } });
  if (!payment) return null;
  const b = payment.booking;
  let status = reported;
  if (status === "SUCCEEDED" && ((amount !== undefined && amount !== payment.amount) || (currency && currency !== payment.currency))) {
    console.error(`Payment ${reference}: gateway reported ${amount} ${currency}, expected ${payment.amount} ${payment.currency}`);
    status = "FAILED";
  }
  const claimed = await db.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status } });
  if (claimed.count !== 1) return b; // already handled

  if (status === "FAILED") {
    await db.booking.updateMany({ where: { id: b.id, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } });
    if (b.quote) await db.quoteRequest.updateMany({ where: { bookingId: b.id, status: "ACCEPTED" }, data: { status: "QUOTED", bookingId: null } });
    return b;
  }
  // A quote was already agreed with the brand, so it is confirmed as soon as it is paid.
  const next = b.listing.needsConfirmation && !b.quote ? "REQUESTED" : "CONFIRMED";
  const moved = await db.booking.updateMany({ where: { id: b.id, status: "PENDING_PAYMENT" }, data: { status: next } });
  if (moved.count !== 1) {
    // Paid after the booking was cancelled: give the money back.
    await refundOnline(b.id);
    return b;
  }
  await notify(b.brand, b.id, next === "CONFIRMED" ? "booked" : "requested");
  await alertTeam(b.brand, b.id, next === "CONFIRMED" ? "new" : "request");
  return b;
}

/** Refunds whatever was paid online for a booking. Throws if any refund fails, after refunding the rest. */
async function refundOnline(bookingId: string) {
  const paid = await db.payment.findMany({ where: { bookingId, status: "SUCCEEDED" } });
  const failed: string[] = [];
  for (const p of paid) {
    try {
      await gateway().refund(p.reference, p.amount);
      await db.payment.update({ where: { id: p.id }, data: { status: "REFUNDED" } });
    } catch (e) {
      console.error(`Refund failed for payment ${p.reference}:`, e);
      failed.push(p.reference);
    }
  }
  if (failed.length) throw new Error(`Refund failed for ${failed.join(", ")}. The booking was not changed; try again or refund in DPayments.`);
}

export const ACTIVE_STATUSES = ["PENDING_PAYMENT", "REQUESTED", "CONFIRMED"] as const;

export async function cancelBooking(brand: Brand, bookingId: string, reason: "cancelled" | "declined") {
  // A checkout still open stays PENDING: if the guest pays later, applyPaymentResult refunds it.
  await refundOnline(bookingId);
  await db.booking.update({ where: { id: bookingId }, data: { status: reason === "declined" ? "DECLINED" : "CANCELLED", changeRequestDate: null } });
  await notify(brand, bookingId, reason);
}

export async function confirmBooking(brand: Brand, bookingId: string) {
  await db.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED" } });
  await notify(brand, bookingId, "confirmed");
}

export async function completeBooking(brand: Brand, bookingId: string) {
  await db.booking.update({ where: { id: bookingId }, data: { status: "COMPLETED" } });
  await notify(brand, bookingId, "completed");
}

export async function requestDateChange(brand: Brand, bookingId: string, date: string) {
  const ok = await db.booking.updateMany({
    where: { id: bookingId, status: { in: [...ACTIVE_STATUSES] } }, data: { changeRequestDate: new Date(date + "T00:00:00Z") },
  });
  if (ok.count !== 1) return;
  await notify(brand, bookingId, "changeRequested", date);
  await alertTeam(brand, bookingId, "change", date);
}

export async function resolveDateChange(brand: Brand, bookingId: string, accept: boolean) {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (!b.changeRequestDate || !(ACTIVE_STATUSES as readonly string[]).includes(b.status)) return;
  await db.booking.update({
    where: { id: bookingId },
    data: accept ? { startDate: b.changeRequestDate, changeRequestDate: null } : { changeRequestDate: null },
  });
  await notify(brand, bookingId, accept ? "changeAccepted" : "changeDeclined");
}

export type TeamEvent = "new" | "request" | "cancelled" | "change" | "message";

/** Emails of the brand's admins. */
export async function brandAdminEmails(brandId: string) {
  const admins = await db.user.findMany({ where: { brandId, role: "BRAND_ADMIN" }, select: { email: true } });
  return admins.map(a => a.email);
}

/**
 * Tells the brand's admins, and the provider whose service was booked, about a booking event.
 * The brand's own fleet has no separate provider email.
 */
export async function alertTeam(brand: Brand, bookingId: string, event: TeamEvent, extra = "") {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { guest: true, listing: { include: { provider: true } } } });
  const fmt = moneyFmt(brand.currency);
  const u = UNIT_LABEL[b.listing.unit];
  const title: Record<TeamEvent, string> = {
    new: `New booking ${b.ref}`, request: `New booking request ${b.ref}: please confirm`, cancelled: `Booking ${b.ref} cancelled by the guest`,
    change: `Date change requested on ${b.ref}`, message: `Guest message on ${b.ref}`,
  };
  const details = [
    `${b.listing.title}, ${b.listing.place}`,
    ...(b.note ? [b.note] : []),
    `Start: ${fmtDate(b.startDate)} · ${b.quantity} ${b.quantity === 1 ? u.one : u.many} · ${b.guests} guest${b.guests === 1 ? "" : "s"}`,
    `Guest: ${b.guest.name || "(no name)"} <${b.guest.email}>${b.guest.phone ? ` · ${b.guest.phone}` : ""}`,
    `Total: ${fmt(b.total)} (${PAY_LABEL[b.payMethod]}${b.onlineAmount ? `, ${fmt(b.onlineAmount)} paid online` : ""}${b.cashAmount ? `, ${fmt(b.cashAmount)} cash on the day` : ""})`,
    ...(event === "change" ? [`Requested new start date: ${extra}`] : []),
    ...(event === "message" ? [``, `"${extra}"`] : []),
  ].join("\n");
  const link = `${await baseUrl()}/portal/bookings/${b.ref}`;
  const subject = `${brand.name}: ${title[event]}`;
  for (const to of await brandAdminEmails(brand.id)) {
    await sendEmail(brand, { to, subject, text: `${details}\n\n${event === "request" || event === "change" ? "Reply" : "Open the booking"} in your Client portal: ${link}`, bookingRef: b.ref });
  }
  const p = b.listing.provider;
  if (p.licenceNo !== "OWN-FLEET" && p.status === "APPROVED" && p.email && event !== "message") {
    await sendEmail(brand, {
      to: p.email, subject,
      text: `Hello ${p.business},\n\n${details}\n\n${event === "request" || event === "change" ? `${brand.name} will confirm with you before replying to the guest.` : `Questions? Reply to this email and ${brand.name} will help.`}`,
      bookingRef: b.ref,
    });
  }
}
