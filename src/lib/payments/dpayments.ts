import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentGateway } from "./types";

/**
 * DPayments adapter. The endpoint paths and field names below are placeholders:
 * replace them with DPayments' real API spec before going live. The rest of the app
 * only depends on the PaymentGateway interface, so nothing else needs to change.
 */
const api = () => {
  const url = process.env.DPAYMENTS_API_URL, key = process.env.DPAYMENTS_API_KEY;
  if (!url || !key) throw new Error("DPAYMENTS_API_URL and DPAYMENTS_API_KEY must be set");
  return { url: url.replace(/\/$/, ""), key };
};

export const dpaymentsGateway: PaymentGateway = {
  name: "dpayments",
  async createCheckout(req) {
    const { url, key } = api();
    const res = await fetch(`${url}/checkout/sessions`, { // TODO: confirm path with DPayments spec
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant_reference: req.reference,
        amount: req.amount,          // minor units
        currency: req.currency,      // settle in LKR
        customer_email: req.customerEmail,
        description: req.description,
        return_url: req.returnUrl,
        notify_url: req.webhookUrl,
      }),
    });
    if (!res.ok) throw new Error(`DPayments checkout failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return { redirectUrl: data.checkout_url }; // TODO: confirm field name
  },
  async parseWebhook(rawBody, headers) {
    const secret = process.env.DPAYMENTS_WEBHOOK_SECRET;
    if (!secret) throw new Error("DPAYMENTS_WEBHOOK_SECRET must be set");
    const given = Buffer.from(headers.get("x-dpayments-signature") || ""); // TODO: confirm header name
    const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new Error("Invalid webhook signature");
    const data = JSON.parse(rawBody);
    // TODO: confirm DPayments' status values. Only final statuses change anything.
    const status = data.status === "succeeded" ? "SUCCEEDED" : ["failed", "cancelled", "expired"].includes(data.status) ? "FAILED" : null;
    if (!status) return null;
    return { reference: String(data.merchant_reference), status, amount: Number(data.amount), currency: data.currency };
  },
  async refund(reference, amount) {
    const { url, key } = api();
    const res = await fetch(`${url}/refunds`, { // TODO: confirm path
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ merchant_reference: reference, amount }),
    });
    if (!res.ok) throw new Error(`DPayments refund failed: ${res.status} ${await res.text()}`);
  },
};
