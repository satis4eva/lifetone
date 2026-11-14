import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { requireBrandAdmin } from "@/lib/auth";
import { moneyFmt } from "@/lib/money";
import { split } from "@/lib/pricing";
import { PAY_LABEL } from "@/lib/labels";

export default async function Payouts() {
  await requireBrandAdmin();
  const brand = await getBrand();
  const fmt = moneyFmt(brand.currency);
  const rows = (await db.booking.findMany({
    where: { brandId: brand.id, status: { in: ["CONFIRMED", "COMPLETED"] } },
    include: { listing: { include: { provider: true } } }, orderBy: { startDate: "desc" },
  })).map(b => ({ b, s: split({ subtotal: b.subtotal, serviceFee: b.serviceFee, cashAmount: b.cashAmount, commissionPct: Number(b.commissionPct), platformFeePct: Number(b.platformFeePct) }) }));

  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  // Balance per provider: positive = we pay them; negative = they owe commission on cash bookings.
  const balances = new Map<string, { name: string; amount: number }>();
  for (const { b, s } of rows) {
    const p = b.listing.provider;
    const cur = balances.get(p.id) ?? { name: p.business, amount: 0 };
    cur.amount += s.providerSettlement;
    balances.set(p.id, cur);
  }

  return (
    <div className="stack">
      <div className="tiles">
        <div className="card"><div className="muted">Taken online</div><div className="big num">{fmt(sum(r => r.b.onlineAmount))}</div></div>
        <div className="card"><div className="muted">Cash collected by providers</div><div className="big num">{fmt(sum(r => r.b.cashAmount))}</div></div>
        <div className="card"><div className="muted">Platform fee</div><div className="big num">{fmt(sum(r => r.s.platformFee))}</div></div>
        <div className="card"><div className="muted">Net to {brand.name}</div><div className="big num">{fmt(sum(r => r.s.brandNet))}</div></div>
      </div>
      <div className="card stack">
        <h2>Provider balances ({brand.settleCurrency})</h2>
        <p className="muted" style={{ margin: 0 }}>Confirmed and completed bookings. When a guest pays cash, the provider already holds the money, so the commission they owe is taken from their next card payout.</p>
        <div className="table-wrap"><table>
          <thead><tr><th>Provider</th><th>Balance</th></tr></thead>
          <tbody>{[...balances.values()].sort((a, b) => a.amount - b.amount).map(p => (
            <tr key={p.name}><td>{p.name}</td><td className="num" style={{ color: p.amount < 0 ? "var(--warn)" : undefined }}>{p.amount < 0 ? `Owes ${fmt(-p.amount)}` : `Due ${fmt(p.amount)}`}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
      <div className="card stack">
        <h2>Split per booking</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Ref</th><th>Payment</th><th>Paid online</th><th>Cash</th><th>Provider</th><th>Your revenue</th><th>Platform fee</th><th>Your net</th></tr></thead>
          <tbody>{rows.map(({ b, s }) => (
            <tr key={b.id} className="num"><td>{b.ref}</td><td>{PAY_LABEL[b.payMethod]}</td><td>{fmt(b.onlineAmount)}</td><td>{fmt(b.cashAmount)}</td>
              <td style={{ color: s.providerSettlement < 0 ? "var(--warn)" : undefined }}>{s.providerSettlement < 0 ? `Owes ${fmt(-s.providerSettlement)}` : fmt(s.providerSettlement)}</td>
              <td>{fmt(s.brandRevenue)}</td><td>{fmt(s.platformFee)}</td><td><strong>{fmt(s.brandNet)}</strong></td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  );
}
