import { db } from "./db";
import { split } from "./pricing";

export interface ReportRow {
  ref: string; bookedOn: string; startDate: string; guest: string; email: string; listing: string; provider: string;
  payMethod: string; status: string; total: number; online: number; cash: number;
  providerShare: number; providerSettlement: number; serviceFee: number; commission: number;
  brandRevenue: number; platformFee: number; brandNet: number;
}
export interface MonthlyReport {
  month: string; label: string; rows: ReportRow[];
  cancelled: { count: number; refunded: number };
  totals: Omit<ReportRow, "ref" | "bookedOn" | "startDate" | "guest" | "email" | "listing" | "provider" | "payMethod" | "status"> & { bookings: number; bookingValue: number };
}

const PAY = { CARD: "Card", DEPOSIT: "Deposit + cash", CASH: "Cash" } as const;

/** "2026-11" for the given date (UTC). */
export const monthOf = (d = new Date()) => d.toISOString().slice(0, 7);
export const validMonth = (m?: string) => (m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : monthOf());

/**
 * Income for bookings made in the month (by booking date): confirmed and completed bookings,
 * plus a count of cancellations and what was refunded. Amounts in LKR cents.
 */
export async function monthlyReport(brandId: string, month: string): Promise<MonthlyReport> {
  const from = new Date(`${month}-01T00:00:00Z`);
  const to = new Date(from); to.setUTCMonth(to.getUTCMonth() + 1);
  const [bookings, cancelled] = await Promise.all([
    db.booking.findMany({
      where: { brandId, createdAt: { gte: from, lt: to }, status: { in: ["CONFIRMED", "COMPLETED"] } },
      include: { listing: { include: { provider: true } }, guest: true }, orderBy: { createdAt: "asc" },
    }),
    db.booking.findMany({ where: { brandId, createdAt: { gte: from, lt: to }, status: { in: ["CANCELLED", "DECLINED"] } }, include: { payments: true } }),
  ]);
  const rows: ReportRow[] = bookings.map(b => {
    const s = split({ subtotal: b.subtotal, serviceFee: b.serviceFee, cashAmount: b.cashAmount, commissionPct: Number(b.commissionPct), platformFeePct: Number(b.platformFeePct) });
    return {
      ref: b.ref, bookedOn: b.createdAt.toISOString().slice(0, 10), startDate: b.startDate.toISOString().slice(0, 10),
      guest: b.guest.name, email: b.guest.email, listing: b.listing.title, provider: b.listing.provider.business,
      payMethod: PAY[b.payMethod], status: b.status === "COMPLETED" ? "Completed" : "Confirmed",
      total: b.total, online: b.onlineAmount, cash: b.cashAmount, providerShare: s.providerShare, providerSettlement: s.providerSettlement,
      serviceFee: b.serviceFee, commission: s.commission, brandRevenue: s.brandRevenue, platformFee: s.platformFee, brandNet: s.brandNet,
    };
  });
  const sum = (k: keyof ReportRow) => rows.reduce((a, r) => a + (r[k] as number), 0);
  return {
    month,
    label: from.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    rows,
    cancelled: {
      count: cancelled.length,
      refunded: cancelled.reduce((a, b) => a + b.payments.filter(p => p.status === "REFUNDED").reduce((x, p) => x + p.amount, 0), 0),
    },
    totals: {
      bookings: rows.length, bookingValue: bookings.reduce((a, b) => a + b.subtotal, 0),
      total: sum("total"), online: sum("online"), cash: sum("cash"), providerShare: sum("providerShare"), providerSettlement: sum("providerSettlement"),
      serviceFee: sum("serviceFee"), commission: sum("commission"), brandRevenue: sum("brandRevenue"), platformFee: sum("platformFee"), brandNet: sum("brandNet"),
    },
  };
}
