import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { lkr } from "@/lib/money";
import { split } from "@/lib/pricing";

export const metadata = { title: "Platform" };
export const dynamic = "force-dynamic";

// Platform owner (DBS Group) view across all brands, including the platform fee owed by each.
export default async function Admin() {
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
  const totalFee = rows.reduce((a, r) => a + r.fee, 0);
  return (
    <div className="stack">
      <h1>Platform overview</h1>
      <div className="tiles">
        <div className="card"><div className="muted">Brands</div><div className="big num">{brands.length}</div></div>
        <div className="card"><div className="muted">Platform fees earned</div><div className="big num">{lkr(totalFee)}</div></div>
      </div>
      <div className="card table-wrap"><table>
        <thead><tr><th>Brand</th><th>Domains</th><th>Listings</th><th>Bookings</th><th>Booking value</th><th>Brand revenue</th><th>Fee rate</th><th>Platform fee</th></tr></thead>
        <tbody>{rows.map(({ br, gmv, rev, fee }) => (
          <tr key={br.id} className="num"><td>{br.name}</td><td>{br.domains.join(", ")}</td><td>{br._count.listings}</td><td>{br.bookings.length}</td><td>{lkr(gmv)}</td><td>{lkr(rev)}</td><td>{Number(br.platformFeePct)}%</td><td><strong>{lkr(fee)}</strong></td></tr>
        ))}</tbody>
      </table></div>
      <p className="muted">To add a brand, create it in the database with its domains (see README). A brand admin screen for this comes later.</p>
    </div>
  );
}
