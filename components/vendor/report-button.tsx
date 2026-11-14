"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { reportReconEntry } from "@/app/(app)/vendor/[id]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ReportButtonProps {
  reconEntryId: string;
}

export function ReportButton({ reconEntryId }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);

    try {
      // A Server Action: a report can hide the entry, and only the server can
      // expire the cached vendor page to show that (see the action).
      const result = await reportReconEntry(reconEntryId, reason);

      if (!result.ok && result.reason === "signin") {
        setOpen(false);
        router.push("/login");
        return;
      }

      if (!result.ok) {
        toast.error("Could not submit report. Please try again.");
      } else {
        toast("Reported — thank you for helping keep the community accurate.");
        setOpen(false);
        setReason("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Report this entry"
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Flag className="size-3" />
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this entry</DialogTitle>
          <DialogDescription>
            Let us know if this recon entry contains inaccurate, inappropriate,
            or outdated information. Your report is anonymous.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="report-reason">Reason (optional)</Label>
          <Textarea
            id="report-reason"
            placeholder="Describe the issue..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="resize-none"
          />
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
