import type { Prisma } from "@prisma/client";

/** Format LKR cents for display, e.g. 1234500 -> "Rs 12,345". */
export function lkr(cents: number): string {
  return "Rs " + Math.round(cents / 100).toLocaleString("en-GB");
}

/** Parse a rupee amount typed by a person ("12,500") into cents. Returns NaN if invalid. */
export function parseRupees(input: string): number {
  const n = Number(String(input).replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}

export const pct = (d: Prisma.Decimal | number) => Number(d);
