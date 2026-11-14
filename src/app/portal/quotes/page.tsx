import Link from "next/link";
import type { Prisma, QuoteStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { requireBrandAdmin } from "@/lib/auth";
import { moneyFmt } from "@/lib/money";
import { fmtDate } from "@/lib/labels";
import { QUOTE_STATUS_LABEL, quoteStatusLabel, tripLine } from "@/lib/quotes";

const FILTERS: Array<QuoteStatus | "ALL"> = ["ALL", "NEW", "QUOTED", "ACCEPTED", "DECLINED", "CLOSED"];

export default async function PortalQuotes({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  await requireBrandAdmin();
  const brand = await getBrand();
  const fmt = moneyFmt(brand.currency);
  const status = FILTERS.includes(searchParams.status as QuoteStatus) && searchParams.status !== "ALL" ? (searchParams.status as QuoteStatus) : undefined;
  const q = (searchParams.q || "").trim();
  const where: Prisma.QuoteRequestWhereInput = {
    brandId: brand.id, ...(status ? { status } : {}),
    ...(q ? { OR: [{ ref: { contains: q, mode: "insensitive" } }, { fromPlace: { contains: q, mode: "insensitive" } }, { toPlace: { contains: q, mode: "insensitive" } }, { guest: { email: { contains: q, mode: "insensitive" } } }, { guest: { name: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const rows = await db.quoteRequest.findMany({ where, include: { guest: true }, orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="card stack">
      <form className="row" style={{ justifyContent: "space-between" }}>
        <h2>Quote requests</h2>
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Search ref, guest or place" aria-label="Search quotes" />
      </form>
      <p className="muted" style={{ margin: 0 }}>Bespoke requests from your site's "Request a quote" page. Price one, and the guest can accept and pay online.</p>
      <div className="chips">{FILTERS.map(f => {
        const p = new URLSearchParams(); if (f !== "ALL") p.set("status", f); if (q) p.set("q", q);
        return <Link key={f} className="chip" href={`/portal/quotes?${p}`} aria-current={(status ?? "ALL") === f}>{f === "ALL" ? "All" : QUOTE_STATUS_LABEL[f]}</Link>;
      })}</div>
      <div className="table-wrap"><table>
        <thead><tr><th>Ref</th><th>Guest</th><th>Trip</th><th>Received</th><th>Price</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td className="num"><Link href={`/portal/quotes/${r.ref}`}>{r.ref}</Link></td>
              <td>{r.guest.name}<div className="muted" style={{ fontSize: ".85rem" }}>{r.guest.email}</div></td>
              <td>{tripLine(r)}</td>
              <td className="num">{fmtDate(r.createdAt)}</td>
              <td className="num">{r.price != null ? fmt(r.price) : "–"}</td>
              <td><span className={`pill ${r.status === "NEW" ? "warn" : ""}`}>{quoteStatusLabel(r)}</span></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="muted">No quote requests yet. Guests send them from <strong>/quote</strong> on your site.</td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}
