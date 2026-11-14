import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, passwordProblem } from "../src/lib/password.ts";

test("hash and verify", async () => {
  const h = await hashPassword("correct horse battery");
  assert.match(h, /^scrypt\$/);
  assert.equal(await verifyPassword("correct horse battery", h), true);
  assert.equal(await verifyPassword("wrong password!!", h), false);
  assert.equal(await verifyPassword("anything", null), false);
});

test("same password hashes differently (random salt)", async () => {
  assert.notEqual(await hashPassword("same password 123"), await hashPassword("same password 123"));
});

test("password rules", () => {
  assert.ok(passwordProblem("short", "short"));
  assert.ok(passwordProblem("long enough pw", "different pw!!"));
  assert.equal(passwordProblem("long enough pw", "long enough pw"), null);
});
