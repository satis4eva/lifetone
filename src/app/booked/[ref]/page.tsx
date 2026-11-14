import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { STATUS_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

// Shown after booking. Deliberately shows no personal details: the guest manages the booking from the emailed link.
export default async function Booked({ params }: { params: { ref: string } }) {
  const brand = await getBrand();
  const b = await db.booking.findFirst({ where: { brandId: brand.id, ref: params.ref }, include: { listing: true } });
  if (!b) notFound();
  const heading =
    b.status === "PENDING_PAYMENT" ? "Waiting for your payment" :
    b.status === "REQUESTED" ? "Request sent" :
    b.status === "CONFIRMED" ? "You're booked" :
    b.status === "CANCELLED" && b.onlineAmount > 0 ? "Payment didn't go through" : STATUS_LABEL[b.status];
  return (
    <div className="card stack" style={{ maxWidth: 640 }}>
      <h1>{heading}</h1>
      <p style={{ margin: 0 }}><strong>{b.listing.title}</strong>, {b.listing.place}<br /><span className="muted num">Reference {b.ref} · {STATUS_LABEL[b.status]}</span></p>
      <p style={{ margin: 0 }}>
        {b.status === "PENDING_PAYMENT"
          ? "If you've just paid, this page updates in a few seconds. Refresh to check."
          : b.status === "CANCELLED" ? "Nothing was booked. You can try again from the listing."
          : "We've emailed you the details and a link to manage your booking."}
      </p>
      <div className="row"><Link className="btn" href="/bookings">My bookings</Link>{b.status === "CANCELLED" ? <Link className="btn ghost" href={`/listings/${b.listingId}`}>Try again</Link> : <Link className="btn ghost" href="/">Keep exploring</Link>}</div>
    </div>
  );
}
