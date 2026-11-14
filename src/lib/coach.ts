// Coach hire pricing: pure functions, no imports, so they can be unit-tested with plain Node.
// All money in minor units (pence, cents).

export const BUSINESS_TYPES = {
  MARKETPLACE: "Tours and stays marketplace",
  COACH: "Coach and transport hire",
} as const;
export type BusinessType = keyof typeof BUSINESS_TYPES;
export const isBusinessType = (s: string): s is BusinessType => s in BUSINESS_TYPES;

export const CHARGE_PER = { TRIP: "per trip", DAY: "per day", HOUR: "per hour" } as const;
export type ChargePer = keyof typeof CHARGE_PER;

export interface VehicleRates {
  seats: number; hourlyRate: number; minHours: number; dayRate: number; dayHours: number; overnightRate: number;
}
export interface Charge { name: string; amount: number; per: string; autoAdd: boolean }
export interface Trip { people: number; days: number; hours?: number | null; returnTrip?: boolean }

export interface Estimate {
  fits: boolean;          // enough seats
  basis: string;          // how the vehicle cost was worked out
  vehicleCost: number;
  charges: Array<{ name: string; amount: number }>;
  chargesTotal: number;
  total: number;
}

/** Whole days from start to end inclusive (1 when there's no end date). */
export function daysInclusive(start: string, end?: string | null): number {
  if (!end) return 1;
  const ms = Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z");
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 86_400_000) + 1 : 1;
}

/**
 * Suggested price for one vehicle:
 * - several days: day rate per day, plus driver accommodation for each night away;
 * - one day with hours: hourly (at least the minimum hours), capped at the day rate; hours past the
 *   day's limit are added at the hourly rate;
 * - one day, no hours: a return trip is a day hire, a one-way transfer is the minimum hours.
 */
export function estimate(v: VehicleRates, trip: Trip, charges: Charge[]): Estimate {
  const days = Math.max(1, Math.floor(trip.days || 1));
  const hours = trip.hours && trip.hours > 0 ? trip.hours : null;
  let vehicleCost: number, basis: string, billableHours: number;
  if (days > 1) {
    vehicleCost = v.dayRate * days + v.overnightRate * (days - 1);
    basis = `${days} days${v.overnightRate ? `, ${days - 1} night${days === 2 ? "" : "s"} driver accommodation` : ""}`;
    billableHours = days * v.dayHours;
  } else if (hours) {
    billableHours = Math.max(hours, v.minHours);
    if (hours > v.dayHours) {
      vehicleCost = v.dayRate + (hours - v.dayHours) * v.hourlyRate;
      basis = `day rate + ${hours - v.dayHours} extra hour${hours - v.dayHours === 1 ? "" : "s"}`;
    } else {
      const hourly = billableHours * v.hourlyRate;
      vehicleCost = Math.min(hourly, v.dayRate);
      basis = hourly > v.dayRate ? "day rate (cheaper than hourly)" : `${billableHours} hours${billableHours > hours ? " (minimum)" : ""}`;
    }
  } else if (trip.returnTrip) {
    vehicleCost = v.dayRate; basis = "day hire (return trip)"; billableHours = v.dayHours;
  } else {
    billableHours = v.minHours;
    vehicleCost = v.minHours * v.hourlyRate; basis = `transfer, ${v.minHours} hours minimum`;
  }
  const lines = charges.filter(c => c.autoAdd).map(c => ({
    name: c.name,
    amount: c.per === "DAY" ? c.amount * days : c.per === "HOUR" ? c.amount * billableHours : c.amount,
  }));
  const chargesTotal = lines.reduce((a, l) => a + l.amount, 0);
  return { fits: v.seats >= trip.people, basis, vehicleCost, charges: lines, chargesTotal, total: vehicleCost + chargesTotal };
}
