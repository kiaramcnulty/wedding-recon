"use client";

import * as React from "react";
import { Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  startCheckout,
  openBillingPortal,
  type BillingResult,
} from "@/app/(portal)/portal/billing/actions";

/**
 * Billing control for one claimed vendor. If the vendor already has a
 * subscription on file, it opens the Stripe Customer Portal (manage / cancel /
 * update card); otherwise it starts Checkout for the $120 / 6-month plan. Both
 * server actions return a Stripe URL we redirect to.
 */
export function BillingControl({
  vendorId,
  hasSubscription,
}: {
  vendorId: string;
  hasSubscription: boolean;
}) {
  const [pending, startTransition] = React.useTransition();

  const go = (action: (id: string) => Promise<BillingResult>) => {
    startTransition(async () => {
      const res = await action(vendorId);
      if ("url" in res) {
        window.location.assign(res.url);
      } else {
        toast.error(res.error);
      }
    });
  };

  if (hasSubscription) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => go(openBillingPortal)}
        className="gap-1.5"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
        Manage billing
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={() => go(startCheckout)}
      className="gap-1.5"
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      Activate verification · $120 / 6 mo
    </Button>
  );
}
