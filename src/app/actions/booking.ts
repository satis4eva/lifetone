"use server";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import type { PayMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { baseUrl, getBrand } from "@/lib/brand";
import { quote, unitsBetween } from "@/lib/pricing";
import { newBookingRef } from "@/lib/refs";
import { notify } from "@/lib/bookings";
import { gateway } from "@/lib/payments";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Creates a booking from the listing form. Returns an error message, or redirects to payment/confirmation. */
export async function createBooking(_prev: string | null, form: FormData): Promise<string | null> {
  const brand = await getBrand();
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const listing = await db.listing.findFirst({ where: { id: s("listingId"), brandId: brand.id, status: "LIVE" } });
  if (!listing) return "This listing is no longer available.";

  const name = s("name"), email = s("email").toLowerCase(), start = s("start");
  const payMethod = s("payMethod") as PayMethod;
  if (!name) return "Enter your name.";
  if (!EMAIL.test(email)) return "Enter a valid email address.";
  if (!DATE.test(start) || start < new Date().toISOString().slice(0, 10)) return "Choose a start date from today onwards.";
  if (!["CARD", "DEPOSIT", "CASH"].includes(payMethod)) return "Choose how you want to pay.";
  if (payMethod !== "CARD" && !brand.allowCash) return "Cash payments aren't available. Choose card.";

  const range = listing.unit === "NIGHT" || listing.unit === "DAY";
  const quantity = range ? unitsBetween(start, s("end"), listing.unit === "DAY") : parseInt(s("quantity"), 10);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 90) return range ? "The end date must be after the start date." : "Enter a quantity between 1 and 90.";
  const guests = range ? Math.max(1, parseInt(s("guests"), 10) || 1) : quantity;

  const q = quote({ unitPrice: listing.price, quantity, serviceFeePct: Number(brand.serviceFeePct), payMethod, depositPct: brand.depositPct });

  let guest = await db.user.findUnique({ where: { brandId_email: { brandId: brand.id, email } } });
  if (!guest) guest = await db.user.create({ data: { brandId: brand.id, email, name, role: "GUEST" } });
  else if (!guest.name) guest = await db.user.update({ where: { id: guest.id }, data: { name } });

  let ref = "";
  let booking = null;
  for (let attempt = 0; attempt < 3 && !booking; attempt++) {
    ref = await newBookingRef(brand.bookingPrefix);
    try {
      booking = await db.booking.create({ data: {
      ref, brandId: brand.id, listingId: listing.id, guestId: guest.id,
      startDate: new Date(start + "T00:00:00Z"), quantity, guests,
      subtotal: q.subtotal, serviceFee: q.serviceFee, total: q.total,
      payMethod, onlineAmount: q.onlineAmount, cashAmount: q.cashAmount,
      status: q.onlineAmount > 0 ? "PENDING_PAYMENT" : "REQUESTED",
      commissionPct: brand.commissionPct, platformFeePct: brand.platformFeePct,
      } });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e; // reference taken by a parallel booking: retry
    }
  }
  if (!booking) return "Something went wrong creating your booking. Please try again.";

  if (q.onlineAmount === 0) {
    await notify(brand, booking.id, "requested");
    redirect(`/booked/${ref}`);
  }

  const gw = gateway();
  const reference = `${ref}-${randomBytes(4).toString("hex")}`;
  await db.payment.create({ data: { bookingId: booking.id, gateway: gw.name, reference, amount: q.onlineAmount } });
  const base = await baseUrl();
  let redirectUrl: string;
  try {
    ({ redirectUrl } = await gw.createCheckout({
      reference, bookingRef: ref, amount: q.onlineAmount, currency: "LKR", customerEmail: email,
      description: `${brand.name} booking ${ref}: ${listing.title}`,
      returnUrl: `${base}/booked/${ref}`, webhookUrl: `${base}/api/payments/webhook`,
    }));
  } catch (e) {
    console.error(e);
    return "We couldn't start the payment. Please try again in a moment.";
  }
  redirect(redirectUrl);
}
