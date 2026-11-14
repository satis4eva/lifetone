import Link from "next/link";
import type { ListingType } from "@prisma/client";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { lkr } from "@/lib/money";
import { TYPE_LABEL, UNIT_LABEL } from "@/lib/labels";
import ListingArt from "@/components/ListingArt";

export const dynamic = "force-dynamic";

const SHORT: Record<ListingType, string> = { STAY: "Stay", DRIVER: "Driver", TRANSPORT: "Transport", GUIDE: "Guide", SHARE: "Room share", PACKAGE: "Package", WELLNESS: "Spa" };

const DESTINATIONS: Array<{ name: string; note: string; svg: string }> = [
  { name: "Galle", note: "Fort stays and beaches", svg: '<rect width="200" height="150" fill="#0e8f86"/><circle cx="160" cy="34" r="20" fill="#ffc145"/><path d="M0 95c40-12 80-12 120 0s60 10 80 4v51H0z" fill="#13b5a6"/><path d="M0 118c50-10 100-10 200 2v30H0z" fill="#ffe2b8"/>' },
  { name: "Ella", note: "Tea country", svg: '<rect width="200" height="150" fill="#3fa34d"/><path d="M0 80c30-30 60-30 90-6s60 20 110-14v90H0z" fill="#2e8a3d"/><path d="M0 110c40-20 80-16 120-2s60 6 80-6v48H0z" fill="#21702f"/>' },
  { name: "Arugam Bay", note: "Surf weeks", svg: '<rect width="200" height="150" fill="#ff8a5c"/><circle cx="100" cy="88" r="38" fill="#ffc145"/><path d="M0 100c30-8 60-8 90 0s70 8 110 0v50H0z" fill="#0e8f86"/>' },
  { name: "Sigiriya", note: "Ancient rock fortress", svg: '<rect width="200" height="150" fill="#6aa9d8"/><path d="M70 150V70c0-14 10-24 30-24s30 10 30 24v80z" fill="#8a5a3c"/><path d="M0 120c50-12 150-12 200 0v30H0z" fill="#3fa34d"/>' },
];

export default async function Explore({ searchParams }: { searchParams: { q?: string; type?: string } }) {
  const brand = await getBrand();
  const q = (searchParams.q || "").trim();
  const type = searchParams.type && searchParams.type in TYPE_LABEL ? (searchParams.type as ListingType) : undefined;
  const [listings, update] = await Promise.all([
    db.listing.findMany({
      where: {
        brandId: brand.id, status: "LIVE", ...(type ? { type } : {}),
        ...(q ? { OR: [{ place: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: [{ reviewCount: "desc" }, { createdAt: "desc" }],
      take: 60,
    }),
    db.update.findFirst({ where: { brandId: brand.id, audience: "TOURISTS" }, orderBy: { createdAt: "desc" } }),
  ]);
  const href = (t?: ListingType, place = q) => {
    const p = new URLSearchParams(); if (place) p.set("q", place); if (t) p.set("type", t);
    const s = p.toString();
    return s ? `/?${s}#results` : "/#results";
  };
  const filtered = !!(q || type);

  return (
    <div className="stack" style={{ gap: 28 }}>
      <section className="hero">
        <div className="hero-in">
          <h1>Your island escape, booked with locals</h1>
          <p>Beach stays, tea-country bungalows, drivers, guides, transport, surf weeks and Ayurveda spas from licensed Sri Lankan providers.</p>
          <form className="search" role="search" action="/#results">
            <label htmlFor="q">Where<input id="q" name="q" defaultValue={q} placeholder="Galle, Ella, Arugam Bay…" /></label>
            <label htmlFor="type">What<select id="type" name="type" defaultValue={type ?? ""}>
              <option value="">Anything</option>
              {(Object.keys(TYPE_LABEL) as ListingType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select></label>
            <button className="btn" type="submit">Search</button>
          </form>
        </div>
        <svg className="wave" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30c120 22 240 22 360 6s240-30 360-14 240 34 360 22 240-34 360-22v32H0z" fill="var(--sand)" /><rect y="48" width="1440" height="16" fill="var(--sand)" /></svg>
      </section>

      {update && <div className="update"><span className="dot" aria-hidden="true" /><div><strong>{update.title}.</strong> {update.body}</div></div>}

      {!filtered && (
        <section className="stack" style={{ gap: 14 }} aria-labelledby="dest-h">
          <div className="section-head"><h2 id="dest-h">Popular right now</h2></div>
          <div className="dest">
            {DESTINATIONS.map(d => (
              <Link key={d.name} href={href(undefined, d.name)}>
                <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d.svg }} />
                <span>{d.name}<small>{d.note}</small></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="stack" style={{ gap: 14 }} aria-labelledby="list-h" id="results">
        <div className="section-head">
          <h2 id="list-h">{q ? `Results for “${q}”` : "Book with local providers"}</h2>
          <span className="muted num" style={{ fontWeight: 700 }}>{listings.length} result{listings.length === 1 ? "" : "s"}</span>
        </div>
        <div className="chips" aria-label="Type">
          <Link className="chip" href={href()} aria-current={!type}>All</Link>
          {(Object.keys(TYPE_LABEL) as ListingType[]).map(t => (
            <Link key={t} className="chip" href={href(t)} aria-current={type === t}>{TYPE_LABEL[t]}</Link>
          ))}
        </div>
        <div className="grid">
          {listings.map(l => (
            <Link key={l.id} href={`/listings/${l.id}`} className="listing">
              <div className="art"><ListingArt type={l.type} /><span className="tag">{SHORT[l.type]}</span></div>
              <div className="l-body">
                <span className="place">{l.place}</span>
                <h3>{l.title}</h3>
                <span className="verified">✓ Licence checked</span>
                <div className="l-meta num">
                  <span>{lkr(l.price)} <span className="unit">/ {UNIT_LABEL[l.unit].one}</span></span>
                  {l.reviewCount > 0 && <span>★ {Number(l.rating).toFixed(1)}</span>}
                </div>
              </div>
            </Link>
          ))}
          {listings.length === 0 && <div className="card muted">No listings match. Try another place or type. <Link href="/">Show everything</Link></div>}
        </div>
      </section>

      {!filtered && (
        <section className="promo">
          <div className="dark"><h2>Run a guesthouse, van or tour?</h2><p>List your service free. Licensed drivers, guides, transport companies and stays get bookings from travellers worldwide, and pay commission only when booked.</p><Link className="btn sun" href="/providers/join">List your service</Link></div>
          <div className="soft"><h2>Pay your way</h2><p>{brand.allowCash ? "Card now, a small deposit with the rest in cash, or cash on the day." : "Pay securely by card."} Free cancellation up to 48 hours before.</p><Link className="btn" href="#results">Start exploring</Link></div>
        </section>
      )}
    </div>
  );
}
