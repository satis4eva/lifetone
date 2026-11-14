import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMoney, countryOf } from "../src/lib/country.ts";

test("money formats per currency", () => {
  assert.equal(formatMoney(1234500, "LKR"), "Rs 12,345");
  assert.equal(formatMoney(1999, "GBP"), "£19.99");
  assert.equal(formatMoney(450000, "GBP"), "£4,500.00");
});

test("countries", () => {
  assert.equal(countryOf("GB").currency, "GBP");
  assert.equal(countryOf("LK").currency, "LKR");
  assert.equal(countryOf("XX").name, "Sri Lanka"); // unknown falls back
  assert.equal(countryOf("GB").destinations.length, 4);
});
