"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { setUsername } from "@/app/(auth)/actions";
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

export default function OnboardingPage() {
  const [username, setUsernameValue] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);

    if (!agreed) {
      toast.error("Please agree to the Terms before continuing.");
      return;
    }

    startTransition(async () => {
      const error = await setUsername(username, agreed);
      if (error) {
        setFieldError(error);
      }
      // On success the server action redirects to /explore — nothing to do here.
    });
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Pick your username</CardTitle>
        <CardDescription>
          Choose an anonymous username that other users will see on your recon
          entries.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="e.g. denverlove2025"
              value={username}
              onChange={(e) => {
                setUsernameValue(e.target.value);
                if (fieldError) setFieldError(null);
              }}
              minLength={2}
              maxLength={30}
              required
              autoComplete="off"
              autoFocus
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? "username-error" : undefined}
            />
            {fieldError && (
              <p
                id="username-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {fieldError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              2–30 characters. This is your public identity — keep it anonymous
              if you&apos;d like.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              required
            />
            <span className="text-sm text-muted-foreground leading-snug">
              I agree to the{" "}
              <Link
                href="/terms"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Terms
              </Link>
            </span>
          </label>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
