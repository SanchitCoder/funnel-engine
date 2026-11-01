"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { HelpCircle, Info, Sprout } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ChartCard, LegendDot } from "@/components/chart-card";
import { ACTION_COLOR, ShareBar, SpendRevenueScatter, type AdPoint } from "@/components/charts";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { ActionBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tip } from "@/components/ui/tooltip";
import { formatINR, formatINRCompact, formatNumber, formatRoas } from "@/lib/format";
import { useAttribution } from "@/lib/hooks";
import { AD_RULE_LINES, AD_RULES } from "@/lib/metrics";
import type { AdAction, AttributionRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Level = "campaign" | "adset" | "ad";

export default function AttributionPage() {
  return (
    <Suspense>
      <AttributionView />
    </Suspense>
  );
}

function RulesTip() {
  return (
    <Tip
      side="bottom"
      className="max-w-sm"
      content={
        <div className="space-y-1.5">
          <p className="font-semibold">How an ad gets its label</p>
          {AD_RULE_LINES.map((r) => (
            <p key={r.action}>
              <span className="font-semibold">{r.action}:</span> {r.rule}
            </p>
          ))}
          <p className="text-surface/70">ROAS is revenue from people who registered through that ad, divided by its spend.</p>
        </div>
      }
    >
      <Button variant="secondary" size="sm">
        <HelpCircle /> How labels work
      </Button>
    </Tip>
  );
}

function AttributionView() {
  const params = useSearchParams();
  const focusAd = params.get("ad");
  const [level, setLevel] = useState<Level>("ad");
  const [selected, setSelected] = useState<string | null>(focusAd);
  const { data, isPending, error, refetch } = useAttribution(level);

  const points: AdPoint[] = useMemo(() => {
    if (!data) return [];
    const bestRoas = [...data.rows].filter((r) => r.roas !== null).sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))[0];
    const worstSpender = [...data.rows].filter((r) => r.action === "Pause").sort((a, b) => b.spend_inr - a.spend_inr)[0];
    return data.rows.map((r) => ({ id: r.id, name: r.label, x: r.spend_inr, y: r.revenue_inr, roas: r.roas, action: r.action, highlight: r.id === bestRoas?.id || r.id === worstSpender?.id || r.id === selected }));
  }, [data, selected]);

  const columns = useMemo<ColumnDef<AttributionRow, unknown>[]>(
    () => [
      {
        id: "name",
        header: level === "ad" ? "Ad" : level === "adset" ? "Adset" : "Campaign",
        accessorFn: (r) => r.label,
        cell: ({ row }) => (
          <div className="min-w-[200px]">
            <p className="font-medium leading-snug">{row.original.label}</p>
            <p className="mt-0.5 text-xs text-ink-3">{row.original.parent ?? "—"}</p>
          </div>
        ),
      },
      {
        id: "action",
        header: "Call",
        accessorFn: (r) => r.action,
        cell: ({ row }) => (
          <Tip content={row.original.reason}>
            <span className="inline-flex" tabIndex={0}>
              <ActionBadge action={row.original.action} />
            </span>
          </Tip>
        ),
      },
      { id: "spend", header: "Spend", meta: { align: "right" }, accessorFn: (r) => r.spend_inr, cell: ({ row }) => formatINRCompact(row.original.spend_inr) },
      { id: "regs", header: "Registrants", meta: { align: "right" }, accessorFn: (r) => r.registrations, cell: ({ row }) => formatNumber(row.original.registrations) },
      { id: "att", header: "Attendees", meta: { align: "right" }, accessorFn: (r) => r.attendees, cell: ({ row }) => formatNumber(row.original.attendees) },
      { id: "sales", header: "Sales", meta: { align: "right" }, accessorFn: (r) => r.sales, cell: ({ row }) => formatNumber(row.original.sales) },
      { id: "rev", header: "Revenue", meta: { align: "right" }, accessorFn: (r) => r.revenue_inr, cell: ({ row }) => formatINRCompact(row.original.revenue_inr) },
      { id: "roas", header: "ROAS", meta: { align: "right" }, accessorFn: (r) => r.roas ?? -1, cell: ({ row }) => <span className="font-semibold">{formatRoas(row.original.roas)}</span> },
      { id: "cpr", header: "Cost / registrant", meta: { align: "right" }, accessorFn: (r) => r.cost_per_registrant ?? 0, cell: ({ row }) => formatINR(row.original.cost_per_registrant) },
      { id: "cpa", header: "Cost / attendee", meta: { align: "right" }, accessorFn: (r) => r.cost_per_attendee ?? 0, cell: ({ row }) => formatINR(row.original.cost_per_attendee) },
    ],
    [level],
  );

  const totals = useMemo(() => {
    if (!data) return null;
    const spend = data.split.paid_spend_inr;
    const rev = data.split.paid.revenue_inr;
    return { spend, rev, roas: spend ? rev / spend : null, organicRev: data.split.organic.revenue_inr };
  }, [data]);

  return (
    <>
      <PageHeader
        eyebrow="Attribution"
        title="Which ads actually pay back"
        description="Spend, registrations, attendance and revenue for every campaign, adset and ad, so you can put money where it earns."
        actions={<RulesTip />}
      />
      <p className="mb-5 flex items-start gap-2 text-[13px] text-ink-3">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold text-ink-2">Last-touch attribution by registration ad.</strong> A sale is credited to the ad someone used to register, even if they bought days later. Closed webinars only; ad spend is shared across webinars by each day&apos;s registrants.
        </span>
      </p>

      <div className="mb-5">
        <Tabs value={level} onValueChange={(v) => setLevel(v as Level)}>
          <TabsList aria-label="Level">
            <TabsTrigger value="ad">Ads</TabsTrigger>
            <TabsTrigger value="adset">Adsets</TabsTrigger>
            <TabsTrigger value="campaign">Campaigns</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isPending ? (
        <div className="space-y-6" aria-busy>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      ) : error ? (
        <Card>
          <ErrorState error={error} onRetry={() => refetch()} />
        </Card>
      ) : data.rows.length === 0 ? (
        <Card>
          <EmptyState title="No ad data yet" description="Attribution fills in once registrants arrive with an ad_id and ad spend has been ingested." />
        </Card>
      ) : (
        <div className="space-y-6">
          {totals ? (
            <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Ad spend" value={formatINRCompact(totals.spend)} sub={data.pending_spend_inr ? `+ ${formatINRCompact(data.pending_spend_inr)} on webinars not closed yet` : "closed webinars"} />
              <Stat label="Revenue from ad registrants" value={formatINRCompact(totals.rev)} sub={`${data.split.paid.sales} paid sales`} />
              <Stat label="Blended ROAS" value={formatRoas(totals.roas)} sub="revenue ÷ ad spend" />
              <Stat label="Organic revenue" value={formatINRCompact(totals.organicRev)} sub="no ad cost" />
            </section>
          ) : null}

          <ChartCard
            title="Spend against revenue"
            caption={`Dots above the dashed break-even line earned back more than they cost. ${data.rows.filter((r) => r.action === "Pause").length} ${level}${data.rows.filter((r) => r.action === "Pause").length === 1 ? " sits" : "s sit"} below it with real spend.`}
            table={{ columns: [level === "ad" ? "Ad" : level === "adset" ? "Adset" : "Campaign", "Spend", "Revenue", "ROAS", "Call"], rows: data.rows.map((r) => [r.label, formatINR(r.spend_inr), formatINR(r.revenue_inr), formatRoas(r.roas), r.action]) }}
            legend={(["Scale", "Keep", "Watch", "Pause"] as AdAction[]).map((a) => (
              <LegendDot key={a} color={ACTION_COLOR[a]} label={a} />
            ))}
          >
            <SpendRevenueScatter points={points} scaleRoas={AD_RULES.scaleRoas} onSelect={setSelected} />
          </ChartCard>

          <Card>
            <CardHeader title="Leaderboard" description="Sorted by ROAS. Hover a label for the reason it was given." />
            <div className="pt-3">
              <DataTable caption="Attribution leaderboard" columns={columns} data={data.rows} initialSort={[{ id: "roas", desc: true }]} rowClassName={(r) => (r.id === selected ? "bg-accent-soft/60" : undefined)} onRowClick={(r) => setSelected((s) => (s === r.id ? null : r.id))} />
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <Card>
              <CardHeader title="Paid vs organic" description="Where registrants came from, and where the money came from." />
              <CardBody className="space-y-6">
                <div>
                  <p className="mb-2 text-[13px] font-medium">Registrants</p>
                  <ShareBar
                    parts={[
                      { label: "Paid ads", value: data.split.paid.registrations, color: "var(--s1)", display: formatNumber(data.split.paid.registrations) },
                      { label: "Organic", value: data.split.organic.registrations, color: "var(--s2)", display: formatNumber(data.split.organic.registrations) },
                    ]}
                  />
                </div>
                <div>
                  <p className="mb-2 text-[13px] font-medium">Revenue</p>
                  <ShareBar
                    parts={[
                      { label: "Paid ads", value: data.split.paid.revenue_inr, color: "var(--s1)", display: formatINRCompact(data.split.paid.revenue_inr) },
                      { label: "Organic", value: data.split.organic.revenue_inr, color: "var(--s2)", display: formatINRCompact(data.split.organic.revenue_inr) },
                    ]}
                  />
                </div>
                <p className="text-[13px] text-ink-3">
                  A paid registrant is worth {formatINR(data.split.paid.registrations ? data.split.paid.revenue_inr / data.split.paid.registrations : null)} in revenue. An organic one is worth {formatINR(data.split.organic.registrations ? data.split.organic.revenue_inr / data.split.organic.registrations : null)}.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Organic sources" description="Free traffic, ranked by revenue." />
              <div className="px-2 pb-2 pt-3">
                <ul className="divide-y divide-line">
                  {data.organic.map((o) => {
                    const paidRpr = data.split.paid.registrations ? data.split.paid.revenue_inr / data.split.paid.registrations : 0;
                    const topRpr = Math.max(...data.organic.map((x) => x.revenue_per_registrant ?? 0));
                    const star = o.revenue_per_registrant === topRpr && (o.revenue_per_registrant ?? 0) > paidRpr * 3 && o.registrations / (data.split.paid.registrations + data.split.organic.registrations) < 0.1;
                    return (
                      <li key={o.source} className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-3">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
                            <Sprout className="size-4 text-s3" aria-hidden />
                            {o.source}
                            {star ? <Badge tone="good">Small but very profitable</Badge> : null}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-3">
                            {formatNumber(o.registrations)} registrants · {formatNumber(o.attendees)} attended · {o.sales} sales
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={cn("tnum text-[15px] font-semibold")}>{formatINRCompact(o.revenue_inr)}</p>
                          <p className="tnum text-xs text-ink-3">{formatINR(o.revenue_per_registrant)} per registrant</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="eyebrow mb-2">{label}</div>
      <div className="tnum text-2xl font-semibold leading-none tracking-[-0.02em]">{value}</div>
      <div className="mt-1.5 text-xs text-ink-3">{sub}</div>
    </Card>
  );
}
