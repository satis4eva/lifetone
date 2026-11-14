import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { FONT_PAIRS, PRESETS } from "@/lib/theme";
import { addBrandAdmin, saveBrand } from "../../actions";

export const metadata = { title: "Edit brand" };

export default async function EditBrand({ params, searchParams }: { params: { id: string }; searchParams: { saved?: string; created?: string; error?: string } }) {
  await requirePlatformAdmin();
  const b = await db.brand.findUnique({ where: { id: params.id }, include: { users: { where: { role: "BRAND_ADMIN" }, select: { email: true } } } });
  if (!b) notFound();
  const site = b.domains.find(d => !d.includes("localhost"));
  return (
    <div className="stack" style={{ maxWidth: 900 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div><Link href="/" className="btn ghost small">← Brands</Link></div>
        {site && <a className="btn ghost small" href={`https://${site}`} target="_blank" rel="noopener noreferrer">Open {site} ↗</a>}
      </div>
      {searchParams.created && <div className="notice">Brand created. Add a logo and adjust the theme below.</div>}
      {searchParams.saved && <div className="notice">Saved. Changes are live on the brand&apos;s site.</div>}
      {searchParams.error && <p className="error" role="alert" style={{ margin: 0 }}>{searchParams.error}</p>}

      <form action={saveBrand} className="card form">
        <input type="hidden" name="id" value={b.id} />
        <h1 className="full">{b.name}</h1>

        <h2 className="full">Identity</h2>
        <label>Brand name<input name="name" defaultValue={b.name} required /></label>
        <label>Tagline<input name="tagline" defaultValue={b.tagline} /></label>
        <label className="full">Domains (comma separated)<input name="domains" defaultValue={b.domains.join(", ")} /></label>
        <div className="full row" style={{ alignItems: "flex-end" }}>
          {b.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={b.logoUrl} alt="Current logo" width={64} height={64} style={{ borderRadius: 12, objectFit: "contain", background: "#fff", border: "1px solid var(--line)" }} />
            : <span className="muted">No logo yet (the palm icon is shown).</span>}
          <label>Logo (square PNG/JPG/WebP, under 5 MB)<input type="file" name="logo" accept="image/png,image/jpeg,image/webp" /></label>
          {b.logoUrl && <label className="check"><input type="checkbox" name="remove_logo" /> Remove logo</label>}
        </div>

        <h2 className="full">Theme</h2>
        <label className="full">Apply a preset (overwrites the colours and fonts below)<select name="applyPreset" defaultValue="">
          <option value="">Keep my colours and fonts</option>
          {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
        </select></label>
        <label>Main colour (header, links)<input type="color" name="color" defaultValue={b.color} style={{ height: 44, padding: 4 }} /></label>
        <label>Button colour<input type="color" name="ctaColor" defaultValue={b.ctaColor} style={{ height: 44, padding: 4 }} /></label>
        <label>Page background (light mode)<input type="color" name="bgColor" defaultValue={b.bgColor} style={{ height: 44, padding: 4 }} /></label>
        <label>Fonts<select name="fontPair" defaultValue={b.fontPair}>{Object.entries(FONT_PAIRS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}</select></label>

        <h2 className="full">Home page</h2>
        <label className="full">Headline<input name="heroTitle" defaultValue={b.heroTitle ?? ""} placeholder="Your island escape, booked with locals" /></label>
        <label className="full">Intro text<textarea name="heroText" rows={2} defaultValue={b.heroText ?? ""} placeholder="Beach stays, tea-country bungalows, drivers, guides…" /></label>
        <div className="full row" style={{ alignItems: "flex-end" }}>
          {b.heroImageUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={b.heroImageUrl} alt="Current hero" width={160} height={90} style={{ borderRadius: 12, objectFit: "cover" }} />
            : <span className="muted">No hero photo (the colour gradient is shown).</span>}
          <label>Hero photo (landscape, about 1920 × 900 px)<input type="file" name="heroImage" accept="image/png,image/jpeg,image/webp" /></label>
          {b.heroImageUrl && <label className="check"><input type="checkbox" name="remove_heroImage" /> Remove hero photo</label>}
        </div>

        <h2 className="full">Business</h2>
        <label>Platform fee (% of brand revenue)<input name="platformFeePct" type="number" min={0} max={50} step={0.5} defaultValue={Number(b.platformFeePct)} /></label>
        <label className="check" style={{ alignSelf: "end" }}><input type="checkbox" name="active" defaultChecked={b.active} /> Site is live (untick to switch it off)</label>
        <div className="full"><button className="btn" type="submit">Save changes</button></div>
      </form>

      <form action={addBrandAdmin} className="card stack">
        <h2>Brand admins</h2>
        <p className="muted" style={{ margin: 0 }}>They sign in at {site ? `https://${site}/signin` : "the brand's site"} and see only this brand&apos;s Client portal.</p>
        <ul style={{ margin: 0 }}>{b.users.map(u => <li key={u.email}>{u.email}</li>)}</ul>
        <input type="hidden" name="id" value={b.id} />
        <div className="row"><input name="email" type="email" placeholder="new admin email" required /><button className="btn ghost" type="submit">Add admin</button></div>
      </form>
    </div>
  );
}
