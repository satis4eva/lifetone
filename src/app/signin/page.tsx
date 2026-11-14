import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { baseUrl, getBrand } from "@/lib/brand";
import { createLoginToken, safeNext } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export const metadata = { title: "Sign in" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignIn({ searchParams }: { searchParams: { next?: string; sent?: string; error?: string } }) {
  async function requestLink(form: FormData) {
    "use server";
    const brand = await getBrand();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const next = safeNext(String(form.get("next") || ""));
    if (!EMAIL.test(email)) redirect(`/signin?error=email&next=${encodeURIComponent(next)}`);
    const user =
      (await db.user.findUnique({ where: { brandId_email: { brandId: brand.id, email } } })) ??
      (await db.user.findFirst({ where: { brandId: null, email, role: "PLATFORM_ADMIN" } }));
    // At most 3 links per address every 15 minutes.
    const recent = user ? await db.loginToken.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 15 * 60_000) } } }) : 0;
    if (user && recent < 3) {
      const token = await createLoginToken(user.id, next);
      await sendEmail(brand, {
        to: email, subject: `${brand.name}: your sign-in link`,
        text: `Use this link to sign in. It works once and expires in 30 minutes.\n\n${await baseUrl()}/auth/verify?token=${token}\n\nIf you didn't ask for this, you can ignore this email.`,
      });
    }
    // Same response either way, so the form doesn't reveal who has an account.
    redirect(`/signin?sent=1&next=${encodeURIComponent(next)}`);
  }

  return (
    <div className="card stack" style={{ maxWidth: 520 }}>
      <h1>Sign in</h1>
      {searchParams.sent ? (
        <p style={{ margin: 0 }}>Check your inbox. If the address matches a booking or account, we've sent a sign-in link that works for 30 minutes.</p>
      ) : (
        <form action={requestLink} className="stack">
          <p className="muted" style={{ margin: 0 }}>No password needed. Enter the email you booked with and we'll send you a sign-in link.</p>
          <input type="hidden" name="next" value={safeNext(searchParams.next)} />
          <label>Email address<input type="email" name="email" required autoComplete="email" /></label>
          {searchParams.error === "email" && <p className="error">Enter a valid email address.</p>}
          {searchParams.error === "link" && <p className="error">That link has expired or was already used. Request a new one.</p>}
          <div><button className="btn" type="submit">Email me a sign-in link</button></div>
        </form>
      )}
    </div>
  );
}
