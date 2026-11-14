import Link from "next/link";
import type { BookingStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { requireBrandAdmin } from "@/lib/auth";
import { moneyFmt } from "@/lib/money";
import { PAY_LABEL, STATUS_LABEL, fmtDate } from "@/lib/labels";
import { bookingAction } from "../actions";

const FILTERS: Array<BookingStatus | "ALL"> = ["ALL", "REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED", "DECLINED", "PENDING_PAYMENT"];

export default async function PortalBookings({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  await requireBrandAdmin();
  const brand = await getBrand();
  const fmt = moneyFmt(brand.currency);
  const status = searchParams.status !== "ALL" && FILTERS.includes(searchParams.status as BookingStatus) ? (searchParams.status as BookingStatus) : undefined;
  const q = (searchParams.q || "").trim();
  const where: Prisma.BookingWhereInput = {
    brandId: brand.id, ...(status ? { status } : {}),
    ...(q ? { OR: [{ ref: { contains: q, mode: "insensitive" } }, { guest: { email: { contains: q, mode: "insensitive" } } }, { guest: { name: { contains: q, mode: "insensitive" } } }, { listing: { title: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const rows = await db.booking.findMany({ where, include: { listing: true, guest: true }, orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="card stack">
      <form className="row" style={{ justifyContent: "space-between" }}>
        <h2>Bookings</h2>
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Search ref, guest or listing" aria-label="Search bookings" />
      </form>
      <div className="chips">{FILTERS.map(f => {
        const p = new URLSearchParams(); if (f !== "ALL") p.set("status", f); if (q) p.set("q", q);
        return <Link key={f} className="chip" href={`/portal/bookings?${p}`} aria-current={(status ?? "ALL") === f}>{f === "ALL" ? "All" : STATUS_LABEL[f]}</Link>;
      })}</div>
      <div className="table-wrap"><table>
        <thead><tr><th>Ref</th><th>Guest</th><th>Listing</th><th>Start</th><th>Total</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {rows.map(b => (
            <tr key={b.id}>
              <td className="num"><Link href={`/portal/bookings/${b.ref}`}>{b.ref}</Link></td>
              <td>{b.guest.name}<div className="muted" style={{ fontSize: ".85rem" }}>{b.guest.email}</div></td>
              <td>{b.listing.title}</td>
              <td className="num">{fmtDate(b.startDate)}</td>
              <td className="num">{fmt(b.total)}</td>
              <td>{PAY_LABEL[b.payMethod]}{b.cashAmount > 0 && <div className="muted num" style={{ fontSize: ".85rem" }}>{fmt(b.cashAmount)} cash</div>}</td>
              <td><span className="pill">{STATUS_LABEL[b.status]}</span>{b.changeRequestDate && <div className="pill warn" style={{ marginTop: 4 }}>Change requested</div>}</td>
              <td>
                <form action={bookingAction} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                  <input type="hidden" name="id" value={b.id} />
                  {b.status === "REQUESTED" && <><button className="btn small" name="action" value="confirm">Confirm</button><button className="btn ghost small" name="action" value="decline">Decline</button></>}
                  {b.status === "CONFIRMED" && <><button className="btn ghost small" name="action" value="complete">Mark completed</button><button className="btn ghost small" name="action" value="cancel">Cancel and refund</button></>}
                </form>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={8} className="muted">No bookings match.</td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}
