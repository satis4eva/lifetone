import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { PayMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { currentUser } from "@/lib/auth";
import { moneyFmt } from "@/lib/money";
import { fmtDate } from "@/lib/labels";
import { quote as priceQuote } from "@/lib/pricing";
import { acceptQuote, emailQuoteBrand, isExpired, quoteStatusLabel, tripLine } from "@/lib/quotes";

export const dynamic = "force-dynamic";

async function loadMine(ref: string) {
  const user = await currentUser();
  if (!user) redirect(`/signin?next=/quotes/${encodeURIComponent(ref)}`);
  const brand = await getBrand();
  const q = await db.quoteRequest.findFirst({
    where: { brandId: brand.id, ref, guestId: user.id },
    include: { guest: true, booking: true, messages: { orderBy: { createdAt: "asc" } } },
  });
  return { brand, q };
}

export default async function MyQuote({ params, searchParams }: { params: { ref: string }; searchParams: { error?: string; done?: string } }) {
  const { brand: br, q } = await loadMine(params.ref);
  if (!q) notFound();
  const fmt = moneyFmt(br.currency);
  const open = q.status === "QUOTED" && !isExpired(q) && q.price != null;
  const cashOk = br.allowCash && q.allowCash;
  const opt = (payMethod: PayMethod) => priceQuote({ unitPrice: q.price ?? 0, quantity: 1, serviceFeePct: Number(br.serviceFeePct), payMethod, depositPct: br.depositPct });
  const card = opt("CARD");

  async function accept(form: FormData) {
    "use server";
    const { brand, q } = await loadMine(params.ref);
    if (!q) return;
    const r = await acceptQuote(brand, q.id, String(form.get("payMethod")) as PayMethod);
    if ("error" in r) redirect(`/quotes/${q.ref}?error=${encodeURIComponent(r.error)}`);
    redirect(r.url);
  }
  async function decline() {
    "use server";
    const { brand, q } = await loadMine(params.ref);
    if (!q) return;
    const ok = await db.quoteRequest.updateMany({ where: { id: q.id, status: { in: ["NEW", "QUOTED"] } }, data: { status: "DECLINED" } });
    if (ok.count === 1) await emailQuoteBrand(brand, q, "declined");
    redirect(`/quotes/${q.ref}?done=declined`);
  }
  async function message(form: FormData) {
    "use server";
    const { brand, q } = await loadMine(params.ref);
    const body = String(form.get("body") || "").trim().slice(0, 2000);
    if (!q || !body) return;
    await db.message.create({ data: { quoteId: q.id, sender: "GUEST", body } });
    await emailQuoteBrand(brand, q, "message", body);
    revalidatePath(`/quotes/${q.ref}`);
  }

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div><Link href="/bookings" className="btn ghost small">← My bookings</Link></div>
      {searchParams.error && <div className="notice error" role="alert">{searchParams.error}</div>}
      {searchParams.done === "declined" && <div className="notice">Thanks for letting us know. Send a message any time if you change your mind.</div>}
      <div className="card stack" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: "space-between" }}><h1>Quote {q.ref}</h1><span className="pill">{quoteStatusLabel(q)}</span></div>
        <div className="muted">{tripLine(q)}</div>
        {q.details && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{q.details}</p>}
        {q.status === "NEW" && <p className="muted" style={{ margin: 0 }}>We're finding the right service for you. We'll email you as soon as your price is ready.</p>}
        {q.booking && <p style={{ margin: 0 }}>Booked as <Link href={`/bookings/${q.booking.ref}`} className="num">{q.booking.ref}</Link>.</p>}
      </div>

      {q.price != null && q.status !== "NEW" && q.status !== "CLOSED" && (
        <div className="card stack">
          <h2>Your price</h2>
          <div className="breakdown num">
            <span>Price</span><span>{fmt(card.subtotal)}</span>
            {card.serviceFee > 0 && <><span>Service fee</span><span>{fmt(card.serviceFee)}</span></>}
            <span className="total">Total</span><span className="total">{fmt(card.total)}</span>
          </div>
          {q.included && <p style={{ margin: 0 }}><strong>Includes:</strong> {q.included}</p>}
          {q.validUntil && <p className="muted" style={{ margin: 0 }}>{isExpired(q) ? "Expired on" : "Valid until"} {fmtDate(q.validUntil)}.</p>}
          {open && (
            <>
              <form action={accept} className="stack" style={{ gap: 8 }}>
                <label className="row" style={{ gap: 8 }}><input type="radio" name="payMethod" value="CARD" defaultChecked style={{ width: "auto" }} /> Pay {fmt(card.total)} by card now</label>
                {cashOk && <label className="row" style={{ gap: 8 }}><input type="radio" name="payMethod" value="DEPOSIT" style={{ width: "auto" }} /> Pay a {br.depositPct}% deposit ({fmt(opt("DEPOSIT").onlineAmount)}) now, the rest in cash</label>}
                {cashOk && <label className="row" style={{ gap: 8 }}><input type="radio" name="payMethod" value="CASH" style={{ width: "auto" }} /> Pay everything in cash on the day</label>}
                <div><button className="btn" type="submit">Accept and book</button></div>
              </form>
              <form action={decline}><button className="btn ghost small" type="submit">No thanks</button></form>
            </>
          )}
        </div>
      )}

      <div className="card stack">
        <h2>Messages</h2>
        {q.messages.length === 0 && <p className="muted" style={{ margin: 0 }}>Questions about the price or the trip? Ask here.</p>}
        {q.messages.map(m => (
          <div key={m.id} className={`msg ${m.sender === "GUEST" ? "mine" : ""}`}>{m.body}<div style={{ fontSize: ".75rem", opacity: .75 }}>{m.sender === "GUEST" ? "You" : br.name} · {m.createdAt.toISOString().slice(0, 16).replace("T", " ")}</div></div>
        ))}
        <form action={message} className="row">
          <input name="body" required placeholder="Write a message" aria-label="Message" style={{ flex: 1 }} />
          <button className="btn" type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}
