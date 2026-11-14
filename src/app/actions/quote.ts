"use server";
import { redirect } from "next/navigation";
import type { ListingType } from "@prisma/client";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { TYPE_LABEL } from "@/lib/labels";
import { emailQuoteBrand, emailQuoteGuest, newQuoteRef } from "@/lib/quotes";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Public "Request a quote" form. Returns an error message, or redirects to the thank-you page. */
export async function createQuoteRequest(_prev: string | null, form: FormData): Promise<string | null> {
  const brand = await getBrand();
  const s = (k: string, max = 200) => String(form.get(k) ?? "").trim().slice(0, max);
  const name = s("name"), email = s("email").toLowerCase(), phone = s("phone", 40);
  const type = s("type") in TYPE_LABEL ? (s("type") as ListingType) : null;
  const fromPlace = s("from"), toPlace = s("to"), start = s("start"), end = s("end");
  const people = parseInt(s("people"), 10);
  const hours = s("hours") ? parseInt(s("hours"), 10) : null;
  const pickupTime = /^\d{2}:\d{2}$/.test(s("pickupTime")) ? s("pickupTime") : null;
  const today = new Date().toISOString().slice(0, 10);
  if (!name) return "Enter your name.";
  if (!EMAIL.test(email)) return "Enter a valid email address.";
  if (!fromPlace) return "Tell us where: a pickup point or where you'd like to stay.";
  if (!DATE.test(start) || start < today) return "Choose a date from today onwards.";
  if (end && (!DATE.test(end) || end < start)) return "The end date can't be before the start date.";
  if (!Number.isInteger(people) || people < 1 || people > 500) return "Enter how many people (1 to 500).";
  if (hours !== null && (!Number.isInteger(hours) || hours < 1 || hours > 24)) return "Hours needed should be between 1 and 24.";

  let guest = await db.user.findUnique({ where: { brandId_email: { brandId: brand.id, email } } });
  if (!guest) guest = await db.user.create({ data: { brandId: brand.id, email, name, phone: phone || null, role: "GUEST" } });
  else if (!guest.name || (phone && !guest.phone)) guest = await db.user.update({ where: { id: guest.id }, data: { name: guest.name || name, phone: guest.phone || phone || null } });

  let q = null;
  for (let attempt = 0; attempt < 3 && !q; attempt++) {
    try {
      q = await db.quoteRequest.create({
        data: {
          ref: await newQuoteRef(brand.bookingPrefix), brandId: brand.id, guestId: guest.id, type,
          fromPlace, toPlace: toPlace || null, startDate: new Date(start + "T00:00:00Z"), endDate: end ? new Date(end + "T00:00:00Z") : null,
          returnTrip: form.get("return") === "on", people, budget: s("budget", 80) || null, details: s("details", 3000), phone: phone || null, hours, pickupTime,
        },
        include: { guest: true },
      });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  if (!q) return "Something went wrong. Please try again.";
  await emailQuoteGuest(brand, q, "received");
  await emailQuoteBrand(brand, q, "new");
  redirect(`/quote?sent=${q.ref}`);
}
