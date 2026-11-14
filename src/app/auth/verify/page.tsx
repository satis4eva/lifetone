import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken, safeNext } from "@/lib/auth";
import { setSession } from "@/lib/session";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

// Magic-link landing. Opening the link only shows a button; the token is used when the person
// presses it (a POST). That stops email link scanners from using up the link before the guest clicks.
export default async function Verify({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token || "";
  const rec = token ? await db.loginToken.findUnique({ where: { tokenHash: hashToken(token) } }) : null;
  const valid = !!rec && !rec.usedAt && rec.expiresAt > new Date();

  async function signIn(form: FormData) {
    "use server";
    const t = String(form.get("token") || "");
    const r = await db.loginToken.findUnique({ where: { tokenHash: hashToken(t) } });
    if (!r) redirect("/signin?error=link");
    // Atomic: only one request can use the token.
    const used = await db.loginToken.updateMany({
      where: { id: r.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() },
    });
    if (used.count !== 1) redirect("/signin?error=link");
    setSession(r.userId, 30);
    const user = await db.user.findUnique({ where: { id: r.userId } });
    const dest = safeNext(r.next);
    // First time in: admins choose a password so they don't need an email link every time.
    if (user && !user.passwordHash && user.role !== "GUEST" && !dest.startsWith("/account/password")) {
      redirect(`/account/password?next=${encodeURIComponent(dest)}`);
    }
    redirect(dest);
  }

  if (!valid) redirect("/signin?error=link");
  return (
    <form action={signIn} className="card stack" style={{ maxWidth: 480 }}>
      <h1>Sign in</h1>
      <p style={{ margin: 0 }}>Press the button to finish signing in.</p>
      <input type="hidden" name="token" value={token} />
      <div><button className="btn" type="submit">Continue</button></div>
    </form>
  );
}
