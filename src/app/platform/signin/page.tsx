import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { baseUrl, isPlatformHost } from "@/lib/brand";
import { createLoginToken, safeNext } from "@/lib/auth";
import { PLATFORM_SENDER, sendEmail } from "@/lib/email";
import { verifyPassword } from "@/lib/password";
import { setSession } from "@/lib/session";

export const metadata = { title: "Sign in" };
const LOCK_AFTER = 5, LOCK_MINUTES = 15;
const findAdmin = (email: string) => db.user.findFirst({ where: { brandId: null, email, role: "PLATFORM_ADMIN" } });
const dest = (n?: string | null) => (n ? safeNext(n) : "/");

export default function PlatformSignIn({ searchParams }: { searchParams: { next?: string; mode?: string; sent?: string; error?: string } }) {
  if (!isPlatformHost()) redirect("/");
  async function withPassword(form: FormData) {
    "use server";
    const email = String(form.get("email") || "").trim().toLowerCase();
    const user = await findAdmin(email);
    if (user?.lockedUntil && user.lockedUntil > new Date()) redirect("/signin?error=locked");
    if (!user || !(await verifyPassword(String(form.get("password") || ""), user.passwordHash))) {
      if (user) {
        const failed = user.failedLogins + 1;
        await db.user.update({ where: { id: user.id }, data: failed >= LOCK_AFTER ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLogins: failed } });
      }
      redirect(`/signin?error=${user && !user.passwordHash ? "nopassword" : "wrong"}`);
    }
    await db.user.update({ where: { id: user!.id }, data: { failedLogins: 0, lockedUntil: null } });
    setSession(user!.id, form.get("remember") === "on" ? 30 : 1);
    redirect(dest(String(form.get("next") || "")));
  }
  async function withLink(form: FormData) {
    "use server";
    const email = String(form.get("email") || "").trim().toLowerCase();
    const reset = form.get("purpose") === "reset";
    const user = await findAdmin(email);
    const recent = user ? await db.loginToken.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 15 * 60_000) } } }) : 0;
    if (user && recent < 3) {
      const token = await createLoginToken(user.id, reset ? "/account/password" : "/");
      await sendEmail(PLATFORM_SENDER, {
        to: email, subject: reset ? "Platform: reset your password" : "Platform: your sign-in link",
        text: `${reset ? "Use this link to choose a new password." : "Use this link to sign in to the platform console."} It works once and expires in 30 minutes.\n\n${await baseUrl()}/auth/verify?token=${token}\n\nIf you didn't ask for this, ignore this email.`,
      });
    }
    redirect("/signin?sent=1");
  }
  const err = searchParams.error;
  const msg = err === "wrong" ? "Email or password is incorrect." : err === "nopassword" ? "No password set yet: use an email link below, then choose one." : err === "locked" ? `Too many attempts. Try again in ${LOCK_MINUTES} minutes or use an email link.` : err === "link" ? "That link has expired or was already used." : null;
  if (searchParams.sent) return <div className="card stack" style={{ maxWidth: 480 }}><h1>Check your inbox</h1><p style={{ margin: 0 }}>If that address is a platform admin, a link is on its way. It works for 30 minutes.</p><div><Link className="btn ghost" href="/signin">Back</Link></div></div>;
  const linkMode = searchParams.mode === "link" || searchParams.mode === "reset";
  return (
    <div className="stack" style={{ maxWidth: 480 }}>
      {msg && <p className="error" role="alert" style={{ margin: 0 }}>{msg}</p>}
      {!linkMode ? (
        <form action={withPassword} className="card stack">
          <h1>Platform sign-in</h1>
          <input type="hidden" name="next" value={searchParams.next ?? ""} />
          <label>Email<input type="email" name="email" required autoComplete="username" /></label>
          <label>Password<input type="password" name="password" required autoComplete="current-password" /></label>
          <label className="check"><input type="checkbox" name="remember" /> Keep me signed in for 30 days</label>
          <div className="row" style={{ justifyContent: "space-between" }}><button className="btn" type="submit">Sign in</button><Link href="/signin?mode=reset">Forgot password?</Link></div>
          <p className="muted" style={{ margin: 0 }}>First time? <Link href="/signin?mode=link">Email me a sign-in link</Link></p>
        </form>
      ) : (
        <form action={withLink} className="card stack">
          <h1>{searchParams.mode === "reset" ? "Reset password" : "Sign in with an email link"}</h1>
          <input type="hidden" name="purpose" value={searchParams.mode === "reset" ? "reset" : "signin"} />
          <label>Email<input type="email" name="email" required autoComplete="username" /></label>
          <div className="row" style={{ justifyContent: "space-between" }}><button className="btn" type="submit">Send link</button><Link href="/signin">Use password</Link></div>
        </form>
      )}
    </div>
  );
}
