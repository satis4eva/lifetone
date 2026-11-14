import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { applyPaymentResult } from "@/lib/bookings";
import { isMockAllowed } from "@/lib/payments";

export const dynamic = "force-dynamic";

// Development-only stand-in for the DPayments hosted checkout.
export default async function MockPay({ searchParams }: { searchParams: { reference?: string } }) {
  if (process.env.PAYMENT_GATEWAY === "dpayments" || !isMockAllowed()) notFound();
  const p = await db.payment.findUnique({ where: { reference: searchParams.reference || "" }, include: { booking: true } });
  if (!p) notFound();

  async function settle(form: FormData) {
    "use server";
    if (process.env.PAYMENT_GATEWAY === "dpayments" || !isMockAllowed()) return;
    const ref = String(form.get("reference"));
    const ok = form.get("result") === "ok";
    const b = await applyPaymentResult(ref, ok ? "SUCCEEDED" : "FAILED");
    redirect(`/booked/${b?.ref ?? ""}`);
  }

  return (
    <form action={settle} className="card stack" style={{ maxWidth: 480 }}>
      <h1>Test payment</h1>
      <p className="muted" style={{ margin: 0 }}>This page stands in for the DPayments checkout while PAYMENT_GATEWAY is "mock". No money moves.</p>
      <p className="num" style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>{formatMoney(p.amount, p.currency)}</p>
      <p className="muted" style={{ margin: 0 }}>Booking {p.booking.ref} · status {p.status}</p>
      <input type="hidden" name="reference" value={p.reference} />
      <div className="row">
        <button className="btn" name="result" value="ok" disabled={p.status !== "PENDING"}>Pay successfully</button>
        <button className="btn ghost" name="result" value="fail" disabled={p.status !== "PENDING"}>Fail payment</button>
      </div>
    </form>
  );
}
