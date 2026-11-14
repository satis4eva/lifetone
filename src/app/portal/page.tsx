import Link from "next/link";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { requireBrandAdmin } from "@/lib/auth";
import { lkr } from "@/lib/money";
import { split } from "@/lib/pricing";
import { TYPE_LABEL, fmtDate } from "@/lib/labels";
import { bookingAction, listingAction } from "./actions";

export default async function Overview() {
  await requireBrandAdmin();
  const brand = await getBrand();
  const [active, requests, changes, pending] = await Promise.all([
    db.booking.findMany({ where: { brandId: brand.id, status: { in: ["CONFIRMED", "COMPLETED"] } } }),
    db.booking.findMany({ where: { brandId: brand.id, status: "REQUESTED" }, include: { listing: true, guest: true }, orderBy: { createdAt: "asc" } }),
    db.booking.findMany({ where: { brandId: brand.id, changeRequestDate: { not: null } }, include: { listing: true, guest: true } }),
    db.listing.findMany({ where: { brandId: brand.id, status: "PENDING" }, include: { provider: true } }),
  ]);
  const t = active.reduce((a, b) => {
    const s = split({ subtotal: b.subtotal, serviceFee: b.serviceFee, cashAmount: b.cashAmount, commissionPct: Number(b.commissionPct), platformFeePct: Number(b.platformFeePct) });
    return { gmv: a.gmv + b.subtotal, net: a.net + s.brandNet };
  }, { gmv: 0, net: 0 });
  const todo = requests.length + changes.length + pending.length;

  return (
    <div className="stack">
      <div className="tiles">
        <div className="card"><div className="muted">Confirmed bookings</div><div className="big num">{active.length}</div></div>
        <div className="card"><div className="muted">Booking value</div><div className="big num">{lkr(t.gmv)}</div></div>
        <div className="card"><div className="muted">Your revenue</div><div className="big num">{lkr(t.net)}</div><div className="muted" style={{ fontSize: ".85rem" }}>after platform fee</div></div>
        <div className="card"><div className="muted">Needs action</div><div className="big num" style={{ color: todo ? "var(--warn)" : undefined }}>{todo}</div></div>
      </div>
      <div className="card stack" style={{ gap: 0 }}>
        <h2 style={{ marginBottom: 8 }}>Needs your action</h2>
        {requests.map(b => (
          <form key={b.id} action={bookingAction} className="row" style={{ justifyContent: "space-between", borderTop: "1px solid var(--line)", padding: "10px 0" }}>
            <div><strong>Booking request <Link href={`/portal/bookings/${b.ref}`}>{b.ref}</Link></strong><div className="muted num">{b.guest.name} · {b.listing.title} · from {fmtDate(b.startDate)} · {lkr(b.total)}</div></div>
            <input type="hidden" name="id" value={b.id} />
            <div className="row"><button className="btn small" name="action" value="confirm">Confirm</button><button className="btn ghost small" name="action" value="decline">Decline</button></div>
          </form>
        ))}
        {changes.map(b => (
          <form key={b.id} action={bookingAction} className="row" style={{ justifyContent: "space-between", borderTop: "1px solid var(--line)", padding: "10px 0" }}>
            <div><strong>Date change <Link href={`/portal/bookings/${b.ref}`}>{b.ref}</Link></strong><div className="muted num">{b.guest.name} · {b.listing.title} · {fmtDate(b.startDate)} to {fmtDate(b.changeRequestDate!)}</div></div>
            <input type="hidden" name="id" value={b.id} />
            <div className="row"><button className="btn small" name="action" value="acceptChange">Accept</button><button className="btn ghost small" name="action" value="declineChange">Decline</button></div>
          </form>
        ))}
        {pending.map(l => (
          <form key={l.id} action={listingAction} className="row" style={{ justifyContent: "space-between", borderTop: "1px solid var(--line)", padding: "10px 0" }}>
            <div><strong>New provider: {l.title}</strong><div className="muted num">{TYPE_LABEL[l.type]} · {l.place} · {l.provider.business} · Licence {l.provider.licenceNo} · {l.provider.phone}</div></div>
            <input type="hidden" name="id" value={l.id} />
            <div className="row"><button className="btn small" name="action" value="approve">Approve</button><button className="btn ghost small" name="action" value="reject">Reject</button></div>
          </form>
        ))}
        {todo === 0 && <p className="muted" style={{ margin: 0 }}>All caught up.</p>}
      </div>
    </div>
  );
}
