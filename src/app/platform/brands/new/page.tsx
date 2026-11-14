import { requirePlatformAdmin } from "@/lib/auth";
import { PRESETS } from "@/lib/theme";
import { createBrand } from "../../actions";

export const metadata = { title: "New brand" };

export default async function NewBrand({ searchParams }: { searchParams: { error?: string } }) {
  await requirePlatformAdmin();
  return (
    <form action={createBrand} className="card form" style={{ maxWidth: 820 }}>
      <h1 className="full">New brand</h1>
      {searchParams.error && <p className="error full" role="alert" style={{ margin: 0 }}>{searchParams.error}</p>}
      <label>Brand name<input name="name" required placeholder="Evergreen Tours" /></label>
      <label>Short name (used internally)<input name="slug" required placeholder="evergreen" pattern="[a-z0-9-]{2,30}" /></label>
      <label>Booking prefix<input name="prefix" required placeholder="EG" maxLength={4} /></label>
      <label>Platform fee (%)<input name="platformFeePct" type="number" min={0} max={50} step={0.5} defaultValue={10} /></label>
      <label className="full">Tagline<input name="tagline" placeholder="Sri Lanka, island-wide" /></label>
      <label className="full">Domains (comma separated)<input name="domains" placeholder="evergreentours.lk, www.evergreentours.lk" /></label>
      <label>Starting theme<select name="preset">{Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select></label>
      <label>Brand admin email<input name="adminEmail" type="email" required /></label>
      <p className="muted full" style={{ margin: 0 }}>After creating it, add a logo and fine-tune colours on the next screen. Each new domain also needs its DNS pointed at the server and an HTTPS entry on the proxy.</p>
      <div className="full"><button className="btn" type="submit">Create brand</button></div>
    </form>
  );
}
