import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { requireBrandAdmin } from "@/lib/auth";
import { TYPE_LABEL, UNIT_LABEL } from "@/lib/labels";
import { listingAction, listingImage } from "../actions";
import ListingImage from "@/components/ListingImage";
import { aiImagesEnabled, suggestPrompt } from "@/lib/aiImage";
import { countryOf } from "@/lib/country";

const STATUS = { PENDING: ["Awaiting check", "warn"], LIVE: ["Live", ""], PAUSED: ["Paused", "warn"], REJECTED: ["Rejected", "bad"] } as const;

export default async function PortalListings({ searchParams }: { searchParams: { error?: string; id?: string } }) {
  await requireBrandAdmin();
  const brand = await getBrand();
  const listings = await db.listing.findMany({ where: { brandId: brand.id }, include: { provider: true }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: "space-between" }}><h2>Listings and providers</h2><a className="btn" href="/portal/listings/new">+ Add listing</a></div>
      <p className="muted" style={{ margin: 0 }}>Press <strong>Edit</strong> to change a listing&apos;s title, description, place, type, price or provider details. Paused listings are hidden from search. Price changes apply to new bookings only.</p>
      <div className="notice">
        <strong>Three ways to add a photo:</strong> 1. upload your own JPG, PNG or WebP (up to 5 MB) or paste an image link;
        2. <a href="https://www.canva.com/" target="_blank" rel="noopener noreferrer">design it in Canva</a> at 1200 × 800 px, download as JPG or PNG, then upload it;
        3. create one with AI (under each listing){aiImagesEnabled() ? "" : " once an OpenAI API key is added on the server"}.
        AI images are labelled for guests. For stays and vehicles, real photos work best, so guests see what they&apos;re booking.
      </div>
      {searchParams.error && <p className="error" role="alert" style={{ margin: 0 }}>{searchParams.error}</p>}
      <div className="table-wrap"><table>
        <thead><tr><th>Photo</th><th>Listing</th><th>Provider</th><th>Price ({brand.currency})</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{listings.map(l => (
          <tr key={l.id} id={`l-${l.id}`}>
            <td style={{ minWidth: 250 }}>
              <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                <div className="thumb"><ListingImage type={l.type} imageUrl={l.imageUrl} alt={l.title} /></div>
                <form action={listingImage} className="stack" style={{ gap: 6 }}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="file" name="file" accept="image/jpeg,image/png,image/webp" aria-label={`Photo for ${l.title}`} style={{ maxWidth: 200, padding: 4, fontSize: ".8rem" }} />
                  <input name="link" placeholder="or paste https:// image link" aria-label={`Image link for ${l.title}`} style={{ maxWidth: 200, padding: "6px 8px", fontSize: ".85rem" }} />
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn small" type="submit">Save photo</button>
                    {l.imageUrl && <button className="btn ghost small" name="action" value="removeImage" formNoValidate>Remove</button>}
                  </div>
                  {l.imageIsAi && <span className="pill warn">AI image</span>}
                </form>
              </div>
              <details style={{ marginTop: 6 }}>
                <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: ".85rem" }}>Create with AI</summary>
                <form action={listingImage} className="stack" style={{ gap: 6, marginTop: 6 }}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="action" value="ai" />
                  <textarea name="prompt" rows={4} defaultValue={suggestPrompt(l, countryOf(brand.country).name)} aria-label={`AI image description for ${l.title}`} style={{ fontSize: ".85rem", maxWidth: 320 }} />
                  <div><button className="btn small" type="submit" disabled={!aiImagesEnabled()}>{aiImagesEnabled() ? "Generate and save (takes up to a minute)" : "Needs an OpenAI API key"}</button></div>
                </form>
              </details>
            </td>
            <td><a href={`/portal/listings/${l.id}`}>{l.title}</a><div className="muted" style={{ fontSize: ".85rem" }}>{TYPE_LABEL[l.type]} · {l.place}</div></td>
            <td>{l.provider.business}<div className="muted" style={{ fontSize: ".85rem" }}>{l.provider.licenceNo}</div></td>
            <td>
              <form action={listingAction} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                <input type="hidden" name="id" value={l.id} /><input type="hidden" name="action" value="price" />
                <input name="price" defaultValue={String(l.price / 100)} inputMode="numeric" aria-label={`Price for ${l.title}`} style={{ width: 110 }} className="num" />
                <span className="muted">/ {UNIT_LABEL[l.unit].one}</span>
                <button className="btn ghost small" type="submit">Save</button>
              </form>
            </td>
            <td><span className={`pill ${STATUS[l.status][1]}`}>{STATUS[l.status][0]}</span></td>
            <td>
              <form action={listingAction} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                <input type="hidden" name="id" value={l.id} />
                <a className="btn small" href={`/portal/listings/${l.id}`}>Edit</a>
                {l.status === "PENDING" && <><button className="btn small" name="action" value="approve">Approve</button><button className="btn ghost small" name="action" value="reject">Reject</button></>}
                {l.status === "LIVE" && <button className="btn ghost small" name="action" value="pause">Pause</button>}
                {l.status === "PAUSED" && <button className="btn ghost small" name="action" value="resume">Resume</button>}
              </form>
            </td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}
