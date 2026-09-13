"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { revokeClaim } from "@/app/(portal)/portal/admin/actions";

/** Admin control: revoke a vendor claim, with a confirm step. */
export function RevokeClaimButton({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  if (!confirming) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => setConfirming(true)}
      >
        Revoke
      </Button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await revokeClaim(claimId);
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            toast.success("Claim revoked.");
            router.refresh();
          })
        }
      >
        {pending && <Loader2 className="mr-1 size-3 animate-spin" />}
        Confirm
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => setConfirming(false)}
      >
        Cancel
      </Button>
    </div>
  );
}
