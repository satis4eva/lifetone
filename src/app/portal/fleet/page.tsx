import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { requireBrandAdmin } from "@/lib/auth";
import { moneyFmt } from "@/lib/money";
import { CHARGE_PER, type ChargePer } from "@/lib/coach";
import { deleteCharge, saveCharge, saveVehicle, vehicleAction } from "../actions";

export const metadata = { title: "Fleet & rates" };

const amt = (n: number) => (n / 100).toFixed(2).replace(/\.00$/, "");

export default async function Fleet({ searchParams }: { searchParams: { saved?: string; error?: string; edit?: string } }) {
  await requireBrandAdmin();
  const brand = await getBrand();
  const fmt = moneyFmt(brand.currency);
  const [vehicles, charges] = await Promise.all([
    db.vehicle.findMany({ where: { brandId: brand.id }, include: { listing: true }, orderBy: [{ active: "desc" }, { seats: "asc" }] }),
    db.tripCharge.findMany({ where: { brandId: brand.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const editing = vehicles.find(v => v.id === searchParams.edit);
  const cur = brand.currency;

  return (
    <div className="stack">
      {searchParams.saved && <div className="notice">Saved.</div>}
      {searchParams.error && <div className="notice error" role="alert">{searchParams.error}</div>}

      <div className="card stack">
        <h2>Vehicles</h2>
        <p className="muted" style={{ margin: 0 }}>Your vehicles and their rates. When a guest asks for a quote, the quote page suggests a price for each vehicle with enough seats. Vehicles stay off your website unless you press &quot;Show on site&quot;.</p>
        <div className="table-wrap"><table>
          <thead><tr><th>Vehicle</th><th>Seats</th><th>Hourly</th><th>Day</th><th>Driver overnight</th><th>On site</th><th>Actions</th></tr></thead>
          <tbody>
            {vehicles.map(v => (
              <tr key={v.id} style={v.active ? undefined : { opacity: .55 }}>
                <td><strong>{v.name}</strong>{!v.active && <div className="muted" style={{ fontSize: ".85rem" }}>Removed</div>}</td>
                <td className="num">{v.seats}</td>
                <td className="num">{fmt(v.hourlyRate)}<div className="muted" style={{ fontSize: ".85rem" }}>min {v.minHours} h</div></td>
                <td className="num">{fmt(v.dayRate)}<div className="muted" style={{ fontSize: ".85rem" }}>up to {v.dayHours} h</div></td>
                <td className="num">{v.overnightRate ? fmt(v.overnightRate) : "–"}</td>
                <td>{v.listing.status === "LIVE" ? <span className="pill">Shown</span> : <span className="pill warn">Hidden</span>}</td>
                <td>
                  <form action={vehicleAction} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <input type="hidden" name="id" value={v.id} />
                    <a className="btn ghost small" href={`/portal/fleet?edit=${v.id}#vehicle-form`}>Edit</a>
                    {v.active && (v.listing.status === "LIVE"
                      ? <button className="btn ghost small" name="action" value="hide">Hide</button>
                      : <button className="btn ghost small" name="action" value="show">Show on site</button>)}
                    {v.active ? <button className="btn ghost small" name="action" value="remove">Remove</button> : <button className="btn ghost small" name="action" value="restore">Restore</button>}
                  </form>
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && <tr><td colSpan={7} className="muted">No vehicles yet. Add your first one below.</td></tr>}
          </tbody>
        </table></div>
      </div>

      <form action={saveVehicle} className="card form" id="vehicle-form" key={editing?.id ?? "new"}>
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <h2 className="full">{editing ? `Edit ${editing.name}` : "Add a vehicle"}</h2>
        <label>Vehicle name<input name="name" required defaultValue={editing?.name} placeholder="e.g. 53-seat executive coach" /></label>
        <label>Passenger seats<input type="number" name="seats" min={1} max={120} required defaultValue={editing?.seats} /></label>
        <label>Hourly rate ({cur})<input name="hourlyRate" required inputMode="decimal" defaultValue={editing ? amt(editing.hourlyRate) : ""} placeholder="e.g. 90" /></label>
        <label>Minimum hours<input type="number" name="minHours" min={1} max={24} defaultValue={editing?.minHours ?? 4} /></label>
        <label>Day rate ({cur})<input name="dayRate" required inputMode="decimal" defaultValue={editing ? amt(editing.dayRate) : ""} placeholder="e.g. 750" /></label>
        <label>Hours covered by the day rate<input type="number" name="dayHours" min={1} max={24} defaultValue={editing?.dayHours ?? 10} /></label>
        <label>Driver overnight, per night ({cur})<input name="overnightRate" inputMode="decimal" defaultValue={editing ? amt(editing.overnightRate) : ""} placeholder="e.g. 120" /></label>
        <span />
        <label>Miles included per day (optional)<input type="number" name="includedMiles" min={0} max={2000} defaultValue={editing?.includedMiles ?? 0} /></label>
        <label>Extra mile rate ({cur}, optional)<input name="extraMileRate" inputMode="decimal" defaultValue={editing && editing.extraMileRate ? amt(editing.extraMileRate) : ""} placeholder="e.g. 2.50" /></label>
        <div className="full row">
          <button className="btn" type="submit">{editing ? "Save vehicle" : "Add vehicle"}</button>
          {editing && <a className="btn ghost" href="/portal/fleet">Cancel</a>}
        </div>
      </form>

      <div className="card stack" id="charges">
        <h2>Trip charges</h2>
        <p className="muted" style={{ margin: 0 }}>ULEZ, congestion charge, tolls, parking, waiting time and so on. Ticked charges are added to suggested prices automatically; unticked ones are listed so you can add them by hand.</p>
        {charges.map(c => (
          <form key={c.id} action={saveCharge} className="row" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
            <input type="hidden" name="id" value={c.id} />
            <input name="name" defaultValue={c.name} required aria-label="Charge name" style={{ flex: "2 1 160px" }} />
            <input name="amount" defaultValue={amt(c.amount)} required inputMode="decimal" aria-label={`Amount (${cur})`} style={{ flex: "1 1 90px" }} />
            <select name="per" defaultValue={c.per} aria-label="Charged">{(Object.keys(CHARGE_PER) as ChargePer[]).map(k => <option key={k} value={k}>{CHARGE_PER[k]}</option>)}</select>
            <label className="row" style={{ gap: 6 }}><input type="checkbox" name="autoAdd" defaultChecked={c.autoAdd} style={{ width: "auto" }} /> Add automatically</label>
            <button className="btn ghost small" type="submit">Save</button>
            <button className="btn ghost small" type="submit" formAction={deleteCharge}>Delete</button>
          </form>
        ))}
        <form action={saveCharge} className="row" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
          <input name="name" required placeholder="e.g. ULEZ" aria-label="Charge name" style={{ flex: "2 1 160px" }} />
          <input name="amount" required inputMode="decimal" placeholder={`Amount (${cur})`} aria-label="Amount" style={{ flex: "1 1 90px" }} />
          <select name="per" defaultValue="DAY" aria-label="Charged">{(Object.keys(CHARGE_PER) as ChargePer[]).map(k => <option key={k} value={k}>{CHARGE_PER[k]}</option>)}</select>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" name="autoAdd" defaultChecked style={{ width: "auto" }} /> Add automatically</label>
          <button className="btn small" type="submit">Add charge</button>
        </form>
      </div>
    </div>
  );
}
