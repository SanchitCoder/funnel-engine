"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUp, Clock } from "lucide-react";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { formatINRCompact, formatNumber, formatPct } from "@/lib/format";
import type { RetentionPoint } from "@/lib/metrics";
import type { AdAction } from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------- shared bits

interface TipProps<T> {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: T }>;
}

function TipBox({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">{children}</div>;
}

const AXIS = { fill: "var(--ink-3)", fontSize: 11 } as const;

// ---------------------------------------------------------------- funnel

export interface FunnelStage {
  key: string;
  label: string;
  value: number;
  dropLabel: string;
  /** shown instead of a number while a stage has not happened yet (e.g. the pitch of a live webinar) */
  pending?: string;
}

export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const reduce = useReducedMotion();
  const top = Math.max(stages[0]?.value ?? 1, 1);
  return (
    <ol className="space-y-1" aria-label="Funnel stages">
      {stages.map((s, i) => {
        const prev = stages[i - 1];
        const pct = (s.value / top) * 100;
        let drop: ReactNode = null;
        if (s.pending) {
          drop = (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden />
              {s.pending}
            </span>
          );
        } else if (prev && !prev.pending) {
          if (s.value <= prev.value) {
            const lost = prev.value - s.value;
            const p = prev.value ? (lost / prev.value) * 100 : 0;
            drop = (
              <span className="inline-flex items-center gap-1">
                <ArrowDown className="size-3" aria-hidden />
                {formatNumber(lost)} ({p.toFixed(0)}%) {s.dropLabel}
              </span>
            );
          } else {
            drop = (
              <span className="inline-flex items-center gap-1 text-good-text">
                <ArrowUp className="size-3" aria-hidden />
                {formatNumber(s.value - prev.value)} more came in without this step
              </span>
            );
          }
        }
        return (
          <li key={s.key}>
            {drop ? <div className="mb-1 ml-1 mt-1.5 text-xs text-ink-3 sm:ml-[148px]">{drop}</div> : null}
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[140px_1fr_96px]">
              <div className="col-span-2 text-[13px] font-medium sm:col-span-1">{s.label}</div>
              <div className="h-7 overflow-hidden rounded-md bg-surface-3">
                <motion.div
                  className="h-full rounded-md"
                  style={{ background: `var(--funnel-${i + 1})` }}
                  initial={{ width: reduce ? `${Math.max(pct, 1.2)}%` : 0 }}
                  animate={{ width: `${Math.max(pct, 1.2)}%` }}
                  transition={{ duration: 0.8, delay: reduce ? 0 : i * 0.09, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </div>
              <div className="tnum text-right text-[13px]">
                <span className="font-semibold">{s.pending ? "—" : formatNumber(s.value)}</span>
                {s.pending ? null : <span className="ml-1.5 text-ink-3">{formatPct(pct, 0)}</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------- retention

export function RetentionChart({
  points,
  pitch,
  duration,
  drops,
  live,
}: {
  points: RetentionPoint[];
  pitch: number;
  duration: number;
  drops: { minute: number; lost: number; pct: number }[];
  live: boolean;
}) {
  const reduce = useReducedMotion();
  const peak = points.reduce((m, p) => Math.max(m, p.viewers), 1);
  const ticks = Array.from({ length: Math.floor(duration / 10) + 1 }, (_, i) => i * 10);
  const at = (m: number) => points.find((p) => p.minute === m)?.viewers ?? 0;
  const lastMinute = points.length ? points[points.length - 1].minute : 0;
  return (
    <div className="h-[300px] w-full" role="img" aria-label={`Live viewers by minute. Peak ${peak}. Pitch starts at minute ${pitch}.`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 22, right: 18, bottom: 0, left: -6 }}>
          <defs>
            <linearGradient id="retFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--s1)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--s1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="minute" type="number" domain={[0, duration]} ticks={ticks} tick={AXIS} tickFormatter={(m: number) => `${m}m`} tickLine={false} axisLine={{ stroke: "var(--axis)" }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
            content={(p) => {
              const { active, payload } = p as unknown as TipProps<RetentionPoint>;
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <TipBox>
                  <div className="font-semibold">Minute {d.minute}</div>
                  <div className="tnum text-ink-2">
                    {formatNumber(d.viewers)} watching · {formatPct((100 * d.viewers) / peak, 0)} of peak
                  </div>
                  {d.minute === pitch ? <div className="mt-0.5 text-ink-3">Pitch starts here</div> : null}
                </TipBox>
              );
            }}
          />
          <ReferenceLine x={pitch} stroke="var(--ink-3)" strokeDasharray="4 4" label={{ value: "Pitch", position: "insideTopRight", fill: "var(--ink-2)", fontSize: 11, fontWeight: 600 }} />
          {live ? <ReferenceLine x={lastMinute} stroke="var(--critical)" strokeWidth={1.5} label={{ value: "Now", position: "insideTopLeft", fill: "var(--critical-text)", fontSize: 11, fontWeight: 600 }} /> : null}
          <Area
            dataKey="viewers"
            type="monotone"
            stroke="var(--s1)"
            strokeWidth={2}
            fill="url(#retFill)"
            isAnimationActive={!reduce}
            animationDuration={1300}
            animationEasing="ease-out"
            activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2, fill: "var(--s1)" }}
          />
          {drops.map((d, i) => (
            <ReferenceDot
              key={d.minute}
              x={d.minute}
              y={at(d.minute)}
              r={6}
              fill="var(--s2)"
              stroke="var(--surface)"
              strokeWidth={2}
              ifOverflow="visible"
              label={{ value: String(i + 1), position: "top", fill: "var(--ink)", fontSize: 11, fontWeight: 700 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------- histogram

export function WatchHistogram({ bins, pitch }: { bins: { label: string; count: number; from: number; to: number }[]; pitch: number }) {
  const reduce = useReducedMotion();
  const total = bins.reduce((s, b) => s + b.count, 0);
  return (
    <div className="h-[260px] w-full" role="img" aria-label={`Watch time distribution across ${total} attendees`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bins} margin={{ top: 12, right: 12, bottom: 0, left: -10 }} barCategoryGap={6}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--axis)" }} interval={0} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--surface-3)", opacity: 0.6 }}
            content={(p) => {
              const { active, payload } = p as unknown as TipProps<{ label: string; count: number; from: number; to: number }>;
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <TipBox>
                  <div className="font-semibold">{d.label} min watched</div>
                  <div className="tnum text-ink-2">
                    {formatNumber(d.count)} attendees · {total ? formatPct((100 * d.count) / total, 0) : "0%"}
                  </div>
                  {d.from <= pitch && pitch < d.to ? <div className="mt-0.5 text-ink-3">The pitch starts in this band</div> : null}
                </TipBox>
              );
            }}
          />
          <Bar dataKey="count" fill="var(--s1)" radius={[4, 4, 0, 0]} maxBarSize={42} isAnimationActive={!reduce} animationDuration={900} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------- heatmap (sequential, one hue)

export function Heatmap({
  days,
  times,
  cells,
  valueLabel = "show-up",
}: {
  days: string[];
  times: string[];
  cells: { day: string; time: string; show_up: number | null; webinars: number }[];
  valueLabel?: string;
}) {
  const values = cells.map((c) => c.show_up).filter((v): v is number => v !== null);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = (v: number) => (max === min ? 4 : Math.min(7, Math.max(1, 1 + Math.round(((v - min) / (max - min)) * 6))));
  const hour = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h >= 12 ? "PM" : "AM"}`;
  };
  return (
    <div>
      <div className="scroll-thin overflow-x-auto">
        <div className="min-w-[420px]" role="table" aria-label={`Average ${valueLabel} by weekday and start time`}>
          <div role="row" className="grid gap-1.5" style={{ gridTemplateColumns: `56px repeat(${times.length}, minmax(72px, 1fr))` }}>
            <div role="columnheader" />
            {times.map((t) => (
              <div key={t} role="columnheader" className="pb-1 text-center text-xs font-medium text-ink-3">
                {hour(t)}
              </div>
            ))}
          </div>
          {days.map((day) => (
            <div key={day} role="row" className="mt-1.5 grid gap-1.5" style={{ gridTemplateColumns: `56px repeat(${times.length}, minmax(72px, 1fr))` }}>
              <div role="rowheader" className="flex items-center text-xs font-medium text-ink-3">
                {day}
              </div>
              {times.map((t) => {
                const c = cells.find((x) => x.day === day && x.time === t);
                if (!c || c.show_up === null) {
                  return <div key={t} role="cell" className="h-12 rounded-lg border border-dashed border-line" aria-label={`${day} ${hour(t)}: no webinars`} />;
                }
                const s = step(c.show_up);
                return (
                  <div
                    key={t}
                    role="cell"
                    tabIndex={0}
                    title={`${day} ${hour(t)} · ${c.show_up.toFixed(1)}% ${valueLabel} across ${c.webinars} webinar${c.webinars > 1 ? "s" : ""}`}
                    aria-label={`${day} ${hour(t)}: ${c.show_up.toFixed(1)}% ${valueLabel}, ${c.webinars} webinars`}
                    className="flex h-12 flex-col items-center justify-center rounded-lg ring-offset-2 transition-transform hover:scale-[1.04]"
                    style={{ background: `var(--seq-${s})`, color: `var(--on-${s})` }}
                  >
                    <span className="tnum text-sm font-semibold leading-none">{c.show_up.toFixed(0)}%</span>
                    <span className="tnum mt-1 text-[10px] leading-none opacity-80">{c.webinars} webinar{c.webinars > 1 ? "s" : ""}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-ink-3">
        <span>Lower</span>
        <div className="flex overflow-hidden rounded-full">
          {[1, 2, 3, 4, 5, 6, 7].map((s) => (
            <span key={s} className="h-2.5 w-6" style={{ background: `var(--seq-${s})` }} />
          ))}
        </div>
        <span>Higher {valueLabel}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- scatter (spend vs revenue)

export interface AdPoint {
  id: string;
  name: string;
  x: number; // spend
  y: number; // revenue
  roas: number | null;
  action: AdAction;
  highlight?: boolean;
}

export const ACTION_COLOR: Record<AdAction, string> = {
  Scale: "var(--good)",
  Keep: "var(--s1)",
  Watch: "var(--warning)",
  Pause: "var(--critical)",
};

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: AdPoint;
}

function AdDot({ cx = 0, cy = 0, payload }: DotProps) {
  if (!payload) return null;
  const right = cx < 520;
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={ACTION_COLOR[payload.action]} stroke="var(--surface)" strokeWidth={2} />
      {payload.highlight ? (
        <text x={right ? cx + 13 : cx - 13} y={cy + 4} textAnchor={right ? "start" : "end"} fontSize={11} fontWeight={600} fill="var(--ink)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke">
          {payload.name.length > 26 ? `${payload.name.slice(0, 25)}…` : payload.name}
        </text>
      ) : null}
    </g>
  );
}

export function SpendRevenueScatter({ points, scaleRoas, onSelect }: { points: AdPoint[]; scaleRoas: number; onSelect?: (id: string) => void }) {
  const maxX = Math.max(...points.map((p) => p.x), 1) * 1.1;
  const maxY = Math.max(...points.map((p) => p.y), 1) * 1.12;
  return (
    <div className="h-[340px] w-full" role="img" aria-label="Scatter of ad spend against revenue. Dots above the break-even line earned more than they cost.">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 14, right: 22, bottom: 8, left: 2 }}>
          <CartesianGrid stroke="var(--line)" />
          <XAxis type="number" dataKey="x" name="Spend" domain={[0, maxX]} tick={AXIS} tickFormatter={(v: number) => formatINRCompact(v)} tickLine={false} axisLine={{ stroke: "var(--axis)" }} label={{ value: "Ad spend", position: "insideBottom", offset: -2, fill: "var(--ink-3)", fontSize: 11 }} height={42} />
          <YAxis type="number" dataKey="y" name="Revenue" domain={[0, maxY]} tick={AXIS} tickFormatter={(v: number) => formatINRCompact(v)} tickLine={false} axisLine={false} width={54} label={{ value: "Revenue", angle: -90, position: "insideLeft", fill: "var(--ink-3)", fontSize: 11, offset: 10 }} />
          <ZAxis range={[120, 120]} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: maxX, y: maxX }]} stroke="var(--ink-3)" strokeDasharray="5 4" ifOverflow="hidden" label={{ value: "Break-even · 1×", position: "insideBottomRight", fill: "var(--ink-3)", fontSize: 11 }} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: maxX, y: maxX * scaleRoas }]} stroke="var(--good)" strokeDasharray="2 4" ifOverflow="hidden" label={{ value: `Scale line · ${scaleRoas}×`, position: "insideTopLeft", fill: "var(--good-text)", fontSize: 11 }} />
          <Tooltip
            cursor={{ stroke: "var(--axis)", strokeDasharray: "3 3" }}
            content={(p) => {
              const { active, payload } = p as unknown as TipProps<AdPoint>;
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <TipBox>
                  <div className="font-semibold">{d.name}</div>
                  <div className="tnum mt-0.5 text-ink-2">
                    Spent {formatINRCompact(d.x)} · earned {formatINRCompact(d.y)}
                  </div>
                  <div className="tnum text-ink-2">ROAS {d.roas === null ? "—" : `${d.roas.toFixed(1)}×`} · {d.action}</div>
                </TipBox>
              );
            }}
          />
          <Scatter
            data={points}
            shape={(props: unknown) => <AdDot {...(props as DotProps)} />}
            isAnimationActive={false}
            onClick={(d: unknown) => {
              const id = (d as { payload?: AdPoint })?.payload?.id;
              if (id && onSelect) onSelect(id);
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------- ranked bars

export function RankBars({
  data,
  format,
  height,
  highlight,
}: {
  data: { label: string; value: number; sub?: string }[];
  format: (n: number) => string;
  height?: number;
  highlight?: string;
}) {
  const reduce = useReducedMotion();
  const h = height ?? Math.max(160, data.length * 38 + 20);
  return (
    <div style={{ height: h }} className="w-full" role="img" aria-label="Ranked bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 4 }} barCategoryGap={10}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            tick={{ fill: "var(--ink-2)", fontSize: 12 }}
            tickFormatter={(v: string) => (v.length > 24 ? `${v.slice(0, 23)}…` : v)}
            tickLine={false}
            axisLine={{ stroke: "var(--axis)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-3)", opacity: 0.5 }}
            content={(p) => {
              const { active, payload } = p as unknown as TipProps<{ label: string; value: number; sub?: string }>;
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <TipBox>
                  <div className="font-semibold">{d.label}</div>
                  <div className="tnum text-ink-2">{format(d.value)}</div>
                  {d.sub ? <div className="text-ink-3">{d.sub}</div> : null}
                </TipBox>
              );
            }}
          />
          <Bar dataKey="value" fill="var(--s1)" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={!reduce} animationDuration={800}>
            <LabelList dataKey="value" position="right" formatter={(v: unknown) => format(Number(v))} fill="var(--ink)" fontSize={12} fontWeight={600} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {highlight ? <span className="sr-only">{highlight}</span> : null}
    </div>
  );
}

// ---------------------------------------------------------------- monthly revenue

export function MonthlyRevenue({ months }: { months: { label: string; revenue_inr: number; sales: number }[] }) {
  const reduce = useReducedMotion();
  return (
    <div className="h-[240px] w-full" role="img" aria-label="Revenue by month">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={months} margin={{ top: 22, right: 12, bottom: 0, left: -4 }} barCategoryGap="28%">
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--axis)" }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => formatINRCompact(v)} />
          <Tooltip
            cursor={{ fill: "var(--surface-3)", opacity: 0.5 }}
            content={(p) => {
              const { active, payload } = p as unknown as TipProps<{ label: string; revenue_inr: number; sales: number }>;
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <TipBox>
                  <div className="font-semibold">{d.label}</div>
                  <div className="tnum text-ink-2">
                    {formatINRCompact(d.revenue_inr)} from {d.sales} sale{d.sales === 1 ? "" : "s"}
                  </div>
                </TipBox>
              );
            }}
          />
          <Bar dataKey="revenue_inr" fill="var(--s1)" radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={!reduce} animationDuration={900}>
            <LabelList dataKey="revenue_inr" position="top" formatter={(v: unknown) => formatINRCompact(Number(v))} fill="var(--ink)" fontSize={12} fontWeight={600} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------- two-part share bar

export function ShareBar({
  parts,
  className,
}: {
  parts: { label: string; value: number; color: string; display: string }[];
  className?: string;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className={className}>
      <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.label} ${p.display}`).join(", ")}>
        {parts.map((p) => (
          <div key={p.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.value / total) * 100}%`, background: p.color, minWidth: p.value > 0 ? 6 : 0 }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {parts.map((p) => (
          <span key={p.label} className={cn("inline-flex items-center gap-1.5 text-ink-2")}>
            <span className="size-2.5 rounded-full" style={{ background: p.color }} aria-hidden />
            {p.label} <span className="tnum font-semibold text-ink">{p.display}</span>
            <span className="tnum text-ink-3">({((p.value / total) * 100).toFixed(0)}%)</span>
          </span>
        ))}
      </div>
    </div>
  );
}
