import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { currentUser } from "@/lib/auth";
import { lkr } from "@/lib/money";
import { PAY_LABEL, STATUS_LABEL, UNIT_LABEL, fmtDate } from "@/lib/labels";
import { cancelBooking, requestDateChange } from "@/lib/bookings";

export const dynamic = "force-dynamic";

const FREE_CANCEL_HOURS = 48;

async function loadMine(ref: string) {
  const user = await currentUser();
  if (!user) redirect(`/signin?next=/bookings/${encodeURIComponent(ref)}`);
  const brand = await getBrand();
  const b = await db.booking.findFirst({
    where: { brandId: brand.id, ref, guestId: user.id },
    include: { listing: { include: { provider: true } }, messages: { orderBy: { createdAt: "asc" } } },
  });
  return { brand, b };
}

export default async function ManageBooking({ params, searchParams }: { params: { ref: string }; searchParams: { done?: string } }) {
  const { b } = await loadMine(params.ref);
  if (!b) notFound();
  const active = ["PENDING_PAYMENT", "REQUESTED", "CONFIRMED"].includes(b.status);
  const canCancel = active && b.startDate.getTime() - Date.now() > FREE_CANCEL_HOURS * 3_600_000;

  async function cancel() {
    "use server";
    const { brand, b } = await loadMine(params.ref);
    if (!b || !["PENDING_PAYMENT", "REQUESTED", "CONFIRMED"].includes(b.status)) return;
    if (b.startDate.getTime() - Date.now() <= FREE_CANCEL_HOURS * 3_600_000) return;
    await cancelBooking(brand, b.id, "cancelled");
    redirect(`/bookings/${b.ref}?done=cancelled`);
  }
  async function changeDate(form: FormData) {
    "use server";
    const { brand, b } = await loadMine(params.ref);
    const date = String(form.get("date") || "");
    if (!b || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= new Date().toISOString().slice(0, 10)) return;
    await requestDateChange(brand, b.id, date);
    redirect(`/bookings/${b.ref}?done=change`);
  }
  async function message(form: FormData) {
    "use server";
    const { b } = await loadMine(params.ref);
    const body = String(form.get("body") || "").trim().slice(0, 2000);
    if (!b || !body) return;
    await db.message.create({ data: { bookingId: b.id, sender: "GUEST", body } });
    revalidatePath(`/bookings/${b.ref}`);
  }

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div><Link href="/bookings" className="btn ghost small">← My bookings</Link></div>
      {searchParams.done === "cancelled" && <div className="notice">Booking cancelled. We've emailed you the details{b.onlineAmount ? " and started your refund" : ""}.</div>}
      {searchParams.done === "change" && <div className="notice">Date change requested. We'll email you when the provider replies.</div>}
      <div className="card stack" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: "space-between" }}><h1>{b.listing.title}</h1><span className="pill">{STATUS_LABEL[b.status]}</span></div>
        <div className="muted num">{b.ref} · {b.listing.place} · provider {b.listing.provider.business}</div>
        <div className="breakdown num">
          <span>Start</span><span>{fmtDate(b.startDate)}</span>
          <span>Quantity</span><span>{b.quantity} {UNIT_LABEL[b.listing.unit].many}</span>
          <span>Total</span><span>{lkr(b.total)}</span>
          <span>Paid by card</span><span>{lkr(b.onlineAmount)}</span>
          {b.cashAmount > 0 && <><span>Cash due on the day</span><span>{lkr(b.cashAmount)}</span></>}
          <span>Payment</span><span>{PAY_LABEL[b.payMethod]}</span>
        </div>
        {b.changeRequestDate && <span className="pill warn">Date change to {fmtDate(b.changeRequestDate)} requested</span>}
      </div>

      {active && (
        <div className="card stack">
          <h2>Change or cancel</h2>
          <form action={changeDate} className="row" style={{ alignItems: "flex-end" }}>
            <label>New start date<input type="date" name="date" required min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)} /></label>
            <button className="btn ghost" type="submit">Request date change</button>
          </form>
          {canCancel ? (
            <form action={cancel}><button className="btn ghost" type="submit">Cancel booking{b.onlineAmount ? ` and refund ${lkr(b.onlineAmount)}` : ""}</button></form>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Free cancellation ends {FREE_CANCEL_HOURS} hours before the start. Message the provider below if you need to cancel.</p>
          )}
        </div>
      )}

      <div className="card stack">
        <h2>Messages</h2>
        <div className="stack" style={{ gap: 8 }}>
          {b.messages.length === 0 && <p className="muted" style={{ margin: 0 }}>Say hello and share your arrival details.</p>}
          {b.messages.map(m => (
            <div key={m.id} className={`msg ${m.sender === "GUEST" ? "mine" : ""}`}>{m.body}<div style={{ fontSize: ".75rem", opacity: .75 }}>{m.sender === "GUEST" ? "You" : b.listing.provider.business} · {m.createdAt.toISOString().slice(0, 16).replace("T", " ")}</div></div>
          ))}
        </div>
        <form action={message} className="row">
          <input name="body" required placeholder="Write a message" aria-label="Message" style={{ flex: 1 }} />
          <button className="btn" type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}
