import { NextResponse, type NextRequest } from "next/server";

// One app, two faces: the platform console lives only on PLATFORM_HOST (e.g. platform.dbsgroup.io),
// brand sites never expose it. Console pages are under /platform and reached by rewriting paths.
export function middleware(req: NextRequest) {
  const platformHost = (process.env.PLATFORM_HOST || "platform.dbsgroup.io").toLowerCase();
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(":")[0].toLowerCase();
  const { pathname } = req.nextUrl;
  const shared = pathname.startsWith("/_next") || pathname.startsWith("/media/") || pathname.startsWith("/auth/") || pathname.startsWith("/account/") || pathname === "/favicon.ico";

  if (platformHost && host === platformHost) {
    if (shared || pathname.startsWith("/platform")) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/platform" + (pathname === "/" ? "" : pathname);
    return NextResponse.rewrite(url);
  }
  if (pathname === "/platform" || pathname.startsWith("/platform/")) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
