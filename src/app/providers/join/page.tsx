import { redirect } from "next/navigation";
import type { ListingType, PriceUnit } from "@prisma/client";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { parseRupees } from "@/lib/money";
import { TYPE_LABEL } from "@/lib/labels";

export const metadata = { title: "List your service" };

const DEFAULT_UNIT: Record<ListingType, PriceUnit> = { STAY: "NIGHT", DRIVER: "DAY", TRANSPORT: "SEAT", GUIDE: "PERSON", SHARE: "WEEK", PACKAGE: "PERSON", WELLNESS: "SESSION" };
const UNITS: PriceUnit[] = ["NIGHT", "DAY", "SEAT", "PERSON", "WEEK", "SESSION"];

export default function Join({ searchParams }: { searchParams: { sent?: string; error?: string } }) {
  async function apply(form: FormData) {
    "use server";
    const brand = await getBrand();
    const s = (k: string) => String(form.get(k) ?? "").trim();
    const type = s("type") as ListingType;
    const unit = (UNITS.includes(s("unit") as PriceUnit) ? s("unit") : DEFAULT_UNIT[type]) as PriceUnit;
    const price = parseRupees(s("price"));
    if (!(type in TYPE_LABEL) || !s("business") || !s("title") || !s("place") || !s("licence") || !s("phone") || !s("email") || !(price >= 10000)) {
      redirect("/providers/join?error=1");
    }
    const provider = await db.provider.create({
      data: { brandId: brand.id, business: s("business"), type, licenceNo: s("licence"), phone: s("phone"), email: s("email").toLowerCase() },
    });
    await db.listing.create({
      data: {
        brandId: brand.id, providerId: provider.id, type, title: s("title"), place: s("place"), description: s("description"),
        price, unit, needsConfirmation: type === "PACKAGE" || form.get("confirm") === "on",
      },
    });
    redirect("/providers/join?sent=1");
  }

  if (searchParams.sent) return (
    <div className="card stack" style={{ maxWidth: 640 }}>
      <h1>Thanks, we've got your application</h1>
      <p style={{ margin: 0 }}>We'll check your licence or permit within 2 working days and contact you on the phone number you gave. Your listing goes live once it's approved.</p>
    </div>
  );

  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <div><h1>List your service</h1><p className="muted">Guesthouses, villas, drivers, tuk-tuks, guides, coach and shuttle companies, spas and wellness centres, room shares and tour operators. Free to join; commission only when you get a booking.</p></div>
      {searchParams.error && <p className="error">Fill in every field, with a price of at least Rs 100.</p>}
      <form action={apply} className="card form">
        <label>What do you offer?<select name="type">{(Object.keys(TYPE_LABEL) as ListingType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></label>
        <label>Your name or business<input name="business" required /></label>
        <label className="full">Listing title<input name="title" required placeholder="e.g. Airport shuttle, Colombo to Kandy" /></label>
        <label>Town<input name="place" required placeholder="e.g. Negombo" /></label>
        <label>Price in LKR<input name="price" inputMode="numeric" required placeholder="12,000" /></label>
        <label>Priced per<select name="unit" defaultValue="">
          <option value="">Usual for this type</option><option value="NIGHT">Night</option><option value="DAY">Day</option><option value="SEAT">Seat</option><option value="PERSON">Person</option><option value="WEEK">Week</option><option value="SESSION">Session</option>
        </select></label>
        <label>Licence or registration number (SLTDA / NTC / Ayurveda)<input name="licence" required /></label>
        <label>Mobile (WhatsApp)<input name="phone" type="tel" required placeholder="+94 7X XXX XXXX" /></label>
        <label>Email<input name="email" type="email" required /></label>
        <label className="full">Description<textarea name="description" rows={3} required placeholder="What guests get, languages, what's included" /></label>
        <label className="check full"><input type="checkbox" name="confirm" /> I want to confirm each booking myself before it's final</label>
        <p className="muted full" style={{ margin: 0 }}>We'll ask for a photo of your ID and licence when we contact you.</p>
        <div className="full"><button className="btn" type="submit">Submit for approval</button></div>
      </form>
    </div>
  );
}
