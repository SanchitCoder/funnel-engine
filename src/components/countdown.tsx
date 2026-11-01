"use client";

import { useNow } from "@/lib/clock";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function Countdown({ target }: { target: string }) {
  const now = useNow(1000);
  const diff = Date.parse(target) - now;
  if (diff <= 0) return <p className="text-lg font-semibold">Starting now</p>;
  const p = parts(diff);
  const cells: [number, string][] = [
    [p.d, "days"],
    [p.h, "hours"],
    [p.m, "min"],
    [p.s, "sec"],
  ];
  return (
    <div role="timer" aria-label={`${p.d} days ${p.h} hours ${p.m} minutes until the webinar`} className="grid grid-cols-4 gap-2">
      {cells.map(([n, label]) => (
        <div key={label} className="rounded-xl border border-line bg-surface-2 px-2 py-2.5 text-center">
          <div className="tnum text-2xl font-semibold leading-none tracking-tight">{String(n).padStart(2, "0")}</div>
          <div className="mt-1.5 text-[10.5px] font-medium uppercase tracking-wider text-ink-3">{label}</div>
        </div>
      ))}
    </div>
  );
}
