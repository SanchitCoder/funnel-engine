"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import {
  BellRing,
  CalendarCheck,
  CircleDot,
  CreditCard,
  DoorClosed,
  DoorOpen,
  MailX,
  MessageSquareReply,
  Send,
  Split,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { FollowupBadge, RepeatBadge } from "@/components/ui/badge";
import { MaskedPhone, PersonActions, copyText } from "@/components/person-bits";
import { SheetContent } from "@/components/ui/dialog";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { usePerson } from "@/lib/hooks";
import { formatINR, formatISTPattern, formatMinutes } from "@/lib/format";
import type { TimelineItem } from "@/lib/mock/queries";
import { SEGMENT_LABELS } from "@/lib/mock/config";
import { cn } from "@/lib/utils";

interface Ctx {
  openPerson: (registrantId: number) => void;
}
const PersonCtx = createContext<Ctx>({ openPerson: () => undefined });
export const usePersonDrawer = () => useContext(PersonCtx);

export function PersonDrawerProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<number | null>(null);
  const openPerson = useCallback((rid: number) => setId(rid), []);
  const value = useMemo(() => ({ openPerson }), [openPerson]);
  return (
    <PersonCtx.Provider value={value}>
      {children}
      <RadixDialog.Root open={id !== null} onOpenChange={(o) => !o && setId(null)}>
        <SheetContent title="Person journey" description="Everything that happened to this registrant, in order.">
          {id !== null ? <Journey registrantId={id} /> : null}
        </SheetContent>
      </RadixDialog.Root>
    </PersonCtx.Provider>
  );
}

const ICONS: Record<TimelineItem["kind"], LucideIcon> = {
  registered: UserPlus,
  reminder: BellRing,
  join: DoorOpen,
  leave: DoorClosed,
  segment: Split,
  followup: Send,
  reply: MessageSquareReply,
  call: CalendarCheck,
  payment: CreditCard,
  optout: MailX,
};

function Journey({ registrantId }: { registrantId: number }) {
  const { data, isPending, error, refetch } = usePerson(registrantId);

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return <ErrorState title="Registrant not found" error="This registrant no longer exists." />;

  const r = data.registrant;
  const row = data.row;
  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold tracking-tight">{r.name}</h3>
          <RepeatBadge count={row.prior_webinars_attended} />
        </div>
        <button type="button" onClick={() => copyText(r.email, "Email copied")} className="mt-1 text-[13px] text-ink-2 hover:text-ink hover:underline">
          {r.email}
        </button>
        <div className="mt-1">
          <MaskedPhone phone={r.phone} className="text-[13px]" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {data.segment ? <span className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-2">{SEGMENT_LABELS[data.segment.segment]}</span> : null}
          <FollowupBadge status={data.segment?.followup_status ?? null} />
        </div>
        <div className="mt-3 -ml-1.5">
          <PersonActions name={r.name} phone={r.phone} email={r.email} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Mini label="Watched" value={data.attendance?.attended ? formatMinutes(data.attendance.watch_minutes) : "Didn't join"} />
        <Mini label="Sessions" value={String(data.attendance?.sessions_count ?? 0)} />
        <Mini label="Paid" value={data.total_paid ? formatINR(data.total_paid) : "—"} />
      </div>

      <div className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-[13px]">
        <div className="eyebrow mb-1.5">Webinar</div>
        <div className="font-medium">{data.webinar.title}</div>
        <div className="text-ink-3">{formatISTPattern(data.webinar.scheduled_at, "EEE d MMM yyyy, h:mm a")} IST</div>
      </div>

      {data.other_registrations.length > 0 ? (
        <div>
          <div className="eyebrow mb-2">Other webinars</div>
          <ul className="space-y-1.5 text-[13px]">
            {data.other_registrations.map((o) => (
              <li key={o.registrant_id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-ink-2">{o.webinar_title}</span>
                <span className={cn("shrink-0 text-xs", o.attended ? "text-good-text" : "text-ink-3")}>{o.attended ? "Attended" : "Registered only"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <div className="eyebrow mb-3">Journey</div>
        <ol className="relative space-y-0">
          {data.timeline.map((item, i) => {
            const Icon = ICONS[item.kind] ?? CircleDot;
            const last = i === data.timeline.length - 1;
            return (
              <li key={`${item.at}-${i}`} className="relative flex gap-3 pb-5">
                {!last ? <span className="absolute left-[13px] top-7 h-[calc(100%-1.5rem)] w-px bg-line" aria-hidden /> : null}
                <span
                  className={cn(
                    "relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border",
                    item.tone === "good" && "border-good/40 bg-good/10 text-good-text",
                    item.tone === "warn" && "border-warning/60 bg-warning/20 text-ink",
                    (!item.tone || item.tone === "neutral") && "border-line bg-surface-2 text-ink-2",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-[13.5px] font-medium">{item.title}</p>
                    <time className="tnum text-xs text-ink-3" dateTime={item.at}>
                      {formatISTPattern(item.at, "d MMM, h:mm a")}
                    </time>
                  </div>
                  {item.detail ? <p className="mt-0.5 text-[13px] text-ink-3">{item.detail}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line px-3 py-2.5">
      <div className="eyebrow mb-1.5">{label}</div>
      <div className="tnum text-[15px] font-semibold tracking-tight">{value}</div>
    </div>
  );
}
