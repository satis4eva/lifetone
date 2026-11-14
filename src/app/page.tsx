import Link from "next/link";
import type { ListingType } from "@prisma/client";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { moneyFmt } from "@/lib/money";
import { TYPE_LABEL, UNIT_LABEL } from "@/lib/labels";
import ListingImage from "@/components/ListingImage";
import { countryOf } from "@/lib/country";

export const dynamic = "force-dynamic";

const SHORT: Record<ListingType, string> = { STAY: "Stay", DRIVER: "Driver", TRANSPORT: "Transport", GUIDE: "Guide", SHARE: "Room share", PACKAGE: "Package", WELLNESS: "Spa" };



export default async function Explore({ searchParams }: { searchParams: { q?: string; type?: string } }) {
  const brand = await getBrand();
  const fmt = moneyFmt(brand.currency);
  const country = countryOf(brand.country);
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
      <section className="hero" style={brand.heroImageUrl ? { backgroundImage: `linear-gradient(160deg, rgba(0,0,0,.45), rgba(0,0,0,.25)), url("${brand.heroImageUrl}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
        <div className="hero-in">
          <h1>{brand.heroTitle || country.heroTitle}</h1>
          <p>{brand.heroText || country.heroText}</p>
          <form className="search" role="search" action="/#results">
            <label htmlFor="q">Where<input id="q" name="q" defaultValue={q} placeholder={country.searchPlaceholder} /></label>
            <label htmlFor="type">What<select id="type" name="type" defaultValue={type ?? ""}>
              <option value="">Anything</option>
              {(Object.keys(TYPE_LABEL) as ListingType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select></label>
            <button className="btn" type="submit">Search</button>
          </form>
          <p style={{ margin: "12px 0 0" }}>Need something bespoke? <Link href="/quote" style={{ color: "inherit", fontWeight: 700, textDecoration: "underline" }}>Request a quote</Link></p>
        </div>
        <svg className="wave" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30c120 22 240 22 360 6s240-30 360-14 240 34 360 22 240-34 360-22v32H0z" fill="var(--sand)" /><rect y="48" width="1440" height="16" fill="var(--sand)" /></svg>
      </section>

      {update && <div className="update"><span className="dot" aria-hidden="true" /><div><strong>{update.title}.</strong> {update.body}</div></div>}

      {!filtered && (
        <section className="stack" style={{ gap: 14 }} aria-labelledby="dest-h">
          <div className="section-head"><h2 id="dest-h">Popular right now</h2></div>
          <div className="dest">
            {country.destinations.map(d => (
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
              <div className="art"><ListingImage type={l.type} imageUrl={l.imageUrl} alt="" /><span className="tag">{SHORT[l.type]}</span></div>
              <div className="l-body">
                <span className="place">{l.place}</span>
                <h3>{l.title}</h3>
                <span className="verified">✓ Licence checked</span>
                <div className="l-meta num">
                  <span>{fmt(l.price)} <span className="unit">/ {UNIT_LABEL[l.unit].one}</span></span>
                  {l.reviewCount > 0 && <span>★ {Number(l.rating).toFixed(1)}</span>}
                </div>
              </div>
            </Link>
          ))}
          {listings.length === 0 && <div className="card muted">No listings match. Try another place or type, <Link href="/">show everything</Link>, or <Link href={`/quote?${new URLSearchParams({ ...(q ? { q } : {}), ...(type ? { type } : {}) })}`}>tell us what you need and get a quote</Link>.</div>}
          {listings.length > 0 && filtered && <div className="card muted">Not quite right? <Link href={`/quote?${new URLSearchParams({ ...(q ? { q } : {}), ...(type ? { type } : {}) })}`}>Request a quote</Link> and we'll find it for you.</div>}
        </div>
      </section>

      {!filtered && (
        <section className="promo">
          <div className="dark"><h2>Need something bespoke?</h2><p>A custom route, a bigger group or dates that don&apos;t fit? Tell us what you need and we&apos;ll come back with a price. Nothing to pay until you accept.</p><Link className="btn sun" href="/quote">Request a quote</Link></div>
          <div className="soft"><h2>Pay your way</h2><p>{brand.allowCash ? "Card now, a small deposit with the rest in cash, or cash on the day." : "Pay securely by card."} Free cancellation up to 48 hours before.</p><Link className="btn" href="#results">Start exploring</Link></div>
        </section>
      )}
    </div>
  );
}
