/**
 * Optional claim-report email, sent to the site owner when a vendor claims a
 * business, so a claim does not sit unnoticed in the retroactive-review queue.
 *
 * Deliberately OPTIONAL and non-blocking: claims auto-approve, so this is a
 * convenience nudge, not a gate. If `RESEND_API_KEY` is unset (or the send
 * fails), we log and return — a claim must never fail because email is not
 * configured. The admin page (/portal/admin) plus the PostHog
 * `vendor_claim_created` event are the durable review trail; this is the ping.
 *
 * Uses Resend (https://resend.com) via a single fetch — no SDK dependency. The
 * sender defaults to Resend's shared test domain so it works before a custom
 * domain is verified; set CLAIM_REPORT_FROM once a domain is in place.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "Wedding Recon <onboarding@resend.dev>";
const DEFAULT_TO = "kiaramcnulty@gmail.com";

export interface ClaimReport {
  vendorName: string;
  vendorType: string;
  city: string | null;
  claimantEmail: string;
  /** True when the claimant email domain matches the vendor website domain. */
  emailDomainMatchesWebsite: boolean | null;
  /** Absolute or app-relative link to the admin review page. */
  adminUrl: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendClaimReport(report: ClaimReport): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Not an error: email is optional. Say so once, at info level.
    console.info(
      "[claim-report] RESEND_API_KEY unset; skipping claim email for",
      report.vendorName,
    );
    return;
  }

  const to = process.env.CLAIM_REPORT_EMAIL || DEFAULT_TO;
  const from = process.env.CLAIM_REPORT_FROM || DEFAULT_FROM;

  const match =
    report.emailDomainMatchesWebsite === true
      ? "yes (email domain matches the vendor website)"
      : report.emailDomainMatchesWebsite === false
        ? "no (free/other email domain — worth a look)"
        : "unknown (vendor has no website on file)";

  const subject = `New vendor claim: ${report.vendorName}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6">
      <p><strong>${escapeHtml(report.vendorName)}</strong> was just claimed.</p>
      <ul>
        <li>Type: ${escapeHtml(report.vendorType)}</li>
        <li>City: ${escapeHtml(report.city ?? "—")}</li>
        <li>Claimant email: ${escapeHtml(report.claimantEmail)}</li>
        <li>Domain match: ${escapeHtml(match)}</li>
      </ul>
      <p><a href="${escapeHtml(report.adminUrl)}">Review in the admin page</a></p>
      <p style="color:#888;font-size:12px">Claims auto-approve; this is a heads-up for retroactive review.</p>
    </div>`.trim();

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[claim-report] Resend send failed", res.status, body);
    }
  } catch (e) {
    console.error("[claim-report] Resend send threw", e);
  }
}

/**
 * Whether the claimant's email domain matches the vendor's website domain.
 * Returns null when either side is missing, so the caller can store a tri-state
 * (yes / no / unknown) for the review page. `www.` is stripped from the site
 * host so `owner@acme.com` matches `https://www.acme.com`.
 */
export function emailMatchesWebsite(
  email: string,
  website: string | null | undefined,
): boolean | null {
  if (!website) return null;
  const emailDomain = email.split("@")[1]?.toLowerCase().trim();
  if (!emailDomain) return null;
  let host: string;
  try {
    const url = website.includes("://") ? website : `https://${website}`;
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  return host === emailDomain;
}
