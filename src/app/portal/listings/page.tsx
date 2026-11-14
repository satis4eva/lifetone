import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { requireBrandAdmin } from "@/lib/auth";
import { TYPE_LABEL, UNIT_LABEL } from "@/lib/labels";
import { listingAction } from "../actions";

const STATUS = { PENDING: ["Awaiting check", "warn"], LIVE: ["Live", ""], PAUSED: ["Paused", "warn"], REJECTED: ["Rejected", "bad"] } as const;

export default async function PortalListings() {
  await requireBrandAdmin();
  const brand = await getBrand();
  const listings = await db.listing.findMany({ where: { brandId: brand.id }, include: { provider: true }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  return (
    <div className="card stack">
      <h2>Listings and providers</h2>
      <p className="muted" style={{ margin: 0 }}>Paused listings are hidden from search. Price changes apply to new bookings only.</p>
      <div className="table-wrap"><table>
        <thead><tr><th>Listing</th><th>Provider</th><th>Price (LKR)</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{listings.map(l => (
          <tr key={l.id}>
            <td>{l.title}<div className="muted" style={{ fontSize: ".85rem" }}>{TYPE_LABEL[l.type]} · {l.place}</div></td>
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
