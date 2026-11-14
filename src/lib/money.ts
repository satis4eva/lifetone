import type { Prisma } from "@prisma/client";
import { formatMoney } from "./country";

export { formatMoney, moneyFmt } from "./country";

/** Rupee formatting kept for older callers; prefer moneyFmt(brand.currency). */
export const lkr = (cents: number) => formatMoney(cents, "LKR");

/** Parse an amount typed by a person ("12,500" or "19.99") into minor units. Returns NaN if invalid. */
export function parseAmount(input: string): number {
  const n = Number(String(input).replace(/[,\s£$€]|Rs/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}
export const parseRupees = parseAmount;

export const pct = (d: Prisma.Decimal | number) => Number(d);
