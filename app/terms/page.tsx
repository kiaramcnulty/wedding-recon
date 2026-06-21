export default function TermsPage() {
  return (
    <div className="mx-auto max-w-[480px] px-5 py-10 space-y-6">
      <h1 className="text-2xl font-medium">Terms & disclaimer</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">What is Wedding Recon?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Wedding Recon is a community tool where engaged couples share informal “recon” about local wedding vendors. You can browse and contribute notes, price quotes, photos, and experiences to help other couples plan their weddings.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">User-submitted content</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          All recon entries are personal opinions and experiences shared by community members, not verified facts. Prices are approximate, may be out of date, and vary depending on date, package, season, and other factors. Always confirm details directly with the vendor before making any decisions or commitments.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Be respectful and truthful</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Do not post false, misleading, or defamatory statements about vendors or individuals. Do not spam, post promotional content, or share content you don’t have the rights to. Do not post others’ private information without their consent. By posting, you take responsibility for what you share.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Reporting & moderation</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Anyone can report an entry that violates these terms or community guidelines. Reported content may be hidden pending review. We may remove, hide, or restrict content that we determine violates these terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">No guarantees</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Wedding Recon is provided “as is” without warranties of any kind. We are not liable for any decisions you make based on community content, vendor performance, pricing accuracy, or any other matter. Use the information at your own discretion and verify everything directly with vendors.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Accounts</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Keep your login credentials secure. You are responsible for all activity that occurs under your account. If you believe your account has been compromised, notify us immediately.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Contact</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Questions about these terms or the service? Please get in touch at hello@weddingrecon.example.
        </p>
      </section>

      <p className="text-xs text-muted-foreground leading-relaxed pt-4 border-t">
        By creating an account, you agree to these terms.
      </p>
    </div>
  );
}
