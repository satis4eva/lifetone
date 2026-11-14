import type { PaymentGateway } from "./types";

const allowed = () => process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true";

/** Development gateway: sends the guest to /pay/mock, where they can approve or fail the payment. */
export const mockGateway: PaymentGateway = {
  name: "mock",
  async createCheckout(req) {
    const u = new URL(req.returnUrl);
    return { redirectUrl: `${u.origin}/pay/mock?reference=${encodeURIComponent(req.reference)}` };
  },
  async parseWebhook(rawBody) {
    if (!allowed()) throw new Error("Mock gateway is disabled in production");
    const data = JSON.parse(rawBody);
    return { reference: String(data.reference), status: data.status === "SUCCEEDED" ? "SUCCEEDED" : "FAILED" };
  },
  async refund(reference, amount) {
    console.log(`[mock gateway] refund ${amount} cents for ${reference}`);
  },
};
