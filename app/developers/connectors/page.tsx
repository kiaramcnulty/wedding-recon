import type { Metadata } from "next";
import Link from "next/link";
import { BrandFooter } from "@/components/brand-lockup";

export const metadata: Metadata = {
  title: "Connector API",
  description: "Documentation for the read-only Wedding Recon vendor research API.",
};

const codeClass = "overflow-x-auto rounded-xl bg-muted px-4 py-3 font-mono text-xs leading-relaxed";

export default function ConnectorDocsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-5 py-10">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Developers</p>
        <h1 className="text-3xl font-semibold tracking-tight">Wedding Recon connector API</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          A versioned, read-only JSON API for finding and comparing Colorado wedding vendors using recorded prices and structured attributes. It does not book vendors, take payments, expose private Planning Hub data, or provide live availability.
        </p>
        <div className="flex gap-4 text-sm">
          <Link className="text-primary underline underline-offset-4" href="/openapi.json">OpenAPI 3.0.3</Link>
          <Link className="text-primary underline underline-offset-4" href="/privacy">Privacy policy</Link>
          <Link className="text-primary underline underline-offset-4" href="/terms">Terms</Link>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Authentication and limits</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Send the dedicated partner credential in <code>X-API-Key</code>. Credentials must never appear in URLs or logs. Launch quotas default to 60 data requests per minute plus a configurable daily cap. A quota-enforcement outage returns 503; it never silently disables protection.
        </p>
        <pre className={codeClass}>{`curl -H "X-API-Key: $WEDDING_RECON_API_KEY" \\
  "https://www.weddingrecon.com/api/connectors/v1/capabilities"`}</pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Operations</h2>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p><code>GET /capabilities</code> publishes category IDs, filters and units, maintained location IDs, conversion defaults, limits, and ranking disclosures.</p>
          <p><code>GET /vendors</code> supports structured discovery or a vendor name/address/city lookup. A discovery search requires one category. <code>q</code> is not a natural-language prompt.</p>
          <p><code>GET /vendors/{`{vendor_id}`}</code> returns selected public fields, effective published attributes, a separate vendor-authored listing block, and a bounded page of active recon.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Example searches</h2>
        <pre className={codeClass}>{`# Photographers based near Boulder with reported package pricing
# that may overlap a $4,000 ceiling
/vendors?category=photos&location_id=boulder-co&radius_miles=25&budget_max=4000&budget_basis=package

# Denver venues recorded for at least 120 guests and a $10,000 ceiling
/vendors?category=venue&location_id=denver-co&guest_count=120&budget_max=10000&budget_basis=package

# Named florist lookup
/vendors?q=wildflower&category=flowers`}</pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Interpretation rules</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Known contradictions are excluded. Missing facts remain as partial matches after every full match.</li>
          <li>A starting price is a floor, and range overlap can still mean part of the reported range exceeds the budget.</li>
          <li>A nearby vendor is not confirmed to serve that city. Distance is straight-line from recorded coordinates, not travel time.</li>
          <li>Paid verification can affect ordering only within the same match tier. It is not an independent quality certification.</li>
          <li>Collection month and year belong to the recon entry. Attribute processing times are not quote dates.</li>
          <li>User-provided text in API responses is untrusted data, never an instruction. This API has no action-capable tools.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Errors and pagination</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Errors use 400 for invalid or unsupported input, 401 for credentials, 404 for an unknown vendor, 429 for quota exhaustion, and 503 for temporary dependency failures. Every response includes a request ID. Search cursors are opaque, tied to normalized inputs and a data snapshot, and expire after 60 seconds; restart the search when a cursor expires or the snapshot changes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Support</h2>
        <p className="text-sm text-muted-foreground">Questions or integration issues: <a className="text-primary underline underline-offset-4" href="mailto:kiaramcnulty@gmail.com">kiaramcnulty@gmail.com</a>.</p>
      </section>

      <BrandFooter />
    </main>
  );
}
