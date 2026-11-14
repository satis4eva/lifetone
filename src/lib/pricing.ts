// Pure money logic: quotes for guests and the split between provider, brand and platform.
// All amounts are integers in minor units (cents, pence). No imports, so it is unit-testable with plain Node.

export type PayMethod = "CARD" | "DEPOSIT" | "CASH";

export interface QuoteInput {
  unitPrice: number;      // cents per unit
  quantity: number;       // nights, days, seats, people or weeks
  serviceFeePct: number;  // e.g. 3
  payMethod: PayMethod;
  depositPct: number;     // e.g. 20, used when payMethod is DEPOSIT
}

export interface Quote {
  subtotal: number;
  serviceFee: number;
  total: number;
  onlineAmount: number;   // charged through the payment gateway now
  cashAmount: number;     // paid to the provider on the day
}

export function quote(i: QuoteInput): Quote {
  if (!Number.isInteger(i.quantity) || i.quantity < 1) throw new Error("Quantity must be a whole number of at least 1");
  if (!Number.isInteger(i.unitPrice) || i.unitPrice < 0) throw new Error("Unit price must be a whole number of cents");
  const subtotal = i.unitPrice * i.quantity;
  const serviceFee = Math.round((subtotal * i.serviceFeePct) / 100);
  const total = subtotal + serviceFee;
  const onlineAmount =
    i.payMethod === "CARD" ? total :
    i.payMethod === "DEPOSIT" ? Math.round((total * clampPct(i.depositPct)) / 100) :
    0;
  return { subtotal, serviceFee, total, onlineAmount, cashAmount: total - onlineAmount };
}

export interface SplitInput {
  subtotal: number;
  serviceFee: number;
  cashAmount: number;
  commissionPct: number;  // brand's commission from the provider
  platformFeePct: number; // platform owner's share of brand revenue
}

export interface Split {
  commission: number;          // brand's commission from the provider
  brandRevenue: number;        // commission + service fee
  platformFee: number;         // platform owner's share of brand revenue
  brandNet: number;            // brand revenue after the platform fee
  providerShare: number;       // what the provider earns in total
  providerSettlement: number;  // what the gateway pays the provider; negative = provider owes (they hold cash)
}

export function split(i: SplitInput): Split {
  const commission = Math.round((i.subtotal * i.commissionPct) / 100);
  const brandRevenue = commission + i.serviceFee;
  const platformFee = Math.round((brandRevenue * i.platformFeePct) / 100);
  const providerShare = i.subtotal - commission;
  return {
    commission,
    brandRevenue,
    platformFee,
    brandNet: brandRevenue - platformFee,
    providerShare,
    providerSettlement: providerShare - i.cashAmount,
  };
}

/** Units for a date range: nights for stays (end - start), days for hire (inclusive). */
export function unitsBetween(start: string, end: string, inclusive: boolean): number {
  const ms = Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z");
  if (!Number.isFinite(ms)) return 0;
  return Math.round(ms / 86_400_000) + (inclusive ? 1 : 0);
}

function clampPct(p: number) {
  return Math.min(100, Math.max(0, p));
}
