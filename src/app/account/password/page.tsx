import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { currentUser, safeNext } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { hashPassword, passwordProblem, MIN_PASSWORD } from "@/lib/password";

export const metadata = { title: "Password" };
export const dynamic = "force-dynamic";

export default async function PasswordPage({ searchParams }: { searchParams: { next?: string; error?: string; done?: string } }) {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/account/password");
  const next = safeNext(searchParams.next || (user.role === "GUEST" ? "/bookings" : "/portal"));

  async function save(form: FormData) {
    "use server";
    const me = await currentUser();
    if (!me) redirect("/signin?next=/account/password");
    const nxt = safeNext(String(form.get("next") || ""));
    const pw = String(form.get("password") || ""), confirm = String(form.get("confirm") || "");
    const problem = passwordProblem(pw, confirm);
    if (problem) redirect("/account/password?" + new URLSearchParams({ next: nxt, error: problem }).toString());
    const hadPassword = !!me.passwordHash;
    await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(pw), failedLogins: 0, lockedUntil: null } });
    const brand = await getBrand();
    await sendEmail(brand, {
      to: me.email,
      subject: `${brand.name}: your password was ${hadPassword ? "changed" : "set"}`,
      text: `Your ${brand.name} password was just ${hadPassword ? "changed" : "set"}. You can now sign in with your email and password.\n\nIf this wasn't you, use "Forgot password?" on the sign-in page straight away to choose a new one.`,
    });
    redirect(nxt);
  }

  return (
    <form action={save} className="card stack" style={{ maxWidth: 520 }}>
      <h1>{user.passwordHash ? "Change your password" : "Set a password"}</h1>
      <p className="muted" style={{ margin: 0 }}>
        {user.passwordHash ? `Signed in as ${user.email}.` : `Next time, sign in with ${user.email} and this password; no email link needed. If you forget it, you can reset it by email.`}
      </p>
      {searchParams.error && <p className="error" role="alert" style={{ margin: 0 }}>{searchParams.error}</p>}
      <input type="hidden" name="next" value={next} />
      <label>New password<input type="password" name="password" required minLength={MIN_PASSWORD} autoComplete="new-password" /></label>
      <label>Type it again<input type="password" name="confirm" required minLength={MIN_PASSWORD} autoComplete="new-password" /></label>
      <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>At least {MIN_PASSWORD} characters. A short phrase is easier to remember than random characters.</p>
      <div className="row">
        <button className="btn" type="submit">Save password</button>
        {user.role === "GUEST" && !user.passwordHash && <a className="btn ghost" href={next}>Not now</a>}
      </div>
    </form>
  );
}
