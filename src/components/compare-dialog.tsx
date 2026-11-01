"use client";

import { Trophy } from "lucide-react";
import { WebinarStatusBadge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatINR, formatINRCompact, formatISTShort, formatMinutes, formatNumber, formatPct, formatRoas, slotLabel } from "@/lib/format";
import type { WebinarWithMetrics } from "@/lib/types";
import { cn } from "@/lib/utils";

type Row = {
  label: string;
  f: (w: WebinarWithMetrics) => number | null;
  format: (n: number | null) => string;
  lowerIsBetter?: boolean;
  noWinner?: boolean;
};

const ROWS: Row[] = [
  { label: "Registrations", f: (w) => w.metrics.registrations, format: formatNumber, noWinner: true },
  { label: "Attendees", f: (w) => w.metrics.attendees, format: formatNumber, noWinner: true },
  { label: "Show-up", f: (w) => w.metrics.show_up_pct, format: (n) => formatPct(n, 1) },
  { label: "Avg watch time", f: (w) => w.metrics.avg_watch_minutes, format: formatMinutes },
  { label: "Stayed till pitch", f: (w) => w.metrics.stayed_till_pitch_pct, format: (n) => formatPct(n, 1) },
  { label: "Calls booked", f: (w) => w.metrics.calls_booked, format: formatNumber },
  { label: "Sales", f: (w) => w.metrics.sales_count, format: formatNumber },
  { label: "Revenue", f: (w) => w.metrics.revenue_inr, format: formatINRCompact },
  { label: "Ad spend", f: (w) => w.metrics.ad_spend_inr, format: formatINRCompact, noWinner: true },
  { label: "ROAS", f: (w) => w.metrics.roas, format: formatRoas },
  { label: "Revenue / registrant", f: (w) => w.metrics.revenue_per_registrant, format: (n) => formatINR(n) },
  { label: "Cost / registrant", f: (w) => w.metrics.cost_per_registrant, format: (n) => formatINR(n), lowerIsBetter: true },
  { label: "Cost / attendee", f: (w) => w.metrics.cost_per_attendee, format: (n) => formatINR(n), lowerIsBetter: true },
];

export function CompareDialog({ open, onOpenChange, webinars }: { open: boolean; onOpenChange: (o: boolean) => void; webinars: WebinarWithMetrics[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Compare webinars" description="The best value in each row is marked with a trophy. Registrations, attendees and spend have no winner." wide className="max-w-5xl">
        <div className="scroll-thin -mx-2 overflow-x-auto px-2">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line align-bottom">
                <th scope="col" className="w-40 pb-3 text-left text-xs font-semibold text-ink-3">
                  Metric
                </th>
                {webinars.map((w) => (
                  <th key={w.id} scope="col" className="min-w-[150px] px-3 pb-3 text-left align-bottom">
                    <div className="line-clamp-2 text-[13px] font-semibold leading-snug">{w.title}</div>
                    <div className="mt-1 text-xs font-normal text-ink-3">
                      {formatISTShort(w.scheduled_at)} · {slotLabel(w.time_slot)}
                    </div>
                    <div className="mt-1.5">
                      <WebinarStatusBadge status={w.status} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => {
                const vals = webinars.map((w) => r.f(w));
                const valid = vals.filter((v): v is number => v !== null);
                const best = valid.length > 1 && !r.noWinner ? (r.lowerIsBetter ? Math.min(...valid) : Math.max(...valid)) : null;
                const max = Math.max(...valid, 1);
                return (
                  <tr key={r.label} className="border-b border-line last:border-0">
                    <th scope="row" className="py-2.5 text-left font-medium text-ink-2">
                      {r.label}
                    </th>
                    {vals.map((v, i) => {
                      const isBest = best !== null && v === best;
                      return (
                        <td key={webinars[i].id} className="px-3 py-2.5">
                          <div className={cn("tnum flex items-center gap-1.5", isBest ? "font-semibold text-ink" : "text-ink-2")}>
                            {r.format(v)}
                            {isBest ? <Trophy className="size-3.5 text-s2" aria-label="Best in this row" /> : null}
                          </div>
                          {v !== null && !r.noWinner ? (
                            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                              <div className="h-full rounded-full bg-s1" style={{ width: `${Math.max(3, (v / max) * 100)}%` }} />
                            </div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
