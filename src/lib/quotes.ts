import { randomBytes, randomInt } from "node:crypto";
import type { Brand, PayMethod, QuoteRequest, User } from "@prisma/client";
import { db } from "./db";
import { baseUrl } from "./brand";
import { createLoginToken } from "./auth";
import { sendEmail } from "./email";
import { moneyFmt } from "./money";
import { TYPE_LABEL, fmtDate } from "./labels";
import { quote as priceQuote } from "./pricing";
import { newBookingRef } from "./refs";
import { notify } from "./bookings";
import { gateway } from "./payments";

export const QUOTE_STATUS_LABEL = {
  NEW: "Waiting for a price", QUOTED: "Price sent", ACCEPTED: "Accepted", DECLINED: "Declined", CLOSED: "Closed",
} as const;

/** A sent quote past its "valid until" date can no longer be accepted. */
export const isExpired = (q: Pick<QuoteRequest, "status" | "validUntil">) =>
  q.status === "QUOTED" && !!q.validUntil && q.validUntil.getTime() < Date.now();

export function quoteStatusLabel(q: Pick<QuoteRequest, "status" | "validUntil">) {
  return isExpired(q) ? "Expired" : QUOTE_STATUS_LABEL[q.status];
}

export async function newQuoteRef(prefix: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const ref = `${prefix}-Q${randomInt(10000, 99999)}`;
    if (!(await db.quoteRequest.findUnique({ where: { ref } }))) return ref;
  }
  return `${prefix}-Q${Date.now().toString(36).toUpperCase()}`;
}

/** One line describing the trip, used in emails, lists and the booking note. */
export function tripLine(q: Pick<QuoteRequest, "type" | "fromPlace" | "toPlace" | "returnTrip" | "startDate" | "endDate" | "people"> & { pickupTime?: string | null; hours?: number | null }) {
  const where = q.toPlace ? `${q.fromPlace} → ${q.toPlace}${q.returnTrip ? " (return)" : ""}` : q.fromPlace;
  const when = (q.endDate ? `${fmtDate(q.startDate)} to ${fmtDate(q.endDate)}` : fmtDate(q.startDate)) + (q.pickupTime ? ` at ${q.pickupTime}` : "") + (q.hours ? `, ${q.hours} h` : "");
  return `${q.type ? TYPE_LABEL[q.type] + ": " : ""}${where} · ${when} · ${q.people} ${q.people === 1 ? "person" : "people"}`;
}

async function guestLink(guestId: string, ref: string) {
  const token = await createLoginToken(guestId, `/quotes/${ref}`, 7 * 24 * 60);
  return `${await baseUrl()}/auth/verify?token=${token}`;
}

export type QuoteEvent = "received" | "quoted" | "message";

/** Emails to the guest. Each carries a link that signs them straight into the quote. */
export async function emailQuoteGuest(brand: Brand, q: QuoteRequest & { guest: User }, event: QuoteEvent, extra = "") {
  const first = (q.guest.name || "there").split(" ")[0];
  const fmt = moneyFmt(brand.currency);
  const trip = tripLine(q);
  let subject = "", body = "";
  if (event === "received") {
    subject = `We've got your request ${q.ref}`;
    body = `Hi ${first}, thanks for your request. We'll find the right service and send you a price, usually within 24 hours.\n\n${trip}`;
  } else if (event === "quoted" && q.price != null) {
    const p = priceQuote({ unitPrice: q.price, quantity: 1, serviceFeePct: Number(brand.serviceFeePct), payMethod: "CARD", depositPct: brand.depositPct });
    subject = `Your quote ${q.ref}: ${fmt(p.total)}`;
    body = `Hi ${first}, here's your price.\n\n${trip}\nTotal: ${fmt(p.total)}${q.included ? `\nIncludes: ${q.included}` : ""}${q.validUntil ? `\nValid until: ${fmtDate(q.validUntil)}` : ""}\n\nAccept it online to book, or reply with any questions.`;
  } else {
    subject = `New message about ${q.ref}`;
    body = `"${extra}"\n\nReply from your quote page.`;
  }
  await sendEmail(brand, {
    to: q.guest.email,
    subject: `${brand.name}: ${subject}`,
    text: `${body}\n\nView your quote: ${await guestLink(q.guestId, q.ref)}\n\nYou're getting this because you asked ${brand.name} for a quote.`,
    bookingRef: q.ref,
  });
}

/** Tells the brand's admins about a new request, a guest message, or the guest's decision. */
export async function emailQuoteBrand(brand: Brand, q: QuoteRequest & { guest: User }, what: "new" | "message" | "accepted" | "declined", extra = "") {
  const admins = await db.user.findMany({ where: { brandId: brand.id, role: "BRAND_ADMIN" }, select: { email: true } });
  const link = `${await baseUrl()}/portal/quotes/${q.ref}`;
  const subject = {
    new: `New quote request ${q.ref}`, message: `Guest replied on ${q.ref}`, accepted: `Quote ${q.ref} accepted`, declined: `Quote ${q.ref} declined`,
  }[what];
  const lines = [
    `${q.guest.name} <${q.guest.email}>${q.phone ? ` · ${q.phone}` : ""}`,
    tripLine(q),
    q.budget ? `Budget: ${q.budget}` : "",
    what === "new" && q.details ? `\n${q.details}` : "",
    extra ? `\n"${extra}"` : "",
  ].filter(Boolean).join("\n");
  for (const a of admins) {
    await sendEmail(brand, { to: a.email, subject: `${brand.name}: ${subject}`, text: `${lines}\n\nOpen in the client portal: ${link}`, bookingRef: q.ref });
  }
}

/**
 * Guest accepts a sent quote: turns it into a confirmed booking (the brand already agreed the price).
 * Returns a URL to send the guest to (checkout or confirmation), or an error message.
 */
export async function acceptQuote(brand: Brand, quoteId: string, payMethod: PayMethod): Promise<{ url: string } | { error: string }> {
  const q = await db.quoteRequest.findFirst({ where: { id: quoteId, brandId: brand.id }, include: { guest: true, listing: true } });
  if (!q || q.status !== "QUOTED" || q.price == null || !q.listing) return { error: "This quote can't be accepted any more." };
  if (isExpired(q)) return { error: "This quote has expired. Send us a message and we'll refresh the price." };
  const cashOk = brand.allowCash && q.allowCash;
  if (!["CARD", "DEPOSIT", "CASH"].includes(payMethod) || (payMethod !== "CARD" && !cashOk)) return { error: "Choose card payment for this quote." };

  // Claim the quote first so a double click can't create two bookings.
  const claimed = await db.quoteRequest.updateMany({ where: { id: q.id, status: "QUOTED" }, data: { status: "ACCEPTED" } });
  if (claimed.count !== 1) return { error: "This quote has already been accepted." };

  const p = priceQuote({ unitPrice: q.price, quantity: 1, serviceFeePct: Number(brand.serviceFeePct), payMethod, depositPct: brand.depositPct });
  let booking = null;
  let ref = "";
  for (let attempt = 0; attempt < 3 && !booking; attempt++) {
    ref = await newBookingRef(brand.bookingPrefix);
    try {
      booking = await db.booking.create({ data: {
        ref, brandId: brand.id, listingId: q.listing.id, guestId: q.guestId,
        startDate: q.startDate, quantity: 1, guests: q.people,
        subtotal: p.subtotal, serviceFee: p.serviceFee, total: p.total,
        payMethod, onlineAmount: p.onlineAmount, cashAmount: p.cashAmount,
        status: p.onlineAmount > 0 ? "PENDING_PAYMENT" : "CONFIRMED",
        commissionPct: brand.commissionPct, platformFeePct: brand.platformFeePct,
        note: `Quote ${q.ref}: ${tripLine(q)}${q.included ? `. Includes: ${q.included}` : ""}`,
      } });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  if (!booking) {
    await db.quoteRequest.update({ where: { id: q.id }, data: { status: "QUOTED" } });
    return { error: "Something went wrong. Please try again." };
  }
  await db.quoteRequest.update({ where: { id: q.id }, data: { bookingId: booking.id } });
  await emailQuoteBrand(brand, q, "accepted", `Booking ${ref}, ${moneyFmt(brand.currency)(p.total)}`);

  if (p.onlineAmount === 0) {
    await notify(brand, booking.id, "booked");
    return { url: `/booked/${ref}` };
  }
  const gw = gateway();
  const reference = `${ref}-${randomBytes(4).toString("hex")}`;
  await db.payment.create({ data: { bookingId: booking.id, gateway: gw.name, reference, amount: p.onlineAmount, currency: brand.currency } });
  const base = await baseUrl();
  try {
    const { redirectUrl } = await gw.createCheckout({
      reference, bookingRef: ref, amount: p.onlineAmount, currency: brand.currency, customerEmail: q.guest.email,
      description: `${brand.name} booking ${ref} (quote ${q.ref})`,
      returnUrl: `${base}/booked/${ref}`, webhookUrl: `${base}/api/payments/webhook`,
    });
    return { url: redirectUrl };
  } catch (e) {
    console.error(e);
    await reopenQuote(booking.id);
    await db.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
    return { error: "We couldn't start the payment. Please try again in a moment." };
  }
}

/** Payment for a quote's booking failed: put the quote back so the guest can try again. */
export async function reopenQuote(bookingId: string) {
  await db.quoteRequest.updateMany({ where: { bookingId, status: "ACCEPTED" }, data: { status: "QUOTED", bookingId: null } });
}
