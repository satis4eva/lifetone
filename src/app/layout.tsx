import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getBrand } from "@/lib/brand";
import { currentUser } from "@/lib/auth";

// Every page depends on the brand (from the request's domain), so nothing is pre-rendered at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return { title: { default: brand.name, template: `%s · ${brand.name}` }, description: brand.tagline };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [brand, user] = await Promise.all([getBrand(), currentUser()]);
  const isAdmin = user?.role === "BRAND_ADMIN" || user?.role === "PLATFORM_ADMIN";
  return (
    <html lang="en" style={{ "--accent": brand.color } as React.CSSProperties}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Nunito+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header className="top">
          <div className="top-in">
            <Link href="/" className="brand">
              <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#fff" /><path d="M20 30c0-7 1-12 6-17" stroke="#0a6a63" strokeWidth="2.4" fill="none" strokeLinecap="round" /><path d="M26 13c-4-3-9-2-11 1 4-1 7 0 11-1zM26 13c1-5-2-8-6-8 2 2 4 5 6 8zM26 13c4-2 8-1 9 3-3-2-6-2-9-3z" fill="#3fa34d" /><path d="M7 30c4-2 8-2 13 0s9 2 13 0" stroke="#13b5a6" strokeWidth="2.4" fill="none" strokeLinecap="round" /></svg>
              <span>{brand.name}<small>{brand.tagline}</small></span>
            </Link>
            <nav className="nav" aria-label="Main">
              <Link href="/">Explore</Link>
              <Link href="/bookings">My bookings</Link>
              <Link href="/providers/join">List your service</Link>
              {isAdmin && <Link href="/portal">Client portal</Link>}
              {user?.role === "PLATFORM_ADMIN" && <Link href="/admin">Platform</Link>}
              {user ? (
                <form action="/auth/signout" method="post"><button type="submit">Sign out</button></form>
              ) : (
                <Link href="/signin" className="cta-link">Sign in</Link>
              )}
            </nav>
          </div>
        </header>
        {process.env.DEMO_MODE === "true" && (
          <div className="demo">Test site: card payments are simulated and no money is taken.</div>
        )}
        <main>{children}</main>
        <footer className="site">
          <div className="in">
            <span>© {brand.name} · {brand.domains.find(d => !d.includes("localhost")) ?? ""}</span>
            <span>Licensed local providers · Secure payments by DPayments · <a href="/providers/join">List your service</a></span>
          </div>
        </footer>
      </body>
    </html>
  );
}
