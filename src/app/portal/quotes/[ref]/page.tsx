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
import { daysInclusive, estimate } from "@/lib/coach";

export default async function PortalQuote({ params, searchParams }: { params: { ref: string }; searchParams: { error?: string; done?: string; price?: string; listing?: string; included?: string } }) {
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
  const coach = brand.businessType === "COACH";
  const [vehicles, charges] = coach
    ? await Promise.all([
        db.vehicle.findMany({ where: { brandId: brand.id, active: true }, orderBy: { seats: "asc" } }),
        db.tripCharge.findMany({ where: { brandId: brand.id } }),
      ])
    : [[], []];
  const days = daysInclusive(fmtDate(q.startDate), q.endDate ? fmtDate(q.endDate) : null);
  const suggestions = vehicles.map(v => ({ v, e: estimate(v, { people: q.people, days, hours: q.hours, returnTrip: q.returnTrip }, charges) }));
  const optional = charges.filter(c => !c.autoAdd);
  const preset = {
    price: searchParams.price && /^\d+(\.\d{1,2})?$/.test(searchParams.price) ? searchParams.price : q.price != null ? amount(q.price) : "",
    listing: searchParams.listing || q.listingId || "",
    included: searchParams.included ?? q.included ?? "",
  };

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
              {q.pickupTime && <><span>Pickup time</span><span className="num">{q.pickupTime}</span></>}
              {q.hours && <><span>Hours needed</span><span className="num">{q.hours}</span></>}
              <span>{coach ? "Passengers" : "People"}</span><span className="num">{q.people}</span>
              {q.budget && <><span>Budget</span><span>{q.budget}</span></>}
            </div>
            {q.details && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{q.details}</p>}
            {q.booking && <p style={{ margin: 0 }}>Booked as <Link href={`/portal/bookings/${q.booking.ref}`} className="num">{q.booking.ref}</Link>.</p>}
          </div>

          {editable && coach && (
            <div className="card stack">
              <h2>Suggested prices</h2>
              <p className="muted" style={{ margin: 0 }}>From your rates in Fleet &amp; rates, for {days} day{days === 1 ? "" : "s"}{q.hours ? `, ${q.hours} hours` : ""}{q.returnTrip ? ", return trip" : ""}. Check the route before you send it.</p>
              {suggestions.length === 0 && <p style={{ margin: 0 }}>No vehicles yet. <Link href="/portal/fleet">Add your vehicles and rates</Link> to get suggested prices.</p>}
              {suggestions.length > 0 && (
                <div className="table-wrap"><table>
                  <thead><tr><th>Vehicle</th><th>How</th><th>Vehicle</th><th>Charges</th><th>Suggested</th><th></th></tr></thead>
                  <tbody>{suggestions.map(({ v, e }) => {
                    const included = [v.name, "driver", ...e.charges.map(c => c.name)].join(", ");
                    const href = `/portal/quotes/${q.ref}?${new URLSearchParams({ price: amount(e.total), listing: v.listingId, included })}#send`;
                    return (
                      <tr key={v.id} style={e.fits ? undefined : { opacity: .5 }}>
                        <td>{v.name}<div className="muted" style={{ fontSize: ".85rem" }}>{v.seats} seats{e.fits ? "" : " · too small"}</div></td>
                        <td>{e.basis}</td>
                        <td className="num">{fmt(e.vehicleCost)}</td>
                        <td className="num">{e.chargesTotal ? fmt(e.chargesTotal) : "–"}{e.charges.length > 0 && <div className="muted" style={{ fontSize: ".8rem" }}>{e.charges.map(c => c.name).join(", ")}</div>}</td>
                        <td className="num"><strong>{fmt(e.total)}</strong></td>
                        <td>{e.fits && <Link className="btn small" href={href}>Use this</Link>}</td>
                      </tr>
                    );
                  })}</tbody>
                </table></div>
              )}
              {optional.length > 0 && <p className="muted" style={{ margin: 0 }}>Not included, add if needed: {optional.map(c => `${c.name} ${fmt(c.amount)} ${c.per === "DAY" ? "per day" : c.per === "HOUR" ? "per hour" : "per trip"}`).join(" · ")}</p>}
            </div>
          )}
          {editable ? (
            <form action={sendQuote} className="card form" id="send" key={`${preset.price}|${preset.listing}`}>
              <input type="hidden" name="id" value={q.id} />
              <h2 className="full">{q.status === "QUOTED" ? "Update the price" : "Send a price"}</h2>
              <label className="full">Service that delivers it
                <select name="listingId" required defaultValue={preset.listing}>
                  <option value="" disabled>Choose a provider's service</option>
                  {listings.map(l => <option key={l.id} value={l.id}>{TYPE_LABEL[l.type]} · {l.title} ({l.provider.business}) · {fmt(l.price)}/{UNIT_LABEL[l.unit].one}{l.status === "PAUSED" ? " · hidden" : ""}</option>)}
                </select>
              </label>
              <label>Price ({brand.currency})<input name="price" required inputMode="decimal" defaultValue={preset.price} placeholder="e.g. 450" /></label>
              <label>Valid for (days)<input type="number" name="validDays" min={1} max={60} defaultValue={7} /></label>
              <label className="full">What's included<input name="included" defaultValue={preset.included} placeholder="e.g. 49-seat coach, driver, fuel, tolls, parking" /></label>
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
