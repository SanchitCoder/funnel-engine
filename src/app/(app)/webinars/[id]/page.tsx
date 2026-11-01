"use client";

import { ArrowLeft, CalendarPlus, FileUp, Flag, Phone, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ChartCard, LegendDot } from "@/components/chart-card";
import { FunnelChart, RetentionChart, WatchHistogram } from "@/components/charts";
import { KpiSkeleton } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { FollowupBadge, WebinarStatusBadge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Tip } from "@/components/ui/tooltip";
import { AddRegistrantDialog, ImportAttendanceDialog, LogCallDialog } from "@/components/webinar-actions";
import { usePersonDrawer } from "@/components/person-drawer";
import { useNow } from "@/lib/clock";
import { formatINR, formatINRCompact, formatISTPattern, formatMinutes, formatNumber, formatPct, formatRoas, slotLabel } from "@/lib/format";
import { useCalls, useCloseWebinar, useRetention, useSales, useWebinarDetail } from "@/lib/hooks";
import { SEGMENT_HINT, SEGMENT_LABELS } from "@/lib/mock/config";
import type { SegmentName } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function WebinarDetailPage() {
  const { id } = useParams<{ id: string }>();
  const wid = Number(id);
  const detail = useWebinarDetail(wid);
  const [dialog, setDialog] = useState<null | "import" | "call" | "register" | "close">(null);
  const close = useCloseWebinar();
  const now = useNow(60000);

  if (detail.isPending) return <DetailSkeleton />;
  if (detail.error) {
    return (
      <Card>
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      </Card>
    );
  }
  if (!detail.data) {
    return (
      <Card>
        <EmptyState title="Webinar not found" description="It may have been deleted, or the link is wrong." action={<LinkButton href="/webinars" variant="secondary">Back to webinars</LinkButton>} />
      </Card>
    );
  }

  const { webinar: w, metrics: m, segments } = detail.data;
  const isClosed = w.status === "closed";
  const isScheduled = w.status === "scheduled";
  const closeReason = isClosed ? "This webinar is already closed." : isScheduled ? "You can close a webinar once it has started." : undefined;

  const minutesToPitch = Math.ceil((Date.parse(w.scheduled_at) + w.pitch_start_minute * 60000 - now) / 60000);
  const pitchPending = w.status === "live" && minutesToPitch > 0;
  const pitchNote = `Pitch starts in ${minutesToPitch} min`;

  const stages = [
    { key: "reg", label: "Registered", value: m.registrations, dropLabel: "" },
    { key: "att", label: "Attended", value: m.attendees, dropLabel: w.status === "live" ? "haven't joined yet" : "never joined" },
    { key: "stay", label: "Stayed till pitch", value: m.stayed_till_pitch, dropLabel: "left before the pitch", pending: pitchPending ? pitchNote : undefined },
    { key: "call", label: "Call booked", value: m.calls_booked, dropLabel: "did not book a call" },
    { key: "buy", label: "Purchased", value: m.sales_count, dropLabel: "did not buy" },
  ];

  return (
    <>
      <Link href="/webinars" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3.5" aria-hidden /> All webinars
      </Link>
      <PageHeader
        eyebrow={w.topic}
        title={w.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <WebinarStatusBadge status={w.status} />
            <span>{formatISTPattern(w.scheduled_at, "EEEE d MMM yyyy, h:mm a")} IST</span>
            <span>· {slotLabel(w.time_slot)}</span>
            <span>· pitch at minute {w.pitch_start_minute}</span>
            <span>· {w.duration_minutes} min</span>
          </span>
        }
        actions={
          <>
            <Tip content={closeReason ?? "Reconcile attendance, assign segments and start the follow-up sequences"}>
              <span>
                <Button variant="primary" disabled={!!closeReason} onClick={() => setDialog("close")}>
                  <Flag /> Close &amp; start follow-ups
                </Button>
              </span>
            </Tip>
            <Button variant="secondary" onClick={() => setDialog("import")}>
              <FileUp /> Import attendance CSV
            </Button>
            <Button variant="secondary" onClick={() => setDialog("call")}>
              <Phone /> Log booked call
            </Button>
            <Button variant="secondary" onClick={() => setDialog("register")}>
              <UserPlus /> Add registrant
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Mini label="Registered" value={formatNumber(m.registrations)} />
          <Mini label="Show-up" value={isScheduled ? "—" : formatPct(m.show_up_pct, 1)} sub={isScheduled ? undefined : `${formatNumber(m.attendees)} attended`} />
          <Mini label="Avg watch time" value={isScheduled ? "—" : formatMinutes(m.avg_watch_minutes)} />
          <Mini label="Stayed till pitch" value={isScheduled || pitchPending ? "—" : formatPct(m.stayed_till_pitch_pct, 1)} sub={pitchPending ? pitchNote.toLowerCase() : isScheduled ? undefined : `${formatNumber(m.stayed_till_pitch)} people`} />
          <Mini label="Revenue" value={isScheduled ? "—" : formatINRCompact(m.revenue_inr)} sub={isScheduled ? undefined : `${m.sales_count} sale${m.sales_count === 1 ? "" : "s"}`} />
          <Mini label="ROAS" value={isScheduled || w.status === "live" ? "—" : formatRoas(m.roas)} sub={`${formatINRCompact(m.ad_spend_inr)} ad spend`} />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <ChartCard
            title="Funnel"
            caption={
              isScheduled
                ? "Registrations so far. The rest of the funnel fills in once the webinar starts."
                : pitchPending
                  ? `${formatPct(m.show_up_pct, 0)} of registrants have joined so far. The pitch starts in ${minutesToPitch} minutes.`
                  : `${formatPct(m.show_up_pct, 0)} of registrants showed up and ${formatPct(m.stayed_till_pitch_pct, 0)} of those stayed for the pitch.`
            }
            table={{ columns: ["Stage", "People", "% of registered"], rows: stages.map((s) => [s.label, formatNumber(s.value), formatPct(m.registrations ? (100 * s.value) / m.registrations : 0, 1)]) }}
          >
            <FunnelChart stages={stages} />
          </ChartCard>
          <SegmentSummary segments={segments} closed={isClosed} />
        </div>

        <RetentionSection webinarId={wid} />

        <div className="grid gap-6 lg:grid-cols-2">
          <SalesCard webinarId={wid} />
          <CallsCard webinarId={wid} />
        </div>

        <div className="flex justify-end">
          <LinkButton href={`/people?webinar=${wid}`} variant="secondary">
            <Users /> See everyone who registered
          </LinkButton>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === "close"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Close this webinar and start follow-ups?"
        description={
          <>
            This locks in attendance for {formatNumber(m.registrations)} registrants, sorts them into no-shows, early leavers and people who stayed till the offer, and starts each group&apos;s message sequence. Closing again later is safe.
          </>
        }
        confirmLabel="Close & start follow-ups"
        pending={close.isPending}
        onConfirm={async () => {
          await close.mutateAsync(wid);
          setDialog(null);
        }}
      />
      <ImportAttendanceDialog open={dialog === "import"} onOpenChange={(o) => !o && setDialog(null)} webinarId={wid} webinarStart={w.scheduled_at} />
      <LogCallDialog open={dialog === "call"} onOpenChange={(o) => !o && setDialog(null)} webinarId={wid} />
      <AddRegistrantDialog open={dialog === "register"} onOpenChange={(o) => !o && setDialog(null)} webinarId={wid} />
    </>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy className="space-y-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-12 w-2/3" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="eyebrow mb-2">{label}</div>
      <div className="tnum text-2xl font-semibold leading-none tracking-[-0.02em]">{value}</div>
      {sub ? <div className="mt-1.5 text-xs text-ink-3">{sub}</div> : null}
    </Card>
  );
}

// ------------------------------------------------------------------ segments

function SegmentSummary({ segments, closed }: { segments: Record<SegmentName, { total: number; statuses: Partial<Record<import("@/lib/types").FollowupStatus, number>> }>; closed: boolean }) {
  const names: SegmentName[] = ["no_show", "early_leaver", "stayed_till_offer"];
  const total = names.reduce((s, n) => s + segments[n].total, 0);
  return (
    <Card>
      <CardHeader title="Segments" description={closed ? "Where everyone landed when the webinar closed, and how their follow-ups are going." : "Segments are assigned when you close the webinar."} />
      <CardBody className="space-y-4">
        {total === 0 ? (
          <EmptyState title="Not segmented yet" description="Close the webinar to sort registrants into follow-up groups." className="py-8" />
        ) : (
          names.map((n) => {
            const s = segments[n];
            const entries = Object.entries(s.statuses).filter(([, c]) => (c ?? 0) > 0) as [import("@/lib/types").FollowupStatus, number][];
            return (
              <div key={n}>
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold">{SEGMENT_LABELS[n]}</p>
                    <p className="text-xs text-ink-3">{SEGMENT_HINT[n]}</p>
                  </div>
                  <div className="tnum text-right">
                    <span className="text-xl font-semibold">{s.total}</span>
                    <span className="ml-1 text-xs text-ink-3">{formatPct(total ? (100 * s.total) / total : 0, 0)}</span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entries.map(([st, c]) => (
                    <span key={st} className="inline-flex items-center gap-1.5">
                      <FollowupBadge status={st} />
                      <span className="tnum text-xs text-ink-3">{c}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
        {total > 0 ? (
          <LinkButton href="/segments" variant="secondary" size="sm" className="w-full">
            Open follow-up boards
          </LinkButton>
        ) : null}
      </CardBody>
    </Card>
  );
}

// ------------------------------------------------------------------ retention + histogram

function RetentionSection({ webinarId }: { webinarId: number }) {
  const { data, isPending, error, refetch } = useRetention(webinarId);
  const now = useNow(60000);
  if (isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (error) {
    return (
      <Card>
        <ErrorState error={error} onRetry={() => refetch()} />
      </Card>
    );
  }
  if (!data || data.peak === 0) {
    return (
      <Card>
        <CardHeader title="Audience retention" description="Live viewers, minute by minute." />
        <EmptyState title="No one has joined yet" description="The retention curve draws itself as people join the room." />
      </Card>
    );
  }
  const live = data.status === "live";
  void now;
  const pitchViewers = data.points.find((p) => p.minute === data.pitch_start_minute)?.viewers;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <ChartCard
        title="Audience retention"
        caption={
          data.drops[0]
            ? `Biggest loss around minute ${data.drops.reduce((a, b) => (b.lost > a.lost ? b : a)).minute}${pitchViewers !== undefined ? `, and ${formatNumber(pitchViewers)} were still watching when the pitch began` : ""}.`
            : live
              ? "Updating every 30 seconds while the webinar is live."
              : "How many people were in the room at each minute."
        }
        table={{
          columns: ["Minute", "Viewers"],
          rows: data.points.filter((p) => p.minute % 5 === 0).map((p) => [p.minute, formatNumber(p.viewers)]),
        }}
        legend={
          <>
            <LegendDot color="var(--s1)" label="Viewers in the room" shape="line" />
            <LegendDot color="var(--s2)" label="Biggest drop points" />
            <LegendDot color="var(--ink-3)" label="Pitch starts" shape="dash" />
          </>
        }
      >
        <RetentionChart points={data.points} pitch={data.pitch_start_minute} duration={data.duration_minutes} drops={data.drops} live={live} />
        {data.drops.length > 0 ? (
          <ol className="mt-3 flex flex-wrap gap-2" aria-label="Biggest drop points">
            {data.drops.map((d, i) => (
              <li key={d.minute} className="flex items-center gap-2 rounded-full border border-line bg-surface-2 py-1 pl-1 pr-3 text-xs">
                <span className="flex size-5 items-center justify-center rounded-full bg-s2 text-[11px] font-bold text-white">{i + 1}</span>
                <span className="tnum">
                  Minute {d.minute}: about {d.lost} left ({d.pct}% of peak)
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </ChartCard>
      <ChartCard
        title="Watch time"
        caption="How long each attendee stayed in total. Rejoining counts, so one person is one bar."
        table={{ columns: ["Minutes watched", "Attendees"], rows: data.histogram.map((b) => [b.label, formatNumber(b.count)]) }}
      >
        <WatchHistogram bins={data.histogram} pitch={data.pitch_start_minute} />
      </ChartCard>
    </div>
  );
}

// ------------------------------------------------------------------ sales + calls

function SalesCard({ webinarId }: { webinarId: number }) {
  const { data, isPending, error, refetch } = useSales({ webinar_id: webinarId, page: 1 });
  const { openPerson } = usePersonDrawer();
  return (
    <Card>
      <CardHeader title="Sales" description={data ? `${data.totals.paid_count} paid · ${formatINR(data.totals.revenue_inr)} collected` : "Paid sales for this webinar."} actions={<LinkButton href="/sales" variant="ghost" size="sm">All sales</LinkButton>} />
      <div className="pb-2 pt-3">
        {isPending ? (
          <div className="space-y-2 px-5 pb-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : data.rows.length === 0 ? (
          <EmptyState title="No sales yet" description="Payments from Razorpay or manual entries land here." className="py-8" />
        ) : (
          <ul className="divide-y divide-line">
            {data.rows.slice(0, 6).map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => s.registrant_id && openPerson(s.registrant_id)} className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium">{s.name}</span>
                    <span className="block text-xs text-ink-3">
                      {formatISTPattern(s.paid_at, "d MMM, h:mm a")} · {s.provider} · {s.tier}
                    </span>
                  </span>
                  <span className={cn("tnum shrink-0 text-[14px] font-semibold", s.status !== "paid" && "text-ink-3 line-through")}>{formatINR(s.amount_inr)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function CallsCard({ webinarId }: { webinarId: number }) {
  const { data, isPending, error, refetch } = useCalls({ webinar_id: webinarId, page: 1 });
  const { openPerson } = usePersonDrawer();
  return (
    <Card>
      <CardHeader
        title="Calls"
        description={data ? `${data.counts.booked} upcoming · ${data.counts.completed} done · ${data.counts.canceled} canceled` : "Calls booked after this webinar."}
        actions={<LinkButton href="/sales" variant="ghost" size="sm"><CalendarPlus /> All calls</LinkButton>}
      />
      <div className="pb-2 pt-3">
        {isPending ? (
          <div className="space-y-2 px-5 pb-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : data.rows.length === 0 ? (
          <EmptyState title="No calls booked" description="Cal.com or Calendly bookings, and calls you log by hand, show up here." className="py-8" />
        ) : (
          <ul className="divide-y divide-line">
            {data.rows.slice(0, 6).map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => openPerson(c.registrant_id)} className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium">{c.name}</span>
                    <span className="block text-xs text-ink-3">{c.scheduled_for ? `${formatISTPattern(c.scheduled_for, "EEE d MMM, h:mm a")} IST` : "No time set"} · {c.source.replace("_", ".")}</span>
                  </span>
                  <span className={cn("shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium", c.status === "booked" && "border-accent/25 bg-accent-soft text-accent", c.status === "completed" && "border-good/30 bg-good/10 text-good-text", c.status === "canceled" && "border-line bg-surface-2 text-ink-3")}>
                    {c.status === "booked" ? "Upcoming" : c.status === "completed" ? "Done" : "Canceled"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
