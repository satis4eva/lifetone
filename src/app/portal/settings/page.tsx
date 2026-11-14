import { getBrand } from "@/lib/brand";
import { requireBrandAdmin } from "@/lib/auth";
import { saveSettings } from "../actions";

export default async function Settings() {
  await requireBrandAdmin();
  const b = await getBrand();
  return (
    <form action={saveSettings} className="card form">
      <h2 className="full">Brand</h2>
      <label>Brand name<input name="name" defaultValue={b.name} required /></label>
      <label>Tagline<input name="tagline" defaultValue={b.tagline} /></label>
      <label>Main colour<input name="color" type="color" defaultValue={b.color} style={{ height: 44, padding: 4 }} /></label>
      <label>Sender for guest emails<input name="emailFrom" defaultValue={b.emailFrom ?? ""} placeholder={`${b.name} Bookings <bookings@yourdomain>`} /></label>
      <p className="muted full" style={{ margin: 0 }}>Domains: {b.domains.join(", ") || "none"}. Ask the platform team to add a new domain.</p>

      <h2 className="full" style={{ marginTop: 8 }}>Pricing and payments</h2>
      <label>Commission from providers (%)<input name="commissionPct" type="number" step="0.5" min={0} max={40} defaultValue={Number(b.commissionPct)} /></label>
      <label>Service fee charged to guests (%)<input name="serviceFeePct" type="number" step="0.5" min={0} max={15} defaultValue={Number(b.serviceFeePct)} /></label>
      <label>Payment gateway<input defaultValue="DPayments" disabled /></label>
      <label>Settle payouts in<select name="settleCurrency" defaultValue={b.settleCurrency}>{["LKR", "GBP", "USD", "EUR"].map(c => <option key={c}>{c}</option>)}</select></label>
      <label className="check"><input type="checkbox" name="allowCash" defaultChecked={b.allowCash} /> Allow cash payments</label>
      <label>Deposit for deposit-and-cash bookings (%)<input name="depositPct" type="number" min={0} max={100} step={5} defaultValue={b.depositPct} /></label>
      <p className="muted full" style={{ margin: 0 }}>Platform fee: {Number(b.platformFeePct)}% of your revenue (commission plus service fees), taken automatically at payment.</p>
      <div className="full"><button className="btn" type="submit">Save</button></div>
    </form>
  );
}
