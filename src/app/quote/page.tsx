import Link from "next/link";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { TYPE_LABEL } from "@/lib/labels";
import QuoteForm from "./QuoteForm";

export const metadata = { title: "Request a quote" };
export const dynamic = "force-dynamic";

export default async function RequestQuote({ searchParams }: { searchParams: { listing?: string; type?: string; q?: string; sent?: string } }) {
  const brand = await getBrand();
  if (searchParams.sent) {
    return (
      <div className="card stack" style={{ maxWidth: 640 }}>
        <h1>Request sent</h1>
        <p style={{ margin: 0 }}>Thanks. Your reference is <strong className="num">{searchParams.sent}</strong>. We'll find the right service and email you a price, usually within 24 hours.</p>
        <p className="muted" style={{ margin: 0 }}>We've emailed you a link to follow your request.</p>
        <div><Link className="btn ghost" href="/">Back to explore</Link></div>
      </div>
    );
  }
  const listing = searchParams.listing
    ? await db.listing.findFirst({ where: { id: searchParams.listing, brandId: brand.id, status: "LIVE" } })
    : null;
  const type = listing?.type ?? (searchParams.type && searchParams.type in TYPE_LABEL ? searchParams.type : undefined);
  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <div>
        <h1>Request a quote</h1>
        <p className="muted" style={{ margin: "4px 0 0" }}>Can't find exactly what you need? Tell us about your trip and {brand.name} will come back with a price. No payment until you accept.</p>
      </div>
      <div className="card">
        <QuoteForm
          types={Object.entries(TYPE_LABEL)}
          defaults={{ type, from: listing?.place ?? searchParams.q, details: listing ? `Something like "${listing.title}", but…` : undefined }}
          labels={{ from: "Pickup from", to: "Drop-off / destination" }}
        />
      </div>
    </div>
  );
}
