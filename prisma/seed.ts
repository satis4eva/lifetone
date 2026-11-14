// Seeds the Lifetone brand, admin accounts and example providers/listings.
// Run with: npm run db:seed
import { PrismaClient, ListingType, PriceUnit } from "@prisma/client";

const db = new PrismaClient();
const rs = (lkr: number) => lkr * 100; // LKR -> cents

const examples: Array<{
  type: ListingType; business: string; licence: string; title: string; place: string;
  price: number; unit: PriceUnit; desc: string; confirm?: boolean;
}> = [
  { type: "STAY", business: "Fort Guesthouse", licence: "SLTDA/GH/0412", title: "Fort-view guesthouse, 4 rooms", place: "Galle", price: 14500, unit: "NIGHT", desc: "Colonial house inside Galle Fort walls. Breakfast included, rooftop terrace." },
  { type: "STAY", business: "Highland Stays", licence: "SLTDA/BG/1190", title: "Tea estate bungalow", place: "Ella", price: 22000, unit: "NIGHT", desc: "Three-bedroom bungalow on a working tea estate. Walk to Little Adam's Peak." },
  { type: "DRIVER", business: "Ruwan S.", licence: "SLTDA Chauffeur Guide CG-2231", title: "Chauffeur guide, 7-seat van", place: "Colombo", price: 16000, unit: "DAY", desc: "English and German speaking. Airport pickup and round-island tours." },
  { type: "TRANSPORT", business: "Southern Express Lines", licence: "NTC route permit", title: "Airport express shuttle to Galle and Mirissa", place: "Colombo Airport", price: 4500, unit: "SEAT", desc: "Air-conditioned coach every 2 hours via the Southern Expressway." },
  { type: "TRANSPORT", business: "Lanka Coach Fleet", licence: "SLTDA/TR/0144", title: "Coach hire with driver, 33 seats", place: "Colombo", price: 48000, unit: "DAY", desc: "Whole coach for groups and sports teams. Fuel and driver included up to 250 km a day.", confirm: true },
  { type: "GUIDE", business: "Chaminda W.", licence: "SLTDA National Guide NG-0761", title: "Sigiriya Rock sunrise climb", place: "Sigiriya", price: 7500, unit: "PERSON", desc: "Licensed national guide. 3-hour climb with history of the rock fortress." },
  { type: "SHARE", business: "Ishara M.", licence: "Long-stay rental", title: "Room in shared flat, near Galle Face", place: "Colombo", price: 28000, unit: "WEEK", desc: "Private room in a 3-bedroom flat. Fast Wi-Fi, shared kitchen." },
  { type: "PACKAGE", business: "East Coast Surf Co.", licence: "SLTDA/TA/0233", title: "Surf week: stay, lessons, transfers", place: "Arugam Bay", price: 145000, unit: "PERSON", desc: "7 nights, 10 surf lessons, board hire and airport transfers.", confirm: true },
];

async function main() {
  const brand = await db.brand.upsert({
    where: { slug: "lifetone" },
    update: {},
    create: {
      slug: "lifetone",
      name: "Lifetone",
      tagline: "Sri Lanka, booked locally",
      domains: ["lifetone.online", "www.lifetone.online", "localhost", "lifetone.localhost"],
      color: "#0d6b57",
      bookingPrefix: "LT",
    },
  });

  const platformEmail = (process.env.PLATFORM_ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const ownerEmail = (process.env.BRAND_ADMIN_EMAIL || "owner@example.com").toLowerCase();
  // Platform admin has no brand; Prisma can't upsert on a compound key containing null, so find first.
  if (!(await db.user.findFirst({ where: { brandId: null, email: platformEmail } }))) {
    await db.user.create({ data: { email: platformEmail, name: "DBS Group", role: "PLATFORM_ADMIN" } });
  }
  await db.user.upsert({
    where: { brandId_email: { brandId: brand.id, email: ownerEmail } },
    update: { role: "BRAND_ADMIN" },
    create: { brandId: brand.id, email: ownerEmail, name: "Lifetone admin", role: "BRAND_ADMIN" },
  });

  if ((await db.listing.count({ where: { brandId: brand.id } })) === 0) {
    for (const e of examples) {
      const provider = await db.provider.create({
        data: { brandId: brand.id, business: e.business, type: e.type, licenceNo: e.licence, phone: "+94 70 000 0000", email: `${e.business.toLowerCase().replace(/[^a-z]/g, "")}@example.com`, status: "APPROVED" },
      });
      await db.listing.create({
        data: { brandId: brand.id, providerId: provider.id, type: e.type, title: e.title, place: e.place, description: e.desc, price: rs(e.price), unit: e.unit, needsConfirmation: !!e.confirm, status: "LIVE" },
      });
    }
    await db.update.create({
      data: { brandId: brand.id, audience: "TOURISTS", title: "East coast surf season ends in October", body: "Arugam Bay surf packages run until 31 October. South-coast breaks open from November." },
    });
  }
  console.log(`Seeded brand ${brand.name}. Admin sign-in: ${ownerEmail}. Platform admin: ${platformEmail}.`);
}

main().finally(() => db.$disconnect());
