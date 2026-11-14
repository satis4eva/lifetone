import type { Brand } from "@prisma/client";
import { db } from "./db";
import { baseUrl } from "./brand";
import { createLoginToken } from "./auth";
import { emailGuest, type BookingEvent } from "./email";
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
