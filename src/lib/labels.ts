import type { BookingStatus, ListingType, PayMethod, PriceUnit } from "@prisma/client";

export const TYPE_LABEL: Record<ListingType, string> = {
  STAY: "Stays", DRIVER: "Drivers", TRANSPORT: "Transport companies", GUIDE: "Guides", SHARE: "Room shares", PACKAGE: "Sports & business",
};
export const UNIT_LABEL: Record<PriceUnit, { one: string; many: string }> = {
  NIGHT: { one: "night", many: "nights" }, DAY: { one: "day", many: "days" }, PERSON: { one: "person", many: "people" },
  SEAT: { one: "seat", many: "seats" }, WEEK: { one: "week", many: "weeks" },
};
export const PAY_LABEL: Record<PayMethod, string> = { CARD: "Card", DEPOSIT: "Deposit + cash", CASH: "Cash" };
export const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment", REQUESTED: "Requested", CONFIRMED: "Confirmed", COMPLETED: "Completed", CANCELLED: "Cancelled", DECLINED: "Declined",
};
/** Units priced by a date range rather than a count. */
export const isRangeUnit = (u: PriceUnit) => u === "NIGHT" || u === "DAY";
export const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
