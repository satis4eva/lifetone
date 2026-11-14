import Link from "next/link";
import { requireBrandAdmin } from "@/lib/auth";
import { getBrand } from "@/lib/brand";

export const dynamic = "force-dynamic";

const TABS: Array<[string, string]> = [
  ["/portal", "Overview"], ["/portal/bookings", "Bookings"], ["/portal/listings", "Listings"], ["/portal/payouts", "Payouts"], ["/portal/reports", "Reports"],
  ["/portal/emails", "Guest emails"], ["/portal/updates", "Updates"], ["/portal/settings", "Brand settings"],
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const [user, brand] = await Promise.all([requireBrandAdmin(), getBrand()]);
  return (
    <div className="stack">
      <div><h1>{brand.name} client portal</h1><p className="muted" style={{ margin: "4px 0 0" }}>Signed in as {user.email}</p></div>
      <nav className="subnav" aria-label="Portal">{TABS.map(([href, label]) => <Link key={href} className="chip" href={href}>{label}</Link>)}</nav>
      {children}
    </div>
  );
}
