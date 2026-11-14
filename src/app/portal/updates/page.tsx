import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { requireBrandAdmin } from "@/lib/auth";
import { postUpdate } from "../actions";

const LABEL = { TOURISTS: "Tourists on the site", PROVIDERS: "All providers", DRIVERS_TRANSPORT: "Drivers and transport companies", AGENCIES: "Travel agencies" } as const;

export default async function Updates() {
  await requireBrandAdmin();
  const brand = await getBrand();
  const updates = await db.update.findMany({ where: { brandId: brand.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="stack">
      <form action={postUpdate} className="card form">
        <h2 className="full">Post an update</h2>
        <label>Send to<select name="audience">{Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Title<input name="title" required /></label>
        <label className="full">Message<textarea name="body" rows={3} required /></label>
        <p className="muted full" style={{ margin: 0 }}>Updates for tourists show as a banner on the home page. Sending updates to providers by email or WhatsApp comes later.</p>
        <div className="full"><button className="btn" type="submit">Post update</button></div>
      </form>
      <div className="card stack">
        <h2>Posted updates</h2>
        {updates.map(u => <div key={u.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}><div className="row" style={{ justifyContent: "space-between" }}><strong>{u.title}</strong><span className="pill">{LABEL[u.audience]}</span></div><p style={{ margin: "4px 0 0" }}>{u.body}</p><div className="muted" style={{ fontSize: ".85rem" }}>{u.createdAt.toISOString().slice(0, 10)}</div></div>)}
        {updates.length === 0 && <p className="muted" style={{ margin: 0 }}>Nothing posted yet.</p>}
      </div>
    </div>
  );
}
