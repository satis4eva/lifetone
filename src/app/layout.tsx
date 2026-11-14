import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getBrand } from "@/lib/brand";
import { currentUser } from "@/lib/auth";

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
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header className="top">
          <div className="top-in">
            <Link href="/" className="brand">{brand.name}<small>{brand.tagline}</small></Link>
            <nav className="nav" aria-label="Main">
              <Link href="/">Explore</Link>
              <Link href="/bookings">My bookings</Link>
              <Link href="/providers/join">List your service</Link>
              {isAdmin && <Link href="/portal">Client portal</Link>}
              {user?.role === "PLATFORM_ADMIN" && <Link href="/admin">Platform</Link>}
              {user ? (
                <form action="/auth/signout" method="post"><button type="submit">Sign out</button></form>
              ) : (
                <Link href="/signin">Sign in</Link>
              )}
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
