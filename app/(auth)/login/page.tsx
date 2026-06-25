"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, Loader2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { BrandLockup } from "@/components/brand-lockup";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function LoginContent() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // Where the back button returns to: the page that sent the guest here passes
  // a validated internal `from` path (e.g. a vendor page from the favorite
  // button). Falls back to Explore when there's no origin.
  const searchParams = useSearchParams();
  const rawFrom = searchParams.get("from");
  const backHref =
    rawFrom && rawFrom.startsWith("/") && !rawFrom.startsWith("//")
      ? rawFrom
      : "/explore";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        },
      });

      if (error) {
        toast.error(error.message ?? "Something went wrong. Please try again.");
        return;
      }

      setSent(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Mail className="size-5 text-primary" />
          </div>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a magic link to <strong>{email}</strong>. Click the link in
            your email to sign in — it expires in 1 hour.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setSent(false);
              setEmail("");
            }}
          >
            Use a different email
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {/* Back to wherever the guest came from (Explore by default) */}
      <div className="w-full">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {backHref === "/explore" ? "Back to explore" : "Back"}
        </Link>
      </div>

      {/* Brand */}
      <BrandLockup orientation="vertical" size="lg" showDomain showTagline />

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">Log in or create an account</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a magic link — no password
            needed. New here? The same link creates your account.
          </CardDescription>
        </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending…
              </>
            ) : (
              "Send magic link"
            )}
          </Button>
        </form>
      </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
