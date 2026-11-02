import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

/**
 * One answer to a journey question: a soft card with an icon, rather than a
 * slab button. A link with `href`, a button otherwise. Used by the welcome
 * popups and the welcome step on /start, which ask the same question.
 */
export function ChoiceCard({
  href,
  icon: Icon,
  iconStyle,
  title,
  hint,
  onClick,
}: {
  href?: string;
  icon: LucideIcon;
  iconStyle?: React.CSSProperties;
  title: string;
  hint?: string;
  onClick: () => void;
}) {
  const className =
    "group flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors hover:border-brand/50 hover:bg-brand-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50";
  const body = (
    <>
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink"
        style={iconStyle}
      >
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{title}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </>
  );
  return href ? (
    <Link href={href} onClick={onClick} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}
