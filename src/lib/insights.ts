import { formatINRCompact, formatPct, formatRoas, slotLabel } from "./format";
import type { AttributionRow, OrganicSource, TrendRow } from "./types";

export interface Insight {
  id: string;
  tone: "good" | "warn" | "info";
  title: string;
  body: string;
  href: string;
  cta: string;
}

const weekday: Record<string, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

/** Plain-language read of the data, derived from trends + attribution. */
export function buildInsights(args: {
  slots: TrendRow[];
  topics: TrendRow[];
  ads: AttributionRow[];
  organic: OrganicSource[];
  paidRevenuePerRegistrant: number | null;
}): Insight[] {
  const out: Insight[] = [];
  const { slots, topics, ads, organic, paidRevenuePerRegistrant } = args;

  const rankedSlots = [...slots].filter((s) => s.avg_show_up_pct !== null).sort((a, b) => (b.avg_show_up_pct ?? 0) - (a.avg_show_up_pct ?? 0));
  if (rankedSlots.length > 1) {
    const best = rankedSlots[0];
    const rest = rankedSlots.slice(1);
    const restAvg = rest.reduce((s, r) => s + (r.avg_show_up_pct ?? 0), 0) / rest.length;
    const [day, time] = best.dimension_value.split("-");
    out.push({
      id: "slot",
      tone: "good",
      title: `${weekday[day] ?? day} ${slotLabel(`${day}-${time}`).split("· ")[1]} is your strongest slot`,
      body: `${formatPct(best.avg_show_up_pct, 0)} of registrants show up, against ${formatPct(restAvg, 0)} in your other slots.`,
      href: "/trends",
      cta: "See all slots",
    });
  }

  const rankedTopics = [...topics].filter((t) => t.revenue_per_registrant !== null).sort((a, b) => (b.revenue_per_registrant ?? 0) - (a.revenue_per_registrant ?? 0));
  if (rankedTopics.length > 1) {
    const best = rankedTopics[0];
    const rest = rankedTopics.slice(1);
    const restAvg = rest.reduce((s, r) => s + (r.revenue_per_registrant ?? 0), 0) / rest.length;
    out.push({
      id: "topic",
      tone: "good",
      title: `“${best.label}” sells best`,
      body: `Each registrant is worth ${formatINRCompact(best.revenue_per_registrant)}, about ${(restAvg ? (best.revenue_per_registrant ?? 0) / restAvg : 0).toFixed(1)}× your other topics.`,
      href: "/trends",
      cta: "See topics",
    });
  }

  const worst = [...ads].filter((a) => a.action === "Pause").sort((a, b) => b.spend_inr - a.spend_inr)[0];
  if (worst) {
    out.push({
      id: "ad",
      tone: "warn",
      title: `“${worst.label}” is burning budget`,
      body: `${worst.registrations.toLocaleString("en-IN")} registrants, but only ${worst.roas === null ? "no" : formatRoas(worst.roas)} back on ${formatINRCompact(worst.spend_inr)} spent. Consider pausing it.`,
      href: "/attribution",
      cta: "Review ads",
    });
  }

  const bio = organic.find((o) => o.source === "Instagram bio");
  if (bio && paidRevenuePerRegistrant) {
    out.push({
      id: "bio",
      tone: "info",
      title: "Your Instagram bio is small but mighty",
      body: `${bio.registrations} registrants earned ${formatINRCompact(bio.revenue_inr)} at zero ad cost, ${(((bio.revenue_per_registrant ?? 0) / paidRevenuePerRegistrant) || 0).toFixed(1)}× the value of a paid registrant.`,
      href: "/attribution",
      cta: "See sources",
    });
  }
  return out;
}
