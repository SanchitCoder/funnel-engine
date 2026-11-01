"use client";

import { Check, Clock, MessageSquareReply } from "lucide-react";
import { useMemo, useState } from "react";
import { PersonActions } from "@/components/person-bits";
import { usePersonDrawer } from "@/components/person-drawer";
import { PageHeader } from "@/components/page-header";
import { PeopleTable } from "@/components/people-table";
import { Badge, FollowupBadge, followupLabel, RepeatBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useNow } from "@/lib/clock";
import { formatISTPattern, formatISTShort, formatNumber, formatPct, relativeFrom } from "@/lib/format";
import { useRegistrants, useSegments, useWebinars } from "@/lib/hooks";
import { SEGMENT_HINT, SEGMENT_LABELS } from "@/lib/mock/config";
import type { FollowupStatus, SegmentName } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEGMENTS: SegmentName[] = ["no_show", "early_leaver", "stayed_till_offer"];
const STATUS_ORDER: FollowupStatus[] = ["pending", "sequence_running", "replied", "booked", "purchased", "completed", "opted_out"];

export default function SegmentsPage() {
  const webinars = useWebinars();
  const [picked, setPicked] = useState<number | null>(null);
  const closed = useMemo(() => (webinars.data ?? []).filter((w) => w.status === "closed").sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at)), [webinars.data]);
  const wid = picked ?? closed[0]?.id;
  const segs = useSegments(wid);
  const sd = segs.data;

  return (
    <>
      <PageHeader
        eyebrow="Segments & follow-ups"
        title="Who needs what, right now"
        description="When a webinar closes, everyone lands in one of three groups and a message sequence starts. Replies pause the sequence so you can step in."
        actions={
          closed.length ? (
            <label className="flex items-center gap-2 text-[13px] text-ink-3">
              <span>Webinar</span>
              <Select value={wid ?? ""} onChange={(e) => setPicked(Number(e.target.value))} className="w-72 max-w-[70vw]" aria-label="Choose a closed webinar">
                {closed.map((w) => (
                  <option key={w.id} value={w.id}>
                    {formatISTShort(w.scheduled_at)} · {w.title}
                  </option>
                ))}
              </Select>
            </label>
          ) : null
        }
      />

      {webinars.isPending ? (
        <div className="space-y-6" aria-busy>
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        </div>
      ) : webinars.error ? (
        <Card>
          <ErrorState error={webinars.error} onRetry={() => webinars.refetch()} />
        </Card>
      ) : !wid ? (
        <Card>
          <EmptyState title="No closed webinars yet" description="Segments appear after you close a webinar from its detail page." />
        </Card>
      ) : segs.isPending ? (
        <div className="grid gap-4 md:grid-cols-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : segs.error ? (
        <Card>
          <ErrorState error={segs.error} onRetry={() => segs.refetch()} />
        </Card>
      ) : !sd ? (
        <Card>
          <EmptyState title="Webinar not found" />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {SEGMENTS.map((s) => (
              <Board key={s} webinarId={wid} segment={s} data={sd.matrix.find((m) => m.segment === s)} total={sd.matrix.reduce((t, m) => t + m.total, 0)} />
            ))}
          </div>

          <div className="grid gap-6 2xl:grid-cols-2">
            <Breakdown matrix={sd.matrix} />
            <SequenceTimeline plan={sd.plan} />
          </div>

          <NeedsHuman rows={sd.needs_human} />

          <Card>
            <CardHeader title="Everyone in this webinar" description="Filter, contact or export the people behind the numbers above." />
            <div className="pt-3">
              <PeopleTable fixedWebinarId={wid} exportName={`webinar-${wid}-people`} />
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ boards

type Matrix = NonNullable<ReturnType<typeof useSegments>["data"]>["matrix"];

function Board({ webinarId, segment, data, total }: { webinarId: number; segment: SegmentName; data: Matrix[number] | undefined; total: number }) {
  const { data: people, isPending } = useRegistrants({ webinar_id: webinarId, segment, page_size: 5 });
  const { openPerson } = usePersonDrawer();
  const count = data?.total ?? 0;
  const top = data ? (Object.entries(data.statuses) as [FollowupStatus, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={SEGMENT_LABELS[segment]}
        description={SEGMENT_HINT[segment]}
        actions={
          <div className="text-right">
            <div className="tnum text-2xl font-semibold leading-none tracking-tight">{formatNumber(count)}</div>
            <div className="mt-1 text-xs text-ink-3">{formatPct(total ? (100 * count) / total : 0, 0)} of registrants</div>
          </div>
        }
      />
      <CardBody className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {top.map(([st, n]) => (
            <span key={st} className="inline-flex items-center gap-1.5">
              <FollowupBadge status={st} />
              <span className="tnum text-xs text-ink-3">{n}</span>
            </span>
          ))}
        </div>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {isPending
            ? Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="p-3">
                  <Skeleton className="h-9" />
                </li>
              ))
            : people?.rows.map((p) => (
                <li key={p.registrant_id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <button type="button" onClick={() => openPerson(p.registrant_id)} className="min-w-0 text-left">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13.5px] font-medium hover:text-accent">{p.name}</span>
                      <RepeatBadge count={p.prior_webinars_attended} />
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
                      <span>{p.source_label}</span>
                      <FollowupBadge status={p.followup_status} />
                    </span>
                  </button>
                  <PersonActions name={p.name} phone={p.phone} email={p.email} />
                </li>
              ))}
          {!isPending && (people?.rows.length ?? 0) === 0 ? <li className="p-4 text-center text-[13px] text-ink-3">No one in this group.</li> : null}
        </ul>
        {count > 5 ? <p className="mt-auto text-center text-xs text-ink-3">Showing 5 of {formatNumber(count)}. The full list is in the table below.</p> : null}
      </CardBody>
    </Card>
  );
}

// ------------------------------------------------------------------ status matrix

function Breakdown({ matrix }: { matrix: Matrix }) {
  const max = Math.max(...matrix.flatMap((m) => Object.values(m.statuses)), 1);
  const step = (n: number) => (n === 0 ? 0 : Math.max(1, Math.min(7, Math.ceil((n / max) * 7))));
  return (
    <Card>
      <CardHeader title="Follow-up status" description="Where each group is in its sequence. Darker means more people." />
      <CardBody>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-1 text-[13px]">
            <caption className="sr-only">People per segment and follow-up status</caption>
            <thead>
              <tr>
                <th scope="col" className="w-32 text-left text-xs font-semibold text-ink-3">
                  Segment
                </th>
                {STATUS_ORDER.map((s) => (
                  <th key={s} scope="col" className="px-1 pb-1 text-center align-bottom text-[11px] font-semibold leading-tight text-ink-3">
                    {followupLabel(s)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((m) => (
                <tr key={m.segment}>
                  <th scope="row" className="pr-2 text-left text-[13px] font-medium">
                    {SEGMENT_LABELS[m.segment]}
                  </th>
                  {STATUS_ORDER.map((s) => {
                    const n = m.statuses[s] ?? 0;
                    const st = step(n);
                    return (
                      <td
                        key={s}
                        className="h-11 rounded-lg text-center align-middle tnum font-semibold"
                        style={st ? { background: `var(--seq-${st})`, color: `var(--on-${st})` } : { background: "var(--surface-2)", color: "var(--ink-3)" }}
                        aria-label={`${SEGMENT_LABELS[m.segment]}, ${followupLabel(s)}: ${n}`}
                      >
                        {n || "·"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

// ------------------------------------------------------------------ sequence timeline

type Plan = NonNullable<ReturnType<typeof useSegments>["data"]>["plan"];

function SequenceTimeline({ plan }: { plan: Plan }) {
  const now = useNow(60000);
  return (
    <Card>
      <CardHeader title="Message sequences" description="What each group receives and when. People who reply, book or buy leave the sequence." />
      <CardBody className="space-y-6">
        {plan.map((p) => (
          <div key={p.segment}>
            <p className="mb-3 text-[13px] font-semibold">{SEGMENT_LABELS[p.segment]}</p>
            <ol className="grid gap-3" style={{ gridTemplateColumns: `repeat(${p.steps.length}, minmax(0, 1fr))` }}>
              {p.steps.map((s, i) => {
                const due = s.due_at ? Date.parse(s.due_at) : null;
                const sent = due !== null && due <= now;
                return (
                  <li key={s.step} className="relative">
                    <div className="flex items-center">
                      <span className={cn("relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2", sent ? "border-s1 bg-s1 text-white" : "border-axis bg-surface text-ink-3")}>
                        {sent ? <Check className="size-3.5" aria-hidden /> : <Clock className="size-3" aria-hidden />}
                      </span>
                      {i < p.steps.length - 1 ? <span className={cn("h-0.5 flex-1", sent ? "bg-s1" : "bg-line")} aria-hidden /> : null}
                    </div>
                    <p className="mt-2 text-[13px] font-medium leading-tight">{s.label}</p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {s.delay_min === 0 ? "At close" : `+${s.delay_min / 60}h`}
                      {due !== null ? <> · {sent ? "sent" : `due ${relativeFrom(s.due_at as string, now)}`}</> : null}
                    </p>
                    <p className="tnum mt-0.5 text-xs text-ink-2">{formatNumber(s.reached)} reached</p>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

// ------------------------------------------------------------------ needs a human

type NeedsHumanRows = NonNullable<ReturnType<typeof useSegments>["data"]>["needs_human"];

function NeedsHuman({ rows }: { rows: NeedsHumanRows }) {
  const now = useNow(60000);
  const { openPerson } = usePersonDrawer();
  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            Needs a human now
            {rows.length > 0 ? <Badge tone="warn">{rows.length}</Badge> : null}
          </span>
        }
        description="They replied to a message but have not booked a call or paid. The sequence is paused, so they will not hear from you unless you reach out."
      />
      <div className="px-2 pb-2 pt-3">
        {rows.length === 0 ? (
          <EmptyState icon={MessageSquareReply} title="Nobody is waiting on you" description="When someone replies and has not booked or paid, they show up here." className="py-8" />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.registrant_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-3">
                <button type="button" onClick={() => openPerson(r.registrant_id)} className="min-w-0 flex-1 text-left">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium hover:text-accent">{r.name}</span>
                    {r.reply_intent ? <Badge tone={r.reply_intent === "interested" ? "good" : "neutral"}>{r.reply_intent}</Badge> : null}
                    <span className="text-xs text-ink-3">{r.reply_at ? `${relativeFrom(r.reply_at, now)} · ${formatISTPattern(r.reply_at, "d MMM, h:mm a")}` : ""}</span>
                  </span>
                  <span className="mt-1 block text-[13px] italic text-ink-2">“{r.last_reply}”</span>
                </button>
                <PersonActions name={r.name} phone={r.phone} email={r.email} message={`Hi ${r.name.split(" ")[0]}, thanks for your reply. `} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
