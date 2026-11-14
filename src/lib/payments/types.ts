export interface CheckoutRequest {
  reference: string;   // our payment reference, unique
  bookingRef: string;
  amount: number;      // LKR cents
  currency: "LKR";
  customerEmail: string;
  description: string;
  returnUrl: string;   // where the guest lands after paying
  webhookUrl: string;  // where the gateway posts the result
}

export interface WebhookResult {
  reference: string;
  status: "SUCCEEDED" | "FAILED";
  amount?: number;   // LKR cents, checked against our payment record
  currency?: string;
}

export interface PaymentGateway {
  name: string;
  /** Starts a hosted checkout and returns the URL to send the guest to. */
  createCheckout(req: CheckoutRequest): Promise<{ redirectUrl: string }>;
  /** Verifies and parses a webhook. Throws if the signature is invalid; returns null for non-final statuses (e.g. "pending"). */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookResult | null>;
  /** Refunds a successful payment in full or in part (LKR cents). */
  refund(reference: string, amount: number): Promise<void>;
}
