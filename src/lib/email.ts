import type { Booking, Brand, Listing, User } from "@prisma/client";

/** Who an email is from: a brand, or the platform console (id null). */
export type Sender = { id: string | null; name: string; emailFrom?: string | null };
export const PLATFORM_SENDER: Sender = { id: null, name: "DBS Group Platform" };
import nodemailer from "nodemailer";
import { db } from "./db";
import { moneyFmt } from "./money";
import { PAY_LABEL, UNIT_LABEL, fmtDate } from "./labels";

interface Mail { to: string; subject: string; text: string; bookingRef?: string }

// SMTP (e.g. Hostinger Mail) when SMTP_HOST is set. One transport, reused.
let smtp: nodemailer.Transporter | null = null;
function smtpTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!smtp) {
    const port = Number(process.env.SMTP_PORT || 465);
    smtp = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return smtp;
}
export const emailConfigured = (brand: Sender) => !!smtpTransport() || (!!process.env.RESEND_API_KEY && !!brand.emailFrom);

/**
 * Sends an email from the brand and logs it. Uses SMTP when SMTP_* is set, otherwise Resend when
 * RESEND_API_KEY is set and the brand has a verified sender; otherwise only logs it (development).
 */
export async function sendEmail(brand: Sender, mail: Mail) {
  // Sign-in tokens are never stored: the portal shows this log to brand admins.
  const redacted = mail.text.replace(/token=[A-Za-z0-9_-]+/g, "token=[hidden]");
  const record = await db.email.create({
    data: { brandId: brand.id ?? null, to: mail.to, subject: mail.subject, body: redacted, bookingRef: mail.bookingRef },
  });
  const transport = smtpTransport();
  if (transport) {
    try {
      // The sender must be the authenticated mailbox; replies go to the brand's inbox.
      await transport.sendMail({
        from: { name: brand.name, address: process.env.SMTP_USER! },
        replyTo: process.env.SMTP_REPLY_TO || undefined,
        to: mail.to, subject: mail.subject, text: mail.text,
      });
      await db.email.update({ where: { id: record.id }, data: { status: "sent" } });
    } catch (e) {
      console.error("SMTP send failed:", e);
      await db.email.update({ where: { id: record.id }, data: { status: "failed", error: String(e).slice(0, 500) } });
    }
    return;
  }
  const key = process.env.RESEND_API_KEY;
  if (!key || !brand.emailFrom) {
    // In development the full email (with its link) goes to the terminal so you can sign in.
    const shown = process.env.NODE_ENV === "production" ? redacted : mail.text;
    console.log(`[email not sent: Resend not configured] to=${mail.to} subject="${mail.subject}"\n${shown}\n`);
    if (process.env.NODE_ENV === "production") await db.email.update({ where: { id: record.id }, data: { status: "failed", error: "Resend not configured" } });
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: brand.emailFrom, to: [mail.to], subject: mail.subject, text: mail.text }),
    });
    await db.email.update({
      where: { id: record.id },
      data: res.ok ? { status: "sent" } : { status: "failed", error: `${res.status} ${await res.text()}`.slice(0, 500) },
    });
  } catch (e) {
    await db.email.update({ where: { id: record.id }, data: { status: "failed", error: String(e).slice(0, 500) } });
  }
}

type FullBooking = Booking & { listing: Listing; guest: User };

export type BookingEvent =
  | "booked" | "requested" | "confirmed" | "declined" | "cancelled" | "completed"
  | "changeRequested" | "changeAccepted" | "changeDeclined" | "message";

/** Booking emails to the guest. Every one carries a link that signs them straight into the booking. */
export async function emailGuest(brand: Brand, b: FullBooking, event: BookingEvent, manageUrl: string, extra = "") {
  const first = (b.guest.name || "there").split(" ")[0];
  const lkr = moneyFmt(brand.currency);
  const u = UNIT_LABEL[b.listing.unit];
  const details = [
    `${b.listing.title}, ${b.listing.place}`,
    `Reference: ${b.ref}`,
    `Start: ${fmtDate(b.startDate)} · ${b.quantity} ${b.quantity === 1 ? u.one : u.many}`,
    `Total: ${lkr(b.total)} (${PAY_LABEL[b.payMethod]}${b.cashAmount ? `, ${lkr(b.cashAmount)} cash on the day` : ""})`,
  ].join("\n");

  const t: Record<BookingEvent, [string, string]> = {
    booked: [`Booking confirmed: ${b.ref}`, `Hi ${first}, you're booked.\n\n${details}${b.onlineAmount ? `\n\nWe've taken ${lkr(b.onlineAmount)} by card. It's held until your trip starts.` : ""}`],
    requested: [`Booking request received: ${b.ref}`, `Hi ${first}, we've sent your request to the provider. We'll email you when they confirm, usually within 24 hours.\n\n${details}`],
    confirmed: [`Good news: ${b.ref} is confirmed`, `Hi ${first}, your booking has been confirmed.\n\n${details}`],
    declined: [`Your request ${b.ref} couldn't be confirmed`, `Hi ${first}, sorry, the provider can't take this booking.${b.onlineAmount ? ` Your ${lkr(b.onlineAmount)} is being refunded to your card.` : " You haven't been charged."}`],
    cancelled: [`Booking cancelled: ${b.ref}`, `Hi ${first}, your booking has been cancelled.${b.onlineAmount ? ` A refund of ${lkr(b.onlineAmount)} is on its way to your card. It can take 5 to 10 working days to show.` : " Nothing was charged online, so there's nothing to refund."}`],
    completed: [`How was your trip? ${b.ref}`, `Hi ${first}, we hope you enjoyed ${b.listing.title}. Leave a review to help other travellers.`],
    changeRequested: [`Date change requested: ${b.ref}`, `Hi ${first}, we've asked the provider to move your start date to ${extra}. We'll email you when they reply.`],
    changeAccepted: [`New date confirmed: ${b.ref}`, `Hi ${first}, your booking now starts on ${fmtDate(b.startDate)}.\n\n${details}`],
    changeDeclined: [`Date change not possible: ${b.ref}`, `Hi ${first}, the provider can't move your booking. It stays on ${fmtDate(b.startDate)}.`],
    message: [`New message about ${b.ref}`, `"${extra}"\n\nReply from your booking page.`],
  };
  const [subject, body] = t[event];
  await sendEmail(brand, {
    to: b.guest.email,
    subject: `${brand.name}: ${subject}`,
    text: `${body}\n\nManage your booking: ${manageUrl}\n\nYou're getting this because you booked with ${brand.name}.`,
    bookingRef: b.ref,
  });
}
