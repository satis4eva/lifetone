import { dpaymentsGateway } from "./dpayments";
import { mockGateway } from "./mock";
import type { PaymentGateway } from "./types";

/** Simulated payments: always in development; in production only on a test site (DEMO_MODE=true). */
export const isMockAllowed = () => process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true";

/** The configured gateway. In production only DPayments is allowed, so a missing setting can't make bookings free. */
export function gateway(): PaymentGateway {
  if (process.env.PAYMENT_GATEWAY === "dpayments") return dpaymentsGateway;
  if (!isMockAllowed()) throw new Error('PAYMENT_GATEWAY must be "dpayments" in production');
  return mockGateway;
}
export type { PaymentGateway } from "./types";
