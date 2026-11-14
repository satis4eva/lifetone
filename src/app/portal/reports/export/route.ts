import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { requireBrandAdmin } from "@/lib/auth";
import { getBrand } from "@/lib/brand";
import { monthlyReport, validMonth, type MonthlyReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

const rupees = (c: number) => Math.round(c) / 100;
const rs = (c: number) => "Rs " + (Math.round(c) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function GET(req: Request) {
  await requireBrandAdmin();
  const brand = await getBrand();
  const url = new URL(req.url);
  const month = validMonth(url.searchParams.get("month") ?? undefined);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const report = await monthlyReport(brand.id, month);
  const base = `${brand.slug}-income-${month}`;
  if (format === "xlsx") {
    return new Response(await toExcel(brand.name, brand.settleCurrency, report), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(await toPdf(brand.name, report), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${base}.pdf"`, "Cache-Control": "no-store" },
  });
}

async function toExcel(brandName: string, currency: string, r: MonthlyReport): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = brandName;
  const money = '#,##0.00';

  const s = wb.addWorksheet("Summary");
  s.columns = [{ width: 34 }, { width: 20 }];
  s.addRow([`${brandName}: income report, ${r.label}`]).font = { bold: true, size: 14 };
  s.addRow([`Bookings made in ${r.label}, confirmed or completed. Amounts in LKR; payouts settled in ${currency}.`]);
  s.addRow([]);
  const lines: Array<[string, number, boolean?]> = [
    ["Bookings", r.totals.bookings, false],
    ["Booking value (before fees)", rupees(r.totals.bookingValue)],
    ["Guests paid in total", rupees(r.totals.total)],
    ["  of which paid online", rupees(r.totals.online)],
    ["  of which cash to providers", rupees(r.totals.cash)],
    ["Commission from providers", rupees(r.totals.commission)],
    ["Service fees from guests", rupees(r.totals.serviceFee)],
    ["Brand revenue", rupees(r.totals.brandRevenue)],
    ["Platform fee", rupees(r.totals.platformFee)],
    ["Net income", rupees(r.totals.brandNet)],
    ["Provider earnings", rupees(r.totals.providerShare)],
    ["Cancelled or declined bookings", r.cancelled.count, false],
    ["Refunded to guests", rupees(r.cancelled.refunded)],
  ];
  for (const [label, value, isMoney = true] of lines) {
    const row = s.addRow([label, value]);
    if (isMoney) row.getCell(2).numFmt = money;
    if (label === "Net income") row.font = { bold: true };
  }

  const b = wb.addWorksheet("Bookings");
  b.columns = [
    { header: "Ref", key: "ref", width: 11 }, { header: "Booked on", key: "bookedOn", width: 12 }, { header: "Start", key: "startDate", width: 12 },
    { header: "Guest", key: "guest", width: 20 }, { header: "Email", key: "email", width: 26 }, { header: "Listing", key: "listing", width: 34 },
    { header: "Provider", key: "provider", width: 22 }, { header: "Payment", key: "payMethod", width: 15 }, { header: "Status", key: "status", width: 11 },
    { header: "Guest paid", key: "total", width: 14 }, { header: "Paid online", key: "online", width: 14 }, { header: "Cash", key: "cash", width: 13 },
    { header: "Provider earns", key: "providerShare", width: 15 }, { header: "Provider settlement", key: "providerSettlement", width: 18 },
    { header: "Commission", key: "commission", width: 13 }, { header: "Service fee", key: "serviceFee", width: 13 },
    { header: "Brand revenue", key: "brandRevenue", width: 15 }, { header: "Platform fee", key: "platformFee", width: 14 }, { header: "Net income", key: "brandNet", width: 14 },
  ];
  const moneyKeys = ["total", "online", "cash", "providerShare", "providerSettlement", "commission", "serviceFee", "brandRevenue", "platformFee", "brandNet"] as const;
  for (const row of r.rows) {
    const out: Record<string, string | number> = { ...row };
    for (const k of moneyKeys) out[k] = rupees(row[k]);
    b.addRow(out);
  }
  if (r.rows.length) {
    const first = 2, last = r.rows.length + 1;
    const totalRow = b.addRow({ ref: "Total" });
    moneyKeys.forEach(k => {
      const col = b.getColumn(k).letter;
      totalRow.getCell(k).value = { formula: `SUM(${col}${first}:${col}${last})` };
    });
    totalRow.font = { bold: true };
  }
  b.getRow(1).font = { bold: true };
  b.views = [{ state: "frozen", ySplit: 1 }];
  moneyKeys.forEach(k => { b.getColumn(k).numFmt = money; });
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

function toPdf(brandName: string, r: MonthlyReport): Promise<Uint8Array> {
  return new Promise(resolve => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));

    doc.fontSize(18).font("Helvetica-Bold").text(`${brandName}: income report`);
    doc.fontSize(11).font("Helvetica").fillColor("#555").text(`${r.label} · bookings made this month, confirmed or completed · generated ${new Date().toISOString().slice(0, 10)}`);
    doc.moveDown(0.8).fillColor("#000");

    const summary: Array<[string, string]> = [
      ["Bookings", String(r.totals.bookings)], ["Guests paid", rs(r.totals.total)], ["Paid online", rs(r.totals.online)], ["Cash to providers", rs(r.totals.cash)],
      ["Brand revenue", rs(r.totals.brandRevenue)], ["Platform fee", rs(r.totals.platformFee)], ["Net income", rs(r.totals.brandNet)],
      ["Cancelled / declined", `${r.cancelled.count} (refunded ${rs(r.cancelled.refunded)})`],
    ];
    const colW = 190; let x = 36, y = doc.y;
    summary.forEach(([k, v], i) => {
      if (i === 4) { x = 36; y += 40; }
      doc.fontSize(9).font("Helvetica").fillColor("#555").text(k, x, y, { width: colW - 10 });
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#000").text(v, x, y + 12, { width: colW - 10 });
      x += colW;
    });
    doc.y = y + 48;

    const cols: Array<{ h: string; w: number; get: (row: (typeof r.rows)[number]) => string; right?: boolean }> = [
      { h: "Ref", w: 60, get: x => x.ref }, { h: "Booked", w: 62, get: x => x.bookedOn }, { h: "Guest", w: 90, get: x => x.guest },
      { h: "Listing", w: 150, get: x => x.listing }, { h: "Payment", w: 70, get: x => x.payMethod },
      { h: "Guest paid", w: 72, get: x => rs(x.total), right: true }, { h: "Online", w: 66, get: x => rs(x.online), right: true },
      { h: "Revenue", w: 66, get: x => rs(x.brandRevenue), right: true }, { h: "Platform fee", w: 66, get: x => rs(x.platformFee), right: true },
      { h: "Net", w: 66, get: x => rs(x.brandNet), right: true },
    ];
    const header = () => {
      let cx = 36; const hy = doc.y;
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#000");
      cols.forEach(c => { doc.text(c.h, cx, hy, { width: c.w - 6, align: c.right ? "right" : "left" }); cx += c.w; });
      doc.moveTo(36, hy + 13).lineTo(36 + cols.reduce((a, c) => a + c.w, 0), hy + 13).strokeColor("#999").stroke();
      doc.y = hy + 18;
    };
    header();
    doc.font("Helvetica").fontSize(8.5);
    if (r.rows.length === 0) doc.text("No confirmed bookings this month.", 36, doc.y);
    for (const row of r.rows) {
      if (doc.y > doc.page.height - 60) { doc.addPage(); header(); doc.font("Helvetica").fontSize(8.5); }
      let cx = 36; const ry = doc.y;
      cols.forEach(c => { doc.text(c.get(row), cx, ry, { width: c.w - 6, align: c.right ? "right" : "left", lineBreak: false, ellipsis: true }); cx += c.w; });
      doc.y = ry + 15;
    }
    doc.end();
  });
}
