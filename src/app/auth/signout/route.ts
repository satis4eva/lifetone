import { clearSession } from "@/lib/session";

// Relative redirect: behind the proxy, req.url is the container's internal address (0.0.0.0:3000),
// so building an absolute URL from it sent people to the wrong host.
export async function POST() {
  clearSession();
  return new Response(null, { status: 303, headers: { Location: "/" } });
}
