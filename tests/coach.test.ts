import { test } from "node:test";
import assert from "node:assert/strict";
import { daysInclusive, estimate } from "../src/lib/coach.ts";

const coach = { seats: 53, hourlyRate: 9000, minHours: 4, dayRate: 75000, dayHours: 10, overnightRate: 12000 };
const charges = [
  { name: "ULEZ", amount: 1250, per: "DAY", autoAdd: true },
  { name: "Tolls", amount: 800, per: "TRIP", autoAdd: true },
  { name: "Waiting", amount: 3000, per: "HOUR", autoAdd: false },
];

test("short hire uses the minimum hours", () => {
  const e = estimate(coach, { people: 40, days: 1, hours: 2 }, []);
  assert.equal(e.vehicleCost, 4 * 9000);
  assert.equal(e.fits, true);
});
test("hourly is capped at the day rate", () => {
  assert.equal(estimate(coach, { people: 10, days: 1, hours: 9 }, []).vehicleCost, 75000);
});
test("hours past the day limit are added", () => {
  assert.equal(estimate(coach, { people: 10, days: 1, hours: 12 }, []).vehicleCost, 75000 + 2 * 9000);
});
test("multi-day adds driver nights and per-day charges; optional charges are left out", () => {
  const e = estimate(coach, { people: 60, days: 3 }, charges);
  assert.equal(e.vehicleCost, 3 * 75000 + 2 * 12000);
  assert.equal(e.chargesTotal, 3 * 1250 + 800);
  assert.equal(e.fits, false);
});
test("days between dates", () => {
  assert.equal(daysInclusive("2026-12-01", "2026-12-03"), 3);
  assert.equal(daysInclusive("2026-12-01"), 1);
});
