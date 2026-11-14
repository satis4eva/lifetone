import { randomInt } from "node:crypto";
import { db } from "./db";

/** Short, human-friendly booking reference such as LT-48213, unique across the platform. */
export async function newBookingRef(prefix: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const ref = `${prefix}-${randomInt(10000, 99999)}`;
    if (!(await db.booking.findUnique({ where: { ref } }))) return ref;
  }
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}
