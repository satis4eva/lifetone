import Link from "next/link";
import type { ListingType } from "@prisma/client";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { lkr } from "@/lib/money";
import { TYPE_LABEL, UNIT_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

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
  const chip = (t?: ListingType) => {
    const p = new URLSearchParams(); if (q) p.set("q", q); if (t) p.set("type", t);
    return `/?${p}`;
  };

  return (
    <div className="stack">
      <div>
        <h1>Where in Sri Lanka?</h1>
        <p className="muted">Stays, drivers, transport companies, guides, room shares and sports or business trips from licensed local providers.</p>
      </div>
      {update && <div className="notice"><strong>{update.title}</strong> {update.body}</div>}
      <form className="row" role="search">
        <input name="q" defaultValue={q} placeholder="Try Galle, Ella, Kandy, Arugam Bay…" aria-label="Search by place or keyword" style={{ flex: 1, minWidth: 200 }} />
        {type && <input type="hidden" name="type" value={type} />}
        <button className="btn" type="submit">Search</button>
      </form>
      <div className="chips" aria-label="Type">
        <Link className="chip" href={chip()} aria-current={!type}>All</Link>
        {(Object.keys(TYPE_LABEL) as ListingType[]).map(t => (
          <Link key={t} className="chip" href={chip(t)} aria-current={type === t}>{TYPE_LABEL[t]}</Link>
        ))}
      </div>
      <p className="muted num">{listings.length} result{listings.length === 1 ? "" : "s"}</p>
      <div className="grid">
        {listings.map(l => (
          <Link key={l.id} href={`/listings/${l.id}`} className="listing">
            <div className="band"><span>{l.place}</span><span>{TYPE_LABEL[l.type]}</span></div>
            <div className="l-body">
              <h3>{l.title}</h3>
              <div className="row" style={{ gap: 6 }}>
                <span className="pill">Licence checked</span>
                {l.reviewCount > 0 && <span className="num">★ {Number(l.rating).toFixed(1)} <span className="muted">({l.reviewCount})</span></span>}
              </div>
              <div className="num" style={{ marginTop: "auto", fontWeight: 600 }}>{lkr(l.price)} <span className="muted" style={{ fontWeight: 400 }}>/ {UNIT_LABEL[l.unit].one}</span></div>
            </div>
          </Link>
        ))}
        {listings.length === 0 && <div className="card muted">No listings match. Try another place or type.</div>}
      </div>
    </div>
  );
}
