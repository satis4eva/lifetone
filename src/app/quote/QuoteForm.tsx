"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createQuoteRequest } from "@/app/actions/quote";

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending}>{pending ? "Sending…" : "Send my request"}</button>;
}

export default function QuoteForm({ types, defaults, labels }: {
  types: Array<[string, string]>;
  defaults: { type?: string; from?: string; details?: string };
  labels: { from: string; to: string };
}) {
  const [error, action] = useFormState(createQuoteRequest, null);
  const [type, setType] = useState(defaults.type ?? "");
  const travel = type === "DRIVER" || type === "TRANSPORT" || type === "GUIDE" || type === "";
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="form">
      <label className="full">What do you need?
        <select name="type" value={type} onChange={e => setType(e.target.value)}>
          <option value="">Not sure / a mix</option>
          {types.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>{travel ? labels.from : "Where"}<input name="from" required defaultValue={defaults.from} placeholder={travel ? "e.g. hotel, airport or address" : "Town or area"} /></label>
      {travel ? <label>{labels.to}<input name="to" placeholder="Where you're going" /></label> : <span />}
      <label>Date<input type="date" name="start" required min={today} /></label>
      <label>End date (optional)<input type="date" name="end" min={today} /></label>
      <label>People<input type="number" name="people" min={1} max={500} defaultValue={2} required /></label>
      <label>Budget (optional)<input name="budget" placeholder="e.g. around 500" /></label>
      {travel && <label className="full row" style={{ gap: 8, alignItems: "center" }}><input type="checkbox" name="return" style={{ width: "auto" }} /> Return trip</label>}
      <label className="full">Anything else?<textarea name="details" rows={4} defaultValue={defaults.details} placeholder="Times, luggage, accessibility, the kind of place you like…" /></label>
      <label>Your name<input name="name" required autoComplete="name" /></label>
      <label>Email<input type="email" name="email" required autoComplete="email" /></label>
      <label className="full">Phone or WhatsApp (optional)<input name="phone" autoComplete="tel" /></label>
      {error && <p className="error full" role="alert" style={{ margin: 0 }}>{error}</p>}
      <div className="full"><Submit /></div>
    </form>
  );
}
