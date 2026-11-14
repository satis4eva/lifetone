import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { requireBrandAdmin } from "@/lib/auth";
import { TYPE_LABEL, UNIT_LABEL } from "@/lib/labels";
import { saveListing } from "../../actions";

export const metadata = { title: "Edit listing" };

const amt = (n: number) => (n / 100).toFixed(2).replace(/\.00$/, "");

export default async function EditListing({ params, searchParams }: { params: { id: string }; searchParams: { saved?: string; error?: string } }) {
  await requireBrandAdmin();
  const brand = await getBrand();
  const isNew = params.id === "new";
  const l = isNew ? null : await db.listing.findFirst({ where: { id: params.id, brandId: brand.id }, include: { provider: true, vehicle: true } });
  if (!isNew && !l) notFound();
  const providers = isNew ? await db.provider.findMany({ where: { brandId: brand.id, status: "APPROVED", licenceNo: { not: "OWN-FLEET" } }, orderBy: { business: "asc" } }) : [];
  const own = l?.provider.licenceNo === "OWN-FLEET";

  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <Link href="/portal/listings" className="btn ghost small">← All listings</Link>
        {l?.status === "LIVE" && <a className="btn ghost small" href={`/listings/${l.id}`} target="_blank" rel="noopener noreferrer">View on site ↗</a>}
      </div>
      {searchParams.saved === "new" && <div className="notice">Listing added. Add a photo from the Listings page.</div>}
      {searchParams.saved === "1" && <div className="notice">Saved. Changes are live on your site; price changes apply to new bookings only.</div>}
      {searchParams.error && <div className="notice error" role="alert">{searchParams.error}</div>}
      {l?.vehicle && <div className="notice">This listing belongs to a vehicle. Its name and day rate are updated from <Link href="/portal/fleet">Fleet &amp; rates</Link> when the vehicle is saved.</div>}

      <form action={saveListing} className="card form">
        {l && <input type="hidden" name="id" value={l.id} />}
        <h1 className="full">{isNew ? "Add a listing" : "Edit listing"}</h1>
        <label className="full">Title<input name="title" required defaultValue={l?.title} placeholder="e.g. Sea-view room in Mirissa" /></label>
        <label>Type<select name="type" defaultValue={l?.type ?? "STAY"}>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Place<input name="place" required defaultValue={l?.place} placeholder="Town or area" /></label>
        <label>Price ({brand.currency})<input name="price" required inputMode="decimal" defaultValue={l ? amt(l.price) : ""} /></label>
        <label>Priced per<select name="unit" defaultValue={l?.unit ?? "NIGHT"}>{Object.entries(UNIT_LABEL).map(([k, v]) => <option key={k} value={k}>{v.one}</option>)}</select></label>
        <label className="full">Description<textarea name="description" rows={6} defaultValue={l?.description} placeholder="What guests get, what's included, rules, pickup details…" /></label>
        <label className="full row" style={{ gap: 8 }}><input type="checkbox" name="needsConfirmation" defaultChecked={l?.needsConfirmation ?? false} style={{ width: "auto" }} /> Bookings need confirming before they&apos;re final</label>
        {isNew && <label className="full row" style={{ gap: 8 }}><input type="checkbox" name="live" defaultChecked style={{ width: "auto" }} /> Show on the site straight away</label>}

        <h2 className="full">Provider</h2>
        {isNew ? (
          <>
            <label className="full">Who provides this service?
              <select name="providerId" defaultValue="own">
                <option value="own">{brand.name} (our own service)</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.business}</option>)}
                <option value="new">A new provider (enter details below)</option>
              </select>
            </label>
            <p className="muted full" style={{ margin: 0 }}>Only for a new provider:</p>
          </>
        ) : own ? (
          <p className="muted full" style={{ margin: 0 }}>Your own service ({l!.provider.business}).</p>
        ) : (
          <p className="muted full" style={{ margin: 0 }}>Changes to the provider&apos;s details apply to all their listings.</p>
        )}
        {(isNew || !own) && (
          <>
            <label>Business name<input name="business" defaultValue={l?.provider.business} /></label>
            <label>Licence or permit no.<input name="licenceNo" defaultValue={l?.provider.licenceNo} /></label>
            <label>Phone<input name="phone" defaultValue={l?.provider.phone} /></label>
            <label>Email<input type="email" name="providerEmail" defaultValue={l?.provider.email} /></label>
          </>
        )}
        <div className="full"><button className="btn" type="submit">{isNew ? "Add listing" : "Save changes"}</button></div>
      </form>
    </div>
  );
}
