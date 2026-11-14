import { db } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { emailConfigured } from "@/lib/email";
import { requireBrandAdmin } from "@/lib/auth";

export default async function Emails() {
  await requireBrandAdmin();
  const brand = await getBrand();
  const emails = await db.email.findMany({ where: { brandId: brand.id }, orderBy: { createdAt: "desc" }, take: 200 });
  const configured = emailConfigured(brand);
  return (
    <div className="card stack">
      <h2>Guest emails</h2>
      <p className="muted" style={{ margin: 0 }}>
        {configured ? (process.env.SMTP_USER ? `Sent from ${process.env.SMTP_USER}${process.env.SMTP_REPLY_TO ? `; replies go to ${process.env.SMTP_REPLY_TO}` : ""}.` : `Sent from ${brand.emailFrom} through Resend.`) : "Email sending isn't set up yet, so emails are logged here only. Add SMTP settings (or Resend) to send them."}
      </p>
      {emails.map(e => (
        <details key={e.id} className="card" style={{ padding: "10px 12px" }}>
          <summary style={{ cursor: "pointer" }}><strong>{e.subject}</strong> <span className="muted">to {e.to} · {e.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {e.status}</span></summary>
          <pre className="mail">{e.body}</pre>
          {e.error && <p className="error">{e.error}</p>}
        </details>
      ))}
      {emails.length === 0 && <p className="muted">No emails yet.</p>}
    </div>
  );
}
