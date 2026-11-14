import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getBrand, isPlatformHost } from "@/lib/brand";
import { currentUser } from "@/lib/auth";
import { fontPair } from "@/lib/theme";

// Every page depends on the brand (from the request's domain), so nothing is pre-rendered at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  if (isPlatformHost()) return { title: { default: "Platform", template: "%s · Platform" }, robots: { index: false, follow: false } };
  const brand = await getBrand();
  return { title: { default: brand.name, template: `%s · ${brand.name}` }, description: brand.tagline, icons: brand.logoUrl ? [{ url: brand.logoUrl }] : undefined };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  if (isPlatformHost()) return <PlatformShell>{children}</PlatformShell>;
  const [brand, user] = await Promise.all([getBrand(), currentUser()]);
  const fonts = fontPair(brand.fontPair);
  const style = {
    "--accent": brand.color, "--brand-cta": brand.ctaColor, "--brand-bg": brand.bgColor,
    "--brand-display": `"${fonts.display}"`, "--brand-body": `"${fonts.body}"`,
  } as React.CSSProperties;
  return (
    <html lang="en" style={style}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href={`https://fonts.googleapis.com/css2?${fonts.css}&display=swap`} rel="stylesheet" />
      </head>
      <body>
        <header className="top">
          <div className="top-in">
            <Link href="/" className="brand">
              {brand.logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={brand.logoUrl} alt="" width={40} height={40} style={{ borderRadius: 10, objectFit: "contain", background: "#fff" }} />
                : <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#fff" /><path d="M20 30c0-7 1-12 6-17" stroke="#0a6a63" strokeWidth="2.4" fill="none" strokeLinecap="round" /><path d="M26 13c-4-3-9-2-11 1 4-1 7 0 11-1zM26 13c1-5-2-8-6-8 2 2 4 5 6 8zM26 13c4-2 8-1 9 3-3-2-6-2-9-3z" fill="#3fa34d" /><path d="M7 30c4-2 8-2 13 0s9 2 13 0" stroke="#13b5a6" strokeWidth="2.4" fill="none" strokeLinecap="round" /></svg>}
              <span>{brand.name}<small>{brand.tagline}</small></span>
            </Link>
            {brand.active && (
              <nav className="nav" aria-label="Main">
                <Link href="/">Explore</Link>
                <Link href="/bookings">My bookings</Link>
                <Link href="/providers/join">List your service</Link>
                {user?.role === "BRAND_ADMIN" && <Link href="/portal">Client portal</Link>}
                {user ? (
                  <>
                    <Link href="/account/password">Password</Link>
                    <form action="/auth/signout" method="post"><button type="submit">Sign out</button></form>
                  </>
                ) : (
                  <Link href="/signin" className="cta-link">Sign in</Link>
                )}
              </nav>
            )}
          </div>
        </header>
        {process.env.DEMO_MODE === "true" && brand.active && (
          <div className="demo">Test site: card payments are simulated and no money is taken.</div>
        )}
        <main>
          {brand.active ? children : (
            <div className="card stack" style={{ maxWidth: 560 }}>
              <h1>We&apos;ll be back soon</h1>
              <p style={{ margin: 0 }}>{brand.name} is temporarily unavailable. Please check back later.</p>
            </div>
          )}
        </main>
        <footer className="site">
          <div className="in">
            <span>© {brand.name} · {brand.domains.find(d => !d.includes("localhost")) ?? ""}</span>
            <span>Licensed local providers · Secure payments · <a href="/providers/join">List your service</a></span>
          </div>
        </footer>
      </body>
    </html>
  );
}

async function PlatformShell({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en" style={{ "--accent": "#1f2a44", "--brand-cta": "#2563eb", "--brand-bg": "#f5f6f8", "--brand-display": '"Manrope"', "--brand-body": '"Inter"' } as React.CSSProperties}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header className="top">
          <div className="top-in">
            <Link href="/" className="brand"><span>DBS Group<small>Platform console</small></span></Link>
            {user && (
              <nav className="nav" aria-label="Platform">
                <Link href="/">Brands</Link>
                <Link href="/brands/new">New brand</Link>
                <Link href="/account/password">Password</Link>
                <form action="/auth/signout" method="post"><button type="submit">Sign out</button></form>
              </nav>
            )}
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
