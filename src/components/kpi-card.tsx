"use client";

import { animate, useReducedMotion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";

/** Animates a number toward `value`; honours prefers-reduced-motion. */
export function useCountUp(value: number | null, duration = 0.9): number | null {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<number | null>(reduce ? value : value === null ? null : 0);
  const prev = useRef<number>(0);
  useEffect(() => {
    if (value === null) {
      setShown(null);
      return;
    }
    if (reduce) {
      setShown(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setShown(v),
      onComplete: () => {
        prev.current = value;
      },
    });
    return () => controls.stop();
  }, [value, duration, reduce]);
  return shown;
}

export function Sparkline({ values, className, label }: { values: number[]; className?: string; label?: string }) {
  const gid = useId();
  if (values.length < 2) return <div className={cn("h-9", className)} />;
  const w = 120;
  const h = 36;
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [pad + (i * (w - pad * 2)) / (values.length - 1), h - pad - ((v - min) / span) * (h - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0]},${h} L${pts[0][0]},${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-9 w-full", className)} role="img" aria-label={label ?? "Trend over recent webinars"} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--s1)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--s1)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="var(--s1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--s1)" stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  format,
  previous,
  series,
  lowerIsBetter,
  neutral,
  hint,
}: {
  label: string;
  value: number | null;
  format: (n: number | null) => string;
  previous: number | null;
  series: number[];
  lowerIsBetter?: boolean;
  neutral?: boolean;
  hint?: string;
}) {
  const shown = useCountUp(value);
  let delta: number | null = null;
  if (value !== null && previous !== null && previous !== 0) delta = ((value - previous) / Math.abs(previous)) * 100;
  const up = delta !== null && delta > 0.05;
  const down = delta !== null && delta < -0.05;
  const good = !neutral && ((up && !lowerIsBetter) || (down && lowerIsBetter));
  const bad = !neutral && ((down && !lowerIsBetter) || (up && lowerIsBetter));
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <Card className="flex flex-col gap-3 p-4 transition-shadow hover:shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">{label}</span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1.5">
        <div className="tnum whitespace-nowrap text-[28px] font-semibold leading-none tracking-[-0.03em]" aria-label={`${label}: ${format(value)}`}>
          {format(shown)}
        </div>
        <div
          className={cn(
            "mb-0.5 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
            good && "bg-good/12 text-good-text",
            bad && "bg-critical/10 text-critical-text",
            !good && !bad && "bg-surface-3 text-ink-3",
          )}
        >
          <Icon className="size-3" aria-hidden />
          <span className="tnum">{delta === null ? "n/a" : `${Math.abs(delta).toFixed(delta !== null && Math.abs(delta) >= 100 ? 0 : 1)}%`}</span>
          <span className="sr-only">{up ? "up" : down ? "down" : "flat"} versus the previous webinar</span>
        </div>
      </div>
      <Sparkline values={series} label={`${label} across recent webinars`} />
      {hint ? <p className="-mt-1 text-[11.5px] text-ink-3">{hint}</p> : null}
    </Card>
  );
}

export function KpiSkeleton() {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-9 w-full" />
    </Card>
  );
}
