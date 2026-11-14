import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { requireBrandAdmin } from "@/lib/auth";
import { lkr } from "@/lib/money";
import { split } from "@/lib/pricing";
import { PAY_LABEL, STATUS_LABEL, UNIT_LABEL, fmtDate } from "@/lib/labels";
import { bookingAction, replyToGuest } from "../../actions";

export default async function PortalBooking({ params }: { params: { ref: string } }) {
  await requireBrandAdmin();
  const brand = await getBrand();
  const b = await db.booking.findFirst({
    where: { brandId: brand.id, ref: params.ref },
    include: { listing: { include: { provider: true } }, guest: true, messages: { orderBy: { createdAt: "asc" } }, payments: true },
  });
  if (!b) notFound();
  const s = split({ subtotal: b.subtotal, serviceFee: b.serviceFee, cashAmount: b.cashAmount, commissionPct: Number(b.commissionPct), platformFeePct: Number(b.platformFeePct) });

  return (
    <div className="stack">
      <div><Link href="/portal/bookings" className="btn ghost small">← All bookings</Link></div>
      <div className="detail">
        <div className="card stack" style={{ gap: 8 }}>
          <div className="row" style={{ justifyContent: "space-between" }}><h2>{b.ref}: {b.listing.title}</h2><span className="pill">{STATUS_LABEL[b.status]}</span></div>
          <div className="muted">{b.guest.name} · {b.guest.email} · provider {b.listing.provider.business} ({b.listing.provider.phone})</div>
          <div className="breakdown num">
            <span>Start</span><span>{fmtDate(b.startDate)}</span>
            <span>Quantity</span><span>{b.quantity} {UNIT_LABEL[b.listing.unit].many}</span>
            <span>Payment</span><span>{PAY_LABEL[b.payMethod]}</span>
            <span>Guest total</span><span>{lkr(b.total)}</span>
            <span>Paid online</span><span>{lkr(b.onlineAmount)}</span>
            <span>Cash to provider</span><span>{lkr(b.cashAmount)}</span>
            <span>Provider settlement</span><span>{s.providerSettlement < 0 ? `Owes ${lkr(-s.providerSettlement)}` : lkr(s.providerSettlement)}</span>
            <span>Your revenue</span><span>{lkr(s.brandRevenue)}</span>
            <span>Platform fee ({Number(b.platformFeePct)}%)</span><span>{lkr(s.platformFee)}</span>
            <span className="total">Your net</span><span className="total">{lkr(s.brandNet)}</span>
          </div>
          <form action={bookingAction} className="row">
            <input type="hidden" name="id" value={b.id} />
            {b.status === "REQUESTED" && <><button className="btn" name="action" value="confirm">Confirm</button><button className="btn ghost" name="action" value="decline">Decline</button></>}
            {b.status === "CONFIRMED" && <><button className="btn ghost" name="action" value="complete">Mark completed</button><button className="btn ghost" name="action" value="cancel">Cancel and refund</button></>}
            {b.changeRequestDate && <><span className="pill warn">Wants {fmtDate(b.changeRequestDate)}</span><button className="btn small" name="action" value="acceptChange">Accept date</button><button className="btn ghost small" name="action" value="declineChange">Decline date</button></>}
          </form>
        </div>
        <div className="card stack">
          <h2>Messages with the guest</h2>
          {b.messages.length === 0 && <p className="muted" style={{ margin: 0 }}>No messages yet.</p>}
          {b.messages.map(m => <div key={m.id} className={`msg ${m.sender !== "GUEST" ? "mine" : ""}`}>{m.body}<div style={{ fontSize: ".75rem", opacity: .75 }}>{m.sender === "GUEST" ? b.guest.name : "You"} · {m.createdAt.toISOString().slice(0, 16).replace("T", " ")}</div></div>)}
          <form action={replyToGuest} className="row">
            <input type="hidden" name="id" value={b.id} />
            <input name="body" required placeholder="Reply (the guest is emailed)" aria-label="Reply" style={{ flex: 1 }} />
            <button className="btn" type="submit">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
