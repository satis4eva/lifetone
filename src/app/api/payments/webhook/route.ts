import { NextResponse } from "next/server";
import { gateway } from "@/lib/payments";
import { applyPaymentResult } from "@/lib/bookings";

// The payment gateway posts payment results here. Signature is verified by the gateway adapter.
export async function POST(req: Request) {
  const raw = await req.text();
  try {
    const result = await gateway().parseWebhook(raw, req.headers);
    if (result) await applyPaymentResult(result.reference, result.status, result.amount, result.currency);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Payment webhook rejected:", e);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
