import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { currentUser } from "@/lib/auth";
import { moneyFmt } from "@/lib/money";
import { PAY_LABEL, STATUS_LABEL, UNIT_LABEL, fmtDate } from "@/lib/labels";

export const metadata = { title: "My bookings" };
export const dynamic = "force-dynamic";

export default async function MyBookings() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/bookings");
  const brand = await getBrand();
  const fmt = moneyFmt(brand.currency);
  const bookings = await db.booking.findMany({
    where: { brandId: brand.id, guestId: user.id }, include: { listing: true }, orderBy: { startDate: "desc" },
  });
  return (
    <div className="stack">
      <div><h1>My bookings</h1><p className="muted" style={{ margin: "4px 0 0" }}>Signed in as {user.email}</p></div>
      {!user.passwordHash && (
        <div className="notice row" style={{ justifyContent: "space-between" }}>
          <span>Set a password to sign in faster next time, without waiting for an email.</span>
          <Link className="btn small" href="/account/password?next=/bookings">Set a password</Link>
        </div>
      )}
      {bookings.length === 0 && <div className="card muted">No bookings for this email yet. <Link href="/">Start exploring</Link></div>}
      {bookings.map(b => (
        <Link key={b.id} href={`/bookings/${b.ref}`} className="card row" style={{ justifyContent: "space-between", color: "inherit", textDecoration: "none" }}>
          <div>
            <h3>{b.listing.title}</h3>
            <div className="muted num">{b.ref} · {b.listing.place} · from {fmtDate(b.startDate)} · {b.quantity} {UNIT_LABEL[b.listing.unit].many} · {fmt(b.total)} · {PAY_LABEL[b.payMethod]}</div>
          </div>
          <span className={`pill ${b.status === "CONFIRMED" || b.status === "COMPLETED" ? "" : b.status === "CANCELLED" || b.status === "DECLINED" ? "bad" : "warn"}`}>{STATUS_LABEL[b.status]}</span>
        </Link>
      ))}
    </div>
  );
}
