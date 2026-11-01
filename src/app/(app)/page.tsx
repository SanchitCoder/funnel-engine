"use client";

import { AlertTriangle, ArrowRight, CalendarClock, Copy, Info, Radio, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Countdown } from "@/components/countdown";
import { KpiCard, KpiSkeleton } from "@/components/kpi-card";
import { copyText } from "@/components/person-bits";
import { PageHeader } from "@/components/page-header";
import { Button, LinkButton } from "@/components/ui/button";
import { WebinarStatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useNow } from "@/lib/clock";
import { useAttribution, useRegistrationPace, useRetention, useTrends, useWebinars } from "@/lib/hooks";
import { buildInsights, type Insight } from "@/lib/insights";
import {
  formatINR,
  formatINRCompact,
  formatISTPattern,
  formatISTShort,
  formatMinutes,
  formatNumber,
  formatPct,
  formatRoas,
  slotLabel,
} from "@/lib/format";
import type { WebinarWithMetrics } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function OverviewPage() {
  const webinars = useWebinars();
  const now = useNow(60000);
  const hour = Number(formatISTPattern(new Date(now).toISOString(), "H"));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={`${greeting}, Ankit.`}
        description="Here is how your webinar funnel is performing, from registration to revenue."
        actions={
          <LinkButton href="/webinars?new=1" variant="primary">
            New webinar
          </LinkButton>
        }
      />
      {webinars.isPending ? (
        <OverviewSkeleton />
      ) : webinars.error ? (
        <Card>
          <ErrorState error={webinars.error} onRetry={() => webinars.refetch()} />
        </Card>
      ) : webinars.data.length === 0 ? (
        <Card>
          <EmptyState title="No webinars yet" description="Create your first webinar to start tracking the funnel." />
        </Card>
      ) : (
        <div className="space-y-6">
          <LiveBanner webinars={webinars.data} />
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <InsightStrip />
            <NextWebinar webinars={webinars.data} />
          </div>
          <KpiSection webinars={webinars.data} />
          <RecentWebinars webinars={webinars.data} />
        </div>
      )}
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ live

function LiveBanner({ webinars }: { webinars: WebinarWithMetrics[] }) {
  const live = webinars.find((w) => w.status === "live");
  const retention = useRetention(live?.id);
  const now = useNow(30000);
  if (!live) return null;
  const startMs = Date.parse(live.scheduled_at);
  const minutesIn = Math.max(0, Math.floor((now - startMs) / 60000));
  const toPitch = live.pitch_start_minute - minutesIn;
  const viewers = retention.data?.points.at(-1)?.viewers;
  return (
    <Link
      href={`/webinars/${live.id}`}
      className="group flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-critical/30 bg-critical/[0.06] px-5 py-4 transition-colors hover:bg-critical/10"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-critical text-white">
          <Radio className="size-4" aria-hidden />
        </span>
        <div>
          <div className="text-[13px] font-semibold text-critical-text">Live now · minute {minutesIn}</div>
          <div className="text-[15px] font-semibold tracking-tight">{live.title}</div>
        </div>
      </div>
      <dl className="ml-auto flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="eyebrow mb-1">In the room</dt>
          <dd className="tnum text-lg font-semibold">{viewers === undefined ? "…" : formatNumber(viewers)}</dd>
        </div>
        <div>
          <dt className="eyebrow mb-1">Joined so far</dt>
          <dd className="tnum text-lg font-semibold">
            {formatNumber(live.metrics.attendees)} <span className="text-sm font-normal text-ink-3">of {formatNumber(live.metrics.registrations)}</span>
          </dd>
        </div>
        <div>
          <dt className="eyebrow mb-1">Pitch</dt>
          <dd className="tnum text-lg font-semibold">{toPitch > 0 ? `in ${toPitch} min` : "underway"}</dd>
        </div>
        <ArrowRight className="size-5 text-ink-3 transition-transform group-hover:translate-x-1" aria-hidden />
      </dl>
    </Link>
  );
}

// ------------------------------------------------------------------ insights

const INSIGHT_ICON = { good: Sparkles, warn: AlertTriangle, info: Info } as const;

function InsightStrip() {
  const trends = useTrends();
  const attribution = useAttribution("ad");
  const insights: Insight[] = useMemo(() => {
    if (!trends.data || !attribution.data) return [];
    const a = attribution.data;
    return buildInsights({
      slots: trends.data.dims.time_slot,
      topics: trends.data.dims.topic,
      ads: a.rows,
      organic: a.organic,
      paidRevenuePerRegistrant: a.split.paid.registrations ? a.split.paid.revenue_inr / a.split.paid.registrations : null,
    });
  }, [trends.data, attribution.data]);

  return (
    <Card>
      <CardHeader eyebrow="What the data says" title="Four things worth knowing" description="Written from your closed webinars, not templates." />
      <CardBody className="grid gap-3 sm:grid-cols-2">
        {trends.isPending || attribution.isPending ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)
        ) : trends.error || attribution.error ? (
          <div className="sm:col-span-2">
            <ErrorState error={trends.error ?? attribution.error} onRetry={() => { void trends.refetch(); void attribution.refetch(); }} />
          </div>
        ) : insights.length === 0 ? (
          <div className="sm:col-span-2">
            <EmptyState title="Not enough data yet" description="Insights appear once you have a few closed webinars." />
          </div>
        ) : (
          insights.map((i) => {
            const Icon = INSIGHT_ICON[i.tone];
            return (
              <Link key={i.id} href={i.href} className="group flex flex-col gap-2 rounded-xl border border-line bg-surface-2/60 p-4 transition-colors hover:bg-surface-2">
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg",
                    i.tone === "good" && "bg-good/12 text-good-text",
                    i.tone === "warn" && "bg-warning/25 text-ink",
                    i.tone === "info" && "bg-accent-soft text-accent",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <p className="text-[14px] font-semibold leading-snug tracking-tight">{i.title}</p>
                <p className="text-[13px] leading-snug text-ink-3">{i.body}</p>
                <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-accent">
                  {i.cta} <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            );
          })
        )}
      </CardBody>
    </Card>
  );
}

// ------------------------------------------------------------------ next webinar

function NextWebinar({ webinars }: { webinars: WebinarWithMetrics[] }) {
  const next = webinars.filter((w) => w.status === "scheduled").sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  const closed = webinars.filter((w) => w.status === "closed");
  const avgRegs = closed.length ? closed.reduce((s, w) => s + w.metrics.registrations, 0) / closed.length : 0;
  if (!next) {
    return (
      <Card>
        <CardHeader eyebrow="Next webinar" title="Nothing scheduled" />
        <EmptyState icon={CalendarClock} title="Your calendar is clear" description="Schedule the next webinar to start collecting registrations." action={<LinkButton href="/webinars?new=1" variant="primary">Schedule one</LinkButton>} />
      </Card>
    );
  }
  const link = `/r/${next.id}`;
  return (
    <Card className="flex flex-col">
      <CardHeader eyebrow="Next webinar" title={next.title} description={`${formatISTPattern(next.scheduled_at, "EEEE d MMM, h:mm a")} IST · ${slotLabel(next.time_slot)}`} />
      <CardBody className="flex flex-1 flex-col gap-4">
        <Countdown target={next.scheduled_at} />
        <div className="rounded-xl border border-line px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="tnum text-2xl font-semibold tracking-tight">{formatNumber(next.metrics.registrations)}</span>
            <span className="text-xs text-ink-3">registered so far</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${Math.round((next.metrics.registrations / Math.max(avgRegs, 1)) * 100)}% of your usual registrations`}>
            <div className="h-full rounded-full bg-s1" style={{ width: `${Math.min(100, (next.metrics.registrations / Math.max(avgRegs, 1)) * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-ink-3">Your usual webinar gets about {formatNumber(avgRegs)}.</p>
        </div>
        <RegistrationPace webinarId={next.id} />
        <div className="mt-auto flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => copyText(`${window.location.origin}${link}?utm_source=instagram_bio&utm_medium=bio`, "Registration link copied")}>
            <Copy /> Copy registration link
          </Button>
          <LinkButton href={`/webinars/${next.id}`} variant="ghost" size="sm">
            Open <ArrowRight />
          </LinkButton>
        </div>
      </CardBody>
    </Card>
  );
}

function RegistrationPace({ webinarId }: { webinarId: number }) {
  const { data } = useRegistrationPace(webinarId);
  if (!data) return <Skeleton className="h-20" />;
  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-xs text-ink-3">
        <span className="eyebrow">Sign-ups, last 10 days</span>
        <span className="tnum">{total} total</span>
      </div>
      <div className="flex h-14 items-end gap-1.5" role="img" aria-label={`Registrations per day over the last 10 days: ${data.map((d) => d.count).join(", ")}`}>
        {data.map((d) => (
          <div key={d.date} className="flex-1 rounded-t-[3px] bg-s1" style={{ height: `${Math.max(d.count ? 8 : 2, (d.count / max) * 100)}%`, opacity: d.count ? 1 : 0.25 }} title={`${d.date}: ${d.count}`} />
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ KPIs

function KpiSection({ webinars }: { webinars: WebinarWithMetrics[] }) {
  const closed = useMemo(() => webinars.filter((w) => w.status === "closed").sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)), [webinars]);
  const [selected, setSelected] = useState<number | null>(null);
  if (closed.length === 0) {
    return (
      <Card>
        <EmptyState title="No closed webinars yet" description="KPIs show up once a webinar has been closed." />
      </Card>
    );
  }
  const idx = Math.max(0, closed.findIndex((w) => w.id === (selected ?? closed[closed.length - 1].id)));
  const cur = closed[idx];
  const prev = idx > 0 ? closed[idx - 1] : null;
  const window = closed.slice(Math.max(0, idx - 7), idx + 1);
  const pick = (f: (w: WebinarWithMetrics) => number | null) => ({
    value: f(cur),
    previous: prev ? f(prev) : null,
    series: window.map((w) => f(w) ?? 0),
  });

  const kpis: { label: string; f: (w: WebinarWithMetrics) => number | null; format: (n: number | null) => string; lowerIsBetter?: boolean; neutral?: boolean; hint?: string }[] = [
    { label: "Registrations", f: (w) => w.metrics.registrations, format: formatNumber },
    { label: "Show-up", f: (w) => w.metrics.show_up_pct, format: (n) => formatPct(n, 1), hint: "attendees ÷ registrations" },
    { label: "Avg watch time", f: (w) => w.metrics.avg_watch_minutes, format: formatMinutes },
    { label: "Stayed till pitch", f: (w) => w.metrics.stayed_till_pitch_pct, format: (n) => formatPct(n, 1), hint: "of those who attended" },
    { label: "Calls booked", f: (w) => w.metrics.calls_booked, format: formatNumber },
    { label: "Sales", f: (w) => w.metrics.sales_count, format: formatNumber },
    { label: "Revenue", f: (w) => w.metrics.revenue_inr, format: formatINRCompact, hint: "paid sales only" },
    { label: "Ad spend", f: (w) => w.metrics.ad_spend_inr, format: formatINRCompact, neutral: true },
    { label: "ROAS", f: (w) => w.metrics.roas, format: formatRoas, hint: "revenue ÷ ad spend" },
    { label: "Revenue / registrant", f: (w) => w.metrics.revenue_per_registrant, format: (n) => formatINR(n) },
  ];

  return (
    <section aria-labelledby="kpi-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="kpi-heading" className="text-lg font-semibold tracking-tight">
            Key numbers
          </h2>
          <p className="text-[13px] text-ink-3">
            {cur.title} · {formatISTShort(cur.scheduled_at)}
            {prev ? <> · change versus {formatISTShort(prev.scheduled_at)}</> : null}
          </p>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-ink-3">
          <span>Webinar</span>
          <Select value={cur.id} onChange={(e) => setSelected(Number(e.target.value))} className="w-64 max-w-[60vw]" aria-label="Choose a closed webinar">
            {[...closed].reverse().map((w) => (
              <option key={w.id} value={w.id}>
                {formatISTShort(w.scheduled_at)} · {w.title}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((k) => {
          const d = pick(k.f);
          return <KpiCard key={k.label} label={k.label} format={k.format} lowerIsBetter={k.lowerIsBetter} neutral={k.neutral} hint={k.hint} {...d} />;
        })}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ recent

function RecentWebinars({ webinars }: { webinars: WebinarWithMetrics[] }) {
  const recent = [...webinars].sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at)).slice(0, 6);
  return (
    <Card>
      <CardHeader
        title="Recent webinars"
        description="Newest first. Open one for the full funnel, retention curve and people."
        actions={
          <LinkButton href="/webinars" variant="ghost" size="sm">
            All webinars <ArrowRight />
          </LinkButton>
        }
      />
      <div className="px-2 pb-2 pt-3">
        <ul className="divide-y divide-line">
          {recent.map((w) => (
            <li key={w.id}>
              <Link href={`/webinars/${w.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-xl px-3 py-3 transition-colors hover:bg-surface-2 md:grid-cols-[1fr_96px_96px_110px_72px]">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium">{w.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                    <span>{formatISTShort(w.scheduled_at)}</span>
                    <span>·</span>
                    <span>{slotLabel(w.time_slot)}</span>
                    <WebinarStatusBadge status={w.status} />
                  </p>
                </div>
                <Stat label="Show-up" value={w.status === "scheduled" ? "—" : formatPct(w.metrics.show_up_pct, 0)} />
                <Stat label="Sales" value={w.status === "scheduled" ? "—" : formatNumber(w.metrics.sales_count)} />
                <Stat label="Revenue" value={w.status === "scheduled" ? "—" : formatINRCompact(w.metrics.revenue_inr)} />
                <Stat label="ROAS" value={w.status === "closed" ? formatRoas(w.metrics.roas) : "—"} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden text-right md:block">
      <div className="tnum text-[14px] font-semibold">{value}</div>
      <div className="text-[11px] text-ink-3">{label}</div>
    </div>
  );
}
