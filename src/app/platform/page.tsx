import Link from "next/link";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { split } from "@/lib/pricing";

export const metadata = { title: "Brands" };

export default async function PlatformHome() {
  await requirePlatformAdmin();
  const brands = await db.brand.findMany({
    include: { bookings: { where: { status: { in: ["CONFIRMED", "COMPLETED"] } } }, _count: { select: { listings: true } } },
    orderBy: { name: "asc" },
  });
  const rows = brands.map(br => {
    const t = br.bookings.reduce((a, b) => {
      const s = split({ subtotal: b.subtotal, serviceFee: b.serviceFee, cashAmount: b.cashAmount, commissionPct: Number(b.commissionPct), platformFeePct: Number(b.platformFeePct) });
      return { gmv: a.gmv + b.subtotal, rev: a.rev + s.brandRevenue, fee: a.fee + s.platformFee };
    }, { gmv: 0, rev: 0, fee: 0 });
    return { br, ...t };
  });
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}><h1>Brands</h1><Link className="btn" href="/brands/new">New brand</Link></div>
      <div className="tiles">
        <div className="card"><div className="muted">Brands</div><div className="big num">{brands.length}</div></div>
        {[...new Set(rows.map(r => r.br.currency))].map(cur => (
          <div key={cur} className="card"><div className="muted">Platform fees earned ({cur})</div><div className="big num">{formatMoney(rows.filter(r => r.br.currency === cur).reduce((a, r) => a + r.fee, 0), cur)}</div></div>
        ))}
      </div>
      <div className="card table-wrap"><table>
        <thead><tr><th>Brand</th><th>Country</th><th>Domains</th><th>Status</th><th>Listings</th><th>Bookings</th><th>Booking value</th><th>Brand revenue</th><th>Fee</th><th>Platform fee</th><th></th></tr></thead>
        <tbody>{rows.map(({ br, gmv, rev, fee }) => (
          <tr key={br.id} className="num">
            <td><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: br.color, marginRight: 8 }} />{br.name}</td>
            <td>{br.country}</td>
            <td>{br.domains.filter(d => !d.includes("localhost")).join(", ") || "none"}</td>
            <td>{br.active ? <span className="pill">Live</span> : <span className="pill warn">Switched off</span>}</td>
            <td>{br._count.listings}</td><td>{br.bookings.length}</td><td>{formatMoney(gmv, br.currency)}</td><td>{formatMoney(rev, br.currency)}</td><td>{Number(br.platformFeePct)}%</td><td><strong>{formatMoney(fee, br.currency)}</strong></td>
            <td><Link className="btn ghost small" href={`/brands/${br.id}`}>Edit</Link></td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}
