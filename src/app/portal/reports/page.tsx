import { getBrand } from "@/lib/brand";
import { requireBrandAdmin } from "@/lib/auth";
import { moneyFmt } from "@/lib/money";
import { monthlyReport, validMonth } from "@/lib/reports";

export default async function Reports({ searchParams }: { searchParams: { month?: string } }) {
  await requireBrandAdmin();
  const brand = await getBrand();
  const fmt = moneyFmt(brand.currency);
  const month = validMonth(searchParams.month);
  const r = await monthlyReport(brand.id, month, brand.currency);
  const t = r.totals;
  return (
    <div className="stack">
      <form className="card row" style={{ justifyContent: "space-between" }}>
        <div><h2>Income report: {r.label}</h2><p className="muted" style={{ margin: "4px 0 0" }}>Bookings made this month that are confirmed or completed.</p></div>
        <div className="row">
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>Month<input type="month" name="month" defaultValue={month} /></label>
          <button className="btn ghost" type="submit">Show</button>
          <a className="btn" href={`/portal/reports/export?month=${month}&format=xlsx`}>Download Excel</a>
          <a className="btn" href={`/portal/reports/export?month=${month}&format=pdf`}>Download PDF</a>
        </div>
      </form>
      <div className="tiles">
        <div className="card"><div className="muted">Bookings</div><div className="big num">{t.bookings}</div></div>
        <div className="card"><div className="muted">Guests paid</div><div className="big num">{fmt(t.total)}</div><div className="muted num" style={{ fontSize: ".85rem" }}>{fmt(t.online)} online · {fmt(t.cash)} cash</div></div>
        <div className="card"><div className="muted">Brand revenue</div><div className="big num">{fmt(t.brandRevenue)}</div><div className="muted num" style={{ fontSize: ".85rem" }}>{fmt(t.commission)} commission · {fmt(t.serviceFee)} fees</div></div>
        <div className="card"><div className="muted">Platform fee</div><div className="big num">{fmt(t.platformFee)}</div></div>
        <div className="card"><div className="muted">Net income</div><div className="big num">{fmt(t.brandNet)}</div></div>
      </div>
      <p className="muted" style={{ margin: 0 }}>Cancelled or declined this month: {r.cancelled.count}{r.cancelled.refunded ? `, ${fmt(r.cancelled.refunded)} refunded` : ""}.</p>
      <div className="card table-wrap"><table>
        <thead><tr><th>Ref</th><th>Booked</th><th>Guest</th><th>Listing</th><th>Payment</th><th>Guest paid</th><th>Online</th><th>Cash</th><th>Revenue</th><th>Platform fee</th><th>Net</th></tr></thead>
        <tbody>
          {r.rows.map(x => (
            <tr key={x.ref} className="num"><td>{x.ref}</td><td>{x.bookedOn}</td><td>{x.guest}</td><td>{x.listing}</td><td>{x.payMethod}</td>
              <td>{fmt(x.total)}</td><td>{fmt(x.online)}</td><td>{fmt(x.cash)}</td><td>{fmt(x.brandRevenue)}</td><td>{fmt(x.platformFee)}</td><td><strong>{fmt(x.brandNet)}</strong></td></tr>
          ))}
          {r.rows.length === 0 && <tr><td colSpan={11} className="muted">No confirmed bookings in {r.label}.</td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}
