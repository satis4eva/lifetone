import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { requireBrandAdmin } from "@/lib/auth";
import { moneyFmt } from "@/lib/money";
import { TYPE_LABEL, UNIT_LABEL, fmtDate } from "@/lib/labels";
import { quote as priceQuote } from "@/lib/pricing";
import { quoteStatusLabel, tripLine } from "@/lib/quotes";
import { closeQuote, replyToQuote, sendQuote } from "../../actions";

export default async function PortalQuote({ params, searchParams }: { params: { ref: string }; searchParams: { error?: string; done?: string } }) {
  await requireBrandAdmin();
  const brand = await getBrand();
  const fmt = moneyFmt(brand.currency);
  const q = await db.quoteRequest.findFirst({
    where: { brandId: brand.id, ref: params.ref },
    include: { guest: true, listing: { include: { provider: true } }, booking: true, messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!q) notFound();
  const listings = await db.listing.findMany({
    where: { brandId: brand.id, status: { in: ["LIVE", "PAUSED"] } },
    include: { provider: true }, orderBy: [{ type: "asc" }, { title: "asc" }],
  });
  // Suggest matching services first.
  listings.sort((a, b) => Number(b.type === q.type) - Number(a.type === q.type));
  const editable = q.status === "NEW" || q.status === "QUOTED";
  const fee = Number(brand.serviceFeePct);
  const guestTotal = q.price != null ? priceQuote({ unitPrice: q.price, quantity: 1, serviceFeePct: fee, payMethod: "CARD", depositPct: brand.depositPct }).total : null;
  const amount = (n: number) => (n / 100).toFixed(2).replace(/\.00$/, "");

  return (
    <div className="stack">
      <div><Link href="/portal/quotes" className="btn ghost small">← All quotes</Link></div>
      {searchParams.error && <div className="notice error" role="alert">{searchParams.error}</div>}
      {searchParams.done === "sent" && <div className="notice">Quote sent. The guest has been emailed a link to accept it.</div>}
      <div className="detail">
        <div className="stack">
          <div className="card stack" style={{ gap: 8 }}>
            <div className="row" style={{ justifyContent: "space-between" }}><h2>{q.ref}</h2><span className="pill">{quoteStatusLabel(q)}</span></div>
            <div className="muted">{q.guest.name} · {q.guest.email}{q.phone ? ` · ${q.phone}` : ""}</div>
            <div className="breakdown">
              <span>Type</span><span>{q.type ? TYPE_LABEL[q.type] : "Not sure / a mix"}</span>
              <span>{q.toPlace ? "Pickup" : "Where"}</span><span>{q.fromPlace}</span>
              {q.toPlace && <><span>Drop-off</span><span>{q.toPlace}{q.returnTrip ? " (return)" : ""}</span></>}
              <span>Dates</span><span className="num">{fmtDate(q.startDate)}{q.endDate ? ` to ${fmtDate(q.endDate)}` : ""}</span>
              <span>People</span><span className="num">{q.people}</span>
              {q.budget && <><span>Budget</span><span>{q.budget}</span></>}
            </div>
            {q.details && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{q.details}</p>}
            {q.booking && <p style={{ margin: 0 }}>Booked as <Link href={`/portal/bookings/${q.booking.ref}`} className="num">{q.booking.ref}</Link>.</p>}
          </div>

          {editable ? (
            <form action={sendQuote} className="card form">
              <input type="hidden" name="id" value={q.id} />
              <h2 className="full">{q.status === "QUOTED" ? "Update the price" : "Send a price"}</h2>
              <label className="full">Service that delivers it
                <select name="listingId" required defaultValue={q.listingId ?? ""}>
                  <option value="" disabled>Choose a provider's service</option>
                  {listings.map(l => <option key={l.id} value={l.id}>{TYPE_LABEL[l.type]} · {l.title} ({l.provider.business}) · {fmt(l.price)}/{UNIT_LABEL[l.unit].one}{l.status === "PAUSED" ? " · hidden" : ""}</option>)}
                </select>
              </label>
              <label>Price ({brand.currency})<input name="price" required inputMode="decimal" defaultValue={q.price != null ? amount(q.price) : ""} placeholder="e.g. 450" /></label>
              <label>Valid for (days)<input type="number" name="validDays" min={1} max={60} defaultValue={7} /></label>
              <label className="full">What's included<input name="included" defaultValue={q.included ?? ""} placeholder="e.g. 49-seat coach, driver, fuel, tolls, parking" /></label>
              <label className="full row" style={{ gap: 8 }}><input type="checkbox" name="allowCash" defaultChecked={q.allowCash && brand.allowCash} disabled={!brand.allowCash} style={{ width: "auto" }} /> Allow deposit or cash payment</label>
              <p className="muted full" style={{ margin: 0 }}>The guest also pays your {fee}% service fee on top. Your commission from the provider is worked out on this price, as with normal bookings. For a one-off service, add it as a listing and pause it so it stays hidden.</p>
              <div className="full row"><button className="btn" type="submit">{q.status === "QUOTED" ? "Send updated quote" : "Send quote"}</button></div>
            </form>
          ) : q.price != null && (
            <div className="card stack" style={{ gap: 6 }}>
              <h2>Quoted</h2>
              <div className="num">{fmt(q.price)} + service fee = {fmt(guestTotal ?? 0)}</div>
              {q.listing && <div className="muted">{q.listing.title} ({q.listing.provider.business})</div>}
            </div>
          )}
          {q.status === "QUOTED" && guestTotal != null && <p className="muted" style={{ margin: 0 }}>Sent: guest pays {fmt(guestTotal)}{q.validUntil ? `, valid until ${fmtDate(q.validUntil)}` : ""}.</p>}
          {editable && <form action={closeQuote}><input type="hidden" name="id" value={q.id} /><button className="btn ghost small" type="submit">Close without quoting</button></form>}
        </div>

        <div className="card stack">
          <h2>Messages with the guest</h2>
          {q.messages.length === 0 && <p className="muted" style={{ margin: 0 }}>Ask questions before you price it. The guest is emailed.</p>}
          {q.messages.map(m => <div key={m.id} className={`msg ${m.sender !== "GUEST" ? "mine" : ""}`}>{m.body}<div style={{ fontSize: ".75rem", opacity: .75 }}>{m.sender === "GUEST" ? q.guest.name : "You"} · {m.createdAt.toISOString().slice(0, 16).replace("T", " ")}</div></div>)}
          <form action={replyToQuote} className="row">
            <input type="hidden" name="id" value={q.id} />
            <input name="body" required placeholder="Message (the guest is emailed)" aria-label="Message" style={{ flex: 1 }} />
            <button className="btn" type="submit">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
