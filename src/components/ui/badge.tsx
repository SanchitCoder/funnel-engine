import { cva, type VariantProps } from "class-variance-authority";
import { CheckCircle2, Clock, Pause, Radio, Eye, TrendingUp, XCircle, type LucideIcon } from "lucide-react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { AdAction, FollowupStatus, WebinarStatus } from "@/lib/types";

const badge = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5 [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface-2 text-ink-2",
        outline: "border-line bg-transparent text-ink-2",
        good: "border-good/30 bg-good/10 text-good-text",
        warn: "border-warning/50 bg-warning/15 text-ink",
        bad: "border-critical/30 bg-critical/10 text-critical-text",
        info: "border-accent/25 bg-accent-soft text-accent",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({ className, tone, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}

const webinarStatus: Record<WebinarStatus, { label: string; tone: VariantProps<typeof badge>["tone"]; icon: LucideIcon }> = {
  scheduled: { label: "Scheduled", tone: "info", icon: Clock },
  live: { label: "Live now", tone: "bad", icon: Radio },
  closed: { label: "Closed", tone: "neutral", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", tone: "outline", icon: XCircle },
};

export function WebinarStatusBadge({ status }: { status: WebinarStatus }) {
  const s = webinarStatus[status];
  const Icon = s.icon;
  return (
    <Badge tone={s.tone}>
      {status === "live" ? <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-critical opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-critical" /></span> : <Icon aria-hidden />}
      {s.label}
    </Badge>
  );
}

const followupTone: Record<FollowupStatus, { label: string; tone: VariantProps<typeof badge>["tone"] }> = {
  pending: { label: "Pending", tone: "outline" },
  sequence_running: { label: "In sequence", tone: "info" },
  replied: { label: "Replied", tone: "warn" },
  booked: { label: "Call booked", tone: "good" },
  purchased: { label: "Purchased", tone: "good" },
  completed: { label: "Sequence done", tone: "neutral" },
  opted_out: { label: "Opted out", tone: "bad" },
};

export function FollowupBadge({ status }: { status: FollowupStatus | null }) {
  if (!status) return <span className="text-xs text-ink-3">—</span>;
  const s = followupTone[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const followupLabel = (s: FollowupStatus) => followupTone[s].label;

const actionStyle: Record<AdAction, { tone: VariantProps<typeof badge>["tone"]; icon: LucideIcon }> = {
  Scale: { tone: "good", icon: TrendingUp },
  Keep: { tone: "info", icon: CheckCircle2 },
  Watch: { tone: "warn", icon: Eye },
  Pause: { tone: "bad", icon: Pause },
};

export function ActionBadge({ action }: { action: AdAction }) {
  const s = actionStyle[action];
  const Icon = s.icon;
  return (
    <Badge tone={s.tone}>
      <Icon aria-hidden />
      {action}
    </Badge>
  );
}

export function RepeatBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Badge tone="info" title={`Attended ${count} earlier webinar${count > 1 ? "s" : ""}`}>
      Repeat · {count + 1}×
    </Badge>
  );
}
