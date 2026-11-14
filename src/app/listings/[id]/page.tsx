import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { lkr, pct } from "@/lib/money";
import { TYPE_LABEL, UNIT_LABEL } from "@/lib/labels";
import BookingForm from "./BookingForm";
import ListingArt from "@/components/ListingArt";

export const dynamic = "force-dynamic";

export default async function ListingPage({ params }: { params: { id: string } }) {
  const brand = await getBrand();
  const l = await db.listing.findFirst({ where: { id: params.id, brandId: brand.id, status: "LIVE" }, include: { provider: true } });
  if (!l) notFound();
  return (
    <div className="stack">
      <div><Link href="/" className="btn ghost small">← Back to results</Link></div>
      <div className="detail">
        <div className="stack">
          <div className="detail-hero">
            <ListingArt type={l.type} />
            <div><span className="tag" style={{ position: "static" }}>{TYPE_LABEL[l.type]}</span><h1 style={{ color: "#fff", marginTop: 8 }}>{l.title}</h1><div style={{ fontWeight: 700 }}>{l.place}</div></div>
          </div>
          <div className="card stack" style={{ gap: 8 }}>
            <p style={{ margin: 0 }}>{l.description}</p>
            <p className="muted" style={{ margin: 0 }}>Provider: <strong>{l.provider.business}</strong> · Licence: <span className="num">{l.provider.licenceNo}</span></p>
            {l.needsConfirmation && <p className="muted" style={{ margin: 0 }}>The provider confirms this booking before it's final.</p>}
          </div>
        </div>
        <div className="card stack">
          <div className="num" style={{ fontSize: "1.3rem", fontWeight: 700 }}>{lkr(l.price)} <span className="muted" style={{ fontSize: "1rem", fontWeight: 400 }}>/ {UNIT_LABEL[l.unit].one}</span></div>
          <BookingForm
            listing={{ id: l.id, price: l.price, unit: l.unit, type: l.type }}
            brand={{ serviceFeePct: pct(brand.serviceFeePct), depositPct: brand.depositPct, allowCash: brand.allowCash }}
          />
        </div>
      </div>
    </div>
  );
}
