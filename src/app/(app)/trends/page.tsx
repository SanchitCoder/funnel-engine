"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownRight, ArrowUpRight, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { ChartCard } from "@/components/chart-card";
import { Heatmap, RankBars } from "@/components/charts";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tip } from "@/components/ui/tooltip";
import { formatINR, formatINRCompact, formatNumber, formatPct, formatRoas, slotLabel } from "@/lib/format";
import { useTrends } from "@/lib/hooks";
import type { TrendDimension, TrendRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const DIMENSIONS: { value: TrendDimension; label: string; noun: string }[] = [
  { value: "topic", label: "Topic", noun: "topic" },
  { value: "time_slot", label: "Time slot", noun: "time slot" },
  { value: "campaign", label: "Campaign", noun: "campaign" },
  { value: "adset", label: "Adset", noun: "adset" },
  { value: "ad", label: "Ad", noun: "ad" },
];

type MetricKey = "show_up" | "rpr" | "roas" | "revenue";
const METRICS: Record<MetricKey, { label: string; get: (r: TrendRow) => number | null; format: (n: number | null) => string }> = {
  show_up: { label: "Show-up", get: (r) => r.avg_show_up_pct, format: (n) => formatPct(n, 1) },
  rpr: { label: "Revenue per registrant", get: (r) => r.revenue_per_registrant, format: (n) => formatINR(n) },
  roas: { label: "ROAS", get: (r) => r.roas, format: formatRoas },
  revenue: { label: "Revenue", get: (r) => r.revenue_inr, format: formatINRCompact },
};

const MIN_WEBINARS = 3;

export default function TrendsPage() {
  const { data, isPending, error, refetch } = useTrends();
  const [dim, setDim] = useState<TrendDimension>("time_slot");
  const [metric, setMetric] = useState<MetricKey>("show_up");

  const rows = useMemo(() => (data ? data.dims[dim] : []), [data, dim]);
  const display = (r: TrendRow) => (dim === "time_slot" ? slotLabel(r.dimension_value) : r.label);
  const m = METRICS[metric];
  const ranked = useMemo(() => rows.filter((r) => m.get(r) !== null).sort((a, b) => (m.get(b) ?? 0) - (m.get(a) ?? 0)), [rows, m]);
  const best = ranked[0];
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : undefined;

  const columns = useMemo<ColumnDef<TrendRow, unknown>[]>(
    () => [
      {
        id: "name",
        header: DIMENSIONS.find((d) => d.value === dim)?.label ?? "Name",
        accessorFn: (r) => r.label,
        cell: ({ row }) => (
          <div className="min-w-[180px]">
            <p className="font-medium">{display(row.original)}</p>
            {dim === "ad" || dim === "adset" || dim === "campaign" ? <p className="mt-0.5 font-mono text-[11px] text-ink-3">…{row.original.dimension_value.slice(-6)}</p> : null}
          </div>
        ),
      },
      {
        id: "webinars",
        header: "Webinars",
        meta: { align: "right" },
        accessorFn: (r) => r.webinars_count,
        cell: ({ row }) => (
          <span className="inline-flex items-center justify-end gap-1.5">
            {row.original.webinars_count}
            {row.original.webinars_count < MIN_WEBINARS ? (
              <Tip content={`Based on fewer than ${MIN_WEBINARS} webinars. Treat this as a hint, not a verdict.`}>
                <span className="inline-flex" tabIndex={0} aria-label="Low data">
                  <TriangleAlert className="size-3.5 text-s2" aria-hidden />
                </span>
              </Tip>
            ) : null}
          </span>
        ),
      },
      { id: "show", header: "Show-up", meta: { align: "right" }, accessorFn: (r) => r.avg_show_up_pct ?? -1, cell: ({ row }) => formatPct(row.original.avg_show_up_pct, 1) },
      { id: "stay", header: "Stayed till pitch", meta: { align: "right" }, accessorFn: (r) => r.avg_stayed_till_pitch_pct ?? -1, cell: ({ row }) => formatPct(row.original.avg_stayed_till_pitch_pct, 1) },
      { id: "sales", header: "Sales", meta: { align: "right" }, accessorFn: (r) => r.sales, cell: ({ row }) => formatNumber(row.original.sales) },
      { id: "rev", header: "Revenue", meta: { align: "right" }, accessorFn: (r) => r.revenue_inr, cell: ({ row }) => formatINRCompact(row.original.revenue_inr) },
      { id: "spend", header: "Spend", meta: { align: "right" }, accessorFn: (r) => r.spend_inr, cell: ({ row }) => formatINRCompact(row.original.spend_inr) },
      { id: "roas", header: "ROAS", meta: { align: "right" }, accessorFn: (r) => r.roas ?? -1, cell: ({ row }) => formatRoas(row.original.roas) },
      { id: "rpr", header: "Rev / registrant", meta: { align: "right" }, accessorFn: (r) => r.revenue_per_registrant ?? -1, cell: ({ row }) => formatINR(row.original.revenue_per_registrant) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dim],
  );

  const allLowData = rows.length > 0 && rows.every((r) => r.webinars_count < MIN_WEBINARS);

  return (
    <>
      <PageHeader
        eyebrow="Trends"
        title="What keeps working"
        description="Compare topics, time slots and ads across your closed webinars. Anything built on fewer than three webinars carries a warning."
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={dim} onValueChange={(v) => setDim(v as TrendDimension)}>
          <TabsList aria-label="Group by">
            {DIMENSIONS.map((d) => (
              <TabsTrigger key={d.value} value={d.value}>
                {d.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
          <TabsList aria-label="Rank by">
            {(Object.keys(METRICS) as MetricKey[]).map((k) => (
              <TabsTrigger key={k} value={k}>
                {METRICS[k].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {isPending ? (
        <div className="space-y-6" aria-busy>
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : error ? (
        <Card>
          <ErrorState error={error} onRetry={() => refetch()} />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title="Nothing to compare yet" description="Trends appear after your first webinar has been closed." />
        </Card>
      ) : (
        <div className="space-y-6">
          {allLowData ? (
            <div role="status" className="flex items-start gap-2.5 rounded-xl border border-warning/50 bg-warning/15 px-4 py-3 text-[13px]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                Every {DIMENSIONS.find((d) => d.value === dim)?.noun} here has fewer than {MIN_WEBINARS} webinars behind it. Read these as early signals and keep testing.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {best ? <Callout kind="best" row={best} name={display(best)} metricLabel={m.label} value={m.format(m.get(best))} /> : null}
            {worst ? <Callout kind="worst" row={worst} name={display(worst)} metricLabel={m.label} value={m.format(m.get(worst))} /> : <Card className="grid place-items-center p-5 text-[13px] text-ink-3">Add another {DIMENSIONS.find((d) => d.value === dim)?.noun} to see a worst performer.</Card>}
          </div>

          <ChartCard
            title={`${m.label} by ${DIMENSIONS.find((d) => d.value === dim)?.noun}`}
            caption={best ? `${display(best)} leads at ${m.format(m.get(best))}${worst ? `, while ${display(worst)} trails at ${m.format(m.get(worst))}` : ""}.` : "Not enough data."}
            table={{ columns: [DIMENSIONS.find((d) => d.value === dim)?.label ?? "Name", m.label, "Webinars"], rows: ranked.map((r) => [display(r), m.format(m.get(r)), r.webinars_count]) }}
          >
            <RankBars data={ranked.map((r) => ({ label: display(r), value: m.get(r) ?? 0, sub: `${r.webinars_count} webinar${r.webinars_count === 1 ? "" : "s"}${r.webinars_count < MIN_WEBINARS ? " · low data" : ""}` }))} format={(n) => m.format(n)} />
          </ChartCard>

          <Card>
            <CardHeader title="Full ranking" description="Click a column to sort. The warning icon marks rows built on fewer than three webinars." />
            <div className="pt-3">
              <DataTable caption="Trend ranking" columns={columns} data={rows} initialSort={[{ id: "show", desc: true }]} />
            </div>
          </Card>

          <Card>
            <CardHeader title="When people show up" description="Average show-up by weekday and start time. Empty cells are slots you have not tried." />
            <CardBody>
              <Heatmap days={data.heatmap.days} times={data.heatmap.times} cells={data.heatmap.cells} />
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}

function Callout({ kind, row, name, metricLabel, value }: { kind: "best" | "worst"; row: TrendRow; name: string; metricLabel: string; value: string }) {
  const best = kind === "best";
  const low = row.webinars_count < MIN_WEBINARS;
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <span className={cn("flex size-7 items-center justify-center rounded-lg", best ? "bg-good/12 text-good-text" : "bg-critical/10 text-critical-text")}>
          {best ? <ArrowUpRight className="size-4" aria-hidden /> : <ArrowDownRight className="size-4" aria-hidden />}
        </span>
        <span className="eyebrow">{best ? "Best performer" : "Needs attention"}</span>
      </div>
      <p className="mt-3 text-lg font-semibold leading-snug tracking-tight">{name}</p>
      <p className="mt-1 text-[13px] text-ink-2">
        <span className="tnum font-semibold">{value}</span> {metricLabel.toLowerCase()} across {row.webinars_count} webinar{row.webinars_count === 1 ? "" : "s"}
      </p>
      {low ? (
        <Badge tone="warn" className="mt-3">
          <TriangleAlert aria-hidden /> Low data: fewer than {MIN_WEBINARS} webinars
        </Badge>
      ) : null}
    </Card>
  );
}
