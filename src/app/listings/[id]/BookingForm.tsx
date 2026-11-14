"use client";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ListingType, PriceUnit } from "@prisma/client";
import { quote, unitsBetween, type PayMethod } from "@/lib/pricing";
import { createBooking } from "@/app/actions/booking";

// Client-side copies of labels (avoids importing server-only modules).
const UNITS: Record<PriceUnit, string> = { NIGHT: "nights", DAY: "days", PERSON: "people", SEAT: "seats", WEEK: "weeks" };
const rs = (c: number) => "Rs " + Math.round(c / 100).toLocaleString("en-GB");
const iso = (d: Date) => d.toISOString().slice(0, 10);

function Submit({ pay }: { pay: PayMethod }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? "Booking…" : pay === "CARD" ? "Book and pay" : pay === "DEPOSIT" ? "Book and pay deposit" : "Request booking, pay cash"}
    </button>
  );
}

export default function BookingForm({ listing, brand }: {
  listing: { id: string; price: number; unit: PriceUnit; type: ListingType };
  brand: { serviceFeePct: number; depositPct: number; allowCash: boolean };
}) {
  const range = listing.unit === "NIGHT" || listing.unit === "DAY";
  const today = iso(new Date());
  const start0 = iso(new Date(Date.now() + 14 * 86_400_000));
  const [start, setStart] = useState(start0);
  const [end, setEnd] = useState(iso(new Date(Date.now() + 17 * 86_400_000)));
  const [qty, setQty] = useState(listing.unit === "DAY" ? 1 : 2);
  const [pay, setPay] = useState<PayMethod>("CARD");
  const [error, action] = useFormState(createBooking, null as string | null);

  const units = range ? unitsBetween(start, end, listing.unit === "DAY") : qty;
  const q = useMemo(() => {
    try { return quote({ unitPrice: listing.price, quantity: units, serviceFeePct: brand.serviceFeePct, payMethod: pay, depositPct: brand.depositPct }); }
    catch { return null; }
  }, [units, pay, listing.price, brand.serviceFeePct, brand.depositPct]);

  return (
    <form action={action} className="stack">
      <input type="hidden" name="listingId" value={listing.id} />
      <div className="form">
        <label>{range ? "From" : "Date"}<input type="date" name="start" value={start} min={today} required onChange={e => setStart(e.target.value)} /></label>
        {range
          ? <label>To<input type="date" name="end" value={end} min={start} required onChange={e => setEnd(e.target.value)} /></label>
          : <label>{UNITS[listing.unit][0].toUpperCase() + UNITS[listing.unit].slice(1)}<input type="number" name="quantity" value={qty} min={1} max={60} required onChange={e => setQty(parseInt(e.target.value, 10) || 0)} /></label>}
        {range && <label className="full">Guests<input type="number" name="guests" defaultValue={2} min={1} max={30} /></label>}
        <label>Full name<input name="name" required autoComplete="name" /></label>
        <label>Email<input type="email" name="email" required autoComplete="email" /></label>
      </div>
      <p className="muted" style={{ margin: "-6px 0 0", fontSize: ".85rem" }}>We email your confirmation and every update. Use the link in it to manage your booking; no account needed.</p>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="stack">
        <legend style={{ fontWeight: 600, fontSize: ".9rem", marginBottom: 6 }}>How do you want to pay?</legend>
        <label className="opt"><input type="radio" name="payMethod" value="CARD" checked={pay === "CARD"} onChange={() => setPay("CARD")} /><span><strong>Card now</strong><br /><span className="muted">Processed securely by DPayments</span></span></label>
        {brand.allowCash && <>
          <label className="opt"><input type="radio" name="payMethod" value="DEPOSIT" checked={pay === "DEPOSIT"} onChange={() => setPay("DEPOSIT")} /><span><strong>{brand.depositPct}% deposit now, rest in cash</strong><br /><span className="muted">Pay the balance to the provider on the day</span></span></label>
          <label className="opt"><input type="radio" name="payMethod" value="CASH" checked={pay === "CASH"} onChange={() => setPay("CASH")} /><span><strong>Cash to the provider</strong><br /><span className="muted">The provider confirms first; pay in LKR on arrival</span></span></label>
        </>}
      </fieldset>
      {q ? (
        <div className="breakdown num">
          <span>{rs(listing.price)} × {units} {UNITS[listing.unit]}</span><span>{rs(q.subtotal)}</span>
          <span>Service fee ({brand.serviceFeePct}%)</span><span>{rs(q.serviceFee)}</span>
          <span className="total">Total</span><span className="total">{rs(q.total)}</span>
          {q.cashAmount > 0 && <><span>Pay now by card</span><span>{rs(q.onlineAmount)}</span><span>Pay in cash on the day</span><span>{rs(q.cashAmount)}</span></>}
        </div>
      ) : <p className="error">Check the dates: the end must be after the start.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <Submit pay={pay} />
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>Card payments are held until your trip starts. Free cancellation up to 48 hours before.</p>
    </form>
  );
}
