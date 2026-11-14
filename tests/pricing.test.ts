import { test } from "node:test";
import assert from "node:assert/strict";
import { quote, split, unitsBetween } from "../src/lib/pricing.ts";

const rs = (n: number) => n * 100;

test("card booking charges everything online", () => {
  const q = quote({ unitPrice: rs(16000), quantity: 3, serviceFeePct: 3, payMethod: "CARD", depositPct: 20 });
  assert.deepEqual(q, { subtotal: rs(48000), serviceFee: rs(1440), total: rs(49440), onlineAmount: rs(49440), cashAmount: 0 });
});

test("deposit booking splits online and cash", () => {
  const q = quote({ unitPrice: rs(16000), quantity: 3, serviceFeePct: 3, payMethod: "DEPOSIT", depositPct: 20 });
  assert.equal(q.onlineAmount, rs(9888));
  assert.equal(q.cashAmount, rs(39552));
  assert.equal(q.onlineAmount + q.cashAmount, q.total);
});

test("cash booking charges nothing online", () => {
  const q = quote({ unitPrice: rs(4500), quantity: 2, serviceFeePct: 3, payMethod: "CASH", depositPct: 20 });
  assert.equal(q.onlineAmount, 0);
  assert.equal(q.cashAmount, q.total);
});

test("split: brand revenue, 10% platform fee, provider settlement", () => {
  const s = split({ subtotal: rs(48000), serviceFee: rs(1440), cashAmount: rs(39552), commissionPct: 12, platformFeePct: 10 });
  assert.equal(s.commission, rs(5760));
  assert.equal(s.brandRevenue, rs(7200));
  assert.equal(s.platformFee, rs(720));
  assert.equal(s.brandNet, rs(6480));
  assert.equal(s.providerShare, rs(42240));
  assert.equal(s.providerSettlement, rs(2688));
});

test("split: provider owes commission on full-cash booking", () => {
  const q = quote({ unitPrice: rs(48000), quantity: 3, serviceFeePct: 3, payMethod: "CASH", depositPct: 20 });
  const s = split({ ...q, commissionPct: 12, platformFeePct: 10 });
  assert.equal(s.providerSettlement, -(s.brandRevenue));
});

test("units between dates", () => {
  assert.equal(unitsBetween("2026-12-01", "2026-12-04", false), 3);
  assert.equal(unitsBetween("2026-12-01", "2026-12-03", true), 3);
});

test("rejects bad quantities", () => {
  assert.throws(() => quote({ unitPrice: 100, quantity: 0, serviceFeePct: 3, payMethod: "CARD", depositPct: 20 }));
});
