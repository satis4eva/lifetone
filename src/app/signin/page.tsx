import Link from "next/link";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { baseUrl, getBrand } from "@/lib/brand";
import { createLoginToken, safeNext } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { verifyPassword } from "@/lib/password";
import { setSession } from "@/lib/session";

export const metadata = { title: "Sign in" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCK_AFTER = 5, LOCK_MINUTES = 15;

async function findUser(email: string): Promise<User | null> {
  const brand = await getBrand();
  const u = await db.user.findUnique({ where: { brandId_email: { brandId: brand.id, email } } });
  return u && u.role !== "PLATFORM_ADMIN" ? u : null;
}

type Search = { next?: string; sent?: string; error?: string; mode?: string; email?: string };

export default function SignIn({ searchParams }: { searchParams: Search }) {
  const next = safeNext(searchParams.next);
  const q = (extra: Record<string, string>) => "/signin?" + new URLSearchParams({ next, ...extra }).toString();

  async function passwordSignIn(form: FormData) {
    "use server";
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const nxt = safeNext(String(form.get("next") || ""));
    const back = (error: string) => redirect("/signin?" + new URLSearchParams({ next: nxt, error, email }).toString());
    if (!EMAIL.test(email) || !password) back("missing");
    const user = await findUser(email);
    if (user?.lockedUntil && user.lockedUntil > new Date()) back("locked");
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      if (user) {
        const failed = user.failedLogins + 1;
        await db.user.update({
          where: { id: user.id },
          data: failed >= LOCK_AFTER ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLogins: failed },
        });
      }
      back(user && !user.passwordHash ? "nopassword" : "wrong");
    }
    await db.user.update({ where: { id: user!.id }, data: { failedLogins: 0, lockedUntil: null } });
    setSession(user!.id, form.get("remember") === "on" ? 90 : 1);
    redirect(nxt);
  }

  async function requestLink(form: FormData) {
    "use server";
    const brand = await getBrand();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const nxt = safeNext(String(form.get("next") || ""));
    const reset = form.get("purpose") === "reset";
    if (!EMAIL.test(email)) redirect("/signin?" + new URLSearchParams({ next: nxt, mode: "link", error: "email" }).toString());
    const user = await findUser(email);
    // At most 3 links per address every 15 minutes.
    const recent = user ? await db.loginToken.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 15 * 60_000) } } }) : 0;
    if (user && recent < 3) {
      const target = reset ? `/account/password?next=${encodeURIComponent(nxt)}` : nxt;
      const token = await createLoginToken(user.id, target);
      await sendEmail(brand, {
        to: email,
        subject: reset ? `${brand.name}: reset your password` : `${brand.name}: your sign-in link`,
        text: `${reset ? "Use this link to choose a new password." : "Use this link to sign in."} It works once and expires in 30 minutes.\n\n${await baseUrl()}/auth/verify?token=${token}\n\nIf you didn't ask for this, you can ignore this email.`,
      });
    }
    // Same response either way, so the form doesn't reveal who has an account.
    redirect("/signin?" + new URLSearchParams({ next: nxt, sent: reset ? "reset" : "link" }).toString());
  }

  const err = searchParams.error;
  const errorText =
    err === "wrong" ? "Email or password is incorrect." :
    err === "nopassword" ? "You haven't set a password yet. Use \"Email me a sign-in link\" below; after signing in you can set one." :
    err === "locked" ? `Too many attempts. Try again in ${LOCK_MINUTES} minutes, or use an email link.` :
    err === "missing" ? "Enter your email and password." :
    err === "email" ? "Enter a valid email address." :
    err === "link" ? "That link has expired or was already used. Request a new one." : null;

  if (searchParams.sent) return (
    <div className="card stack" style={{ maxWidth: 520 }}>
      <h1>Check your inbox</h1>
      <p style={{ margin: 0 }}>If the address matches a booking or account, we've sent {searchParams.sent === "reset" ? "a link to choose a new password" : "a sign-in link"}. It works for 30 minutes. Check your spam folder if it hasn't arrived in a few minutes.</p>
      <div><Link className="btn ghost" href={q({})}>Back to sign in</Link></div>
    </div>
  );

  const linkMode = searchParams.mode === "link" || searchParams.mode === "reset";
  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      {errorText && <p className="error" role="alert" style={{ margin: 0 }}>{errorText}</p>}
      {!linkMode ? (
        <form action={passwordSignIn} className="card stack">
          <h1>Sign in</h1>
          <input type="hidden" name="next" value={next} />
          <label>Email address<input type="email" name="email" required autoComplete="email" defaultValue={searchParams.email ?? ""} /></label>
          <label>Password<input type="password" name="password" required autoComplete="current-password" /></label>
          <label className="check"><input type="checkbox" name="remember" defaultChecked /> Keep me signed in on this device</label>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button className="btn" type="submit">Sign in</button>
            <Link href={q({ mode: "reset" })}>Forgot password?</Link>
          </div>
          <p className="muted" style={{ margin: 0 }}>No password yet, or booked as a guest? <Link href={q({ mode: "link" })}>Email me a sign-in link</Link></p>
        </form>
      ) : (
        <form action={requestLink} className="card stack">
          <h1>{searchParams.mode === "reset" ? "Reset your password" : "Sign in with an email link"}</h1>
          <p className="muted" style={{ margin: 0 }}>{searchParams.mode === "reset" ? "We'll email you a link to choose a new password." : "No password needed: we'll email you a link that signs you in."}</p>
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="purpose" value={searchParams.mode === "reset" ? "reset" : "signin"} />
          <label>Email address<input type="email" name="email" required autoComplete="email" /></label>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button className="btn" type="submit">{searchParams.mode === "reset" ? "Email me a reset link" : "Email me a sign-in link"}</button>
            <Link href={q({})}>Sign in with password</Link>
          </div>
        </form>
      )}
    </div>
  );
}
