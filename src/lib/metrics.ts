// Shared metrics module. Every number in the UI is computed here from raw records,
// using the same formulas as the workflow's SQL views (v_webinar_funnel, v_webinar_ad_spend,
// v_webinar_metrics_calc, recompute_attendance). Paid sales only (status = 'paid').

import type {
  AdAction,
  AdSpendRow,
  Attendance,
  AttendanceSession,
  Call,
  Registrant,
  Sale,
  Webinar,
  WebinarMetrics,
} from "./types";
import { formatRoas, istDateKey } from "./format";

const r2 = (n: number) => Math.round(n * 100) / 100;

// ---- Ratio formulas (null when the denominator is zero, like NULLIF in SQL) ----

/** show_up = attendees / registrations (as %) */
export function showUpPct(attendees: number, registrations: number): number | null {
  return registrations > 0 ? r2((100 * attendees) / registrations) : null;
}

/** stayed_till_pitch = stayed / attendees (as %) */
export function stayedTillPitchPct(stayed: number, attendees: number): number | null {
  return attendees > 0 ? r2((100 * stayed) / attendees) : null;
}

/** revenue_per_registrant = revenue / registrations */
export function revenuePerRegistrant(revenue: number, registrations: number): number | null {
  return registrations > 0 ? r2(revenue / registrations) : null;
}

/** roas = revenue / spend */
export function roas(revenue: number, spend: number): number | null {
  return spend > 0 ? r2(revenue / spend) : null;
}

/** cost per registrant = spend / registrations */
export function costPerRegistrant(spend: number, registrations: number): number | null {
  return registrations > 0 ? r2(spend / registrations) : null;
}

/** cost per attendee = spend / attendees */
export function costPerAttendee(spend: number, attendees: number): number | null {
  return attendees > 0 ? r2(spend / attendees) : null;
}

// ---- Attendance (port of recompute_attendance) ----

export function computeAttendance(
  webinar: Webinar,
  registrants: Registrant[],
  sessions: AttendanceSession[],
  nowMs: number,
): Map<number, Attendance> {
  const start = new Date(webinar.scheduled_at).getTime();
  const end = start + webinar.duration_minutes * 60000;
  const pitch = start + webinar.pitch_start_minute * 60000;
  const vNow = Math.min(nowMs, end);

  const byReg = new Map<number, AttendanceSession[]>();
  for (const s of sessions) {
    if (s.webinar_id !== webinar.id) continue;
    const list = byReg.get(s.registrant_id);
    if (list) list.push(s);
    else byReg.set(s.registrant_id, [s]);
  }

  const out = new Map<number, Attendance>();
  for (const r of registrants) {
    if (r.webinar_id !== webinar.id) continue;
    const list = byReg.get(r.id);
    if (!list || list.length === 0) {
      out.set(r.id, {
        registrant_id: r.id,
        webinar_id: webinar.id,
        attended: false,
        join_time: null,
        leave_time: null,
        watch_minutes: 0,
        sessions_count: 0,
        stayed_till_pitch: false,
      });
      continue;
    }
    let minJoin = Infinity;
    let maxLeave = -Infinity;
    let anyOpen = false;
    let watch = 0;
    let stayed = false;
    for (const s of list) {
      const j = new Date(s.join_time).getTime();
      const l = s.leave_time ? new Date(s.leave_time).getTime() : null;
      minJoin = Math.min(minJoin, j);
      if (l === null) anyOpen = true;
      else maxLeave = Math.max(maxLeave, l);
      const effLeave = l ?? Math.max(j, vNow);
      watch += Math.max(0, (effLeave - j) / 60000);
      if (effLeave >= pitch) stayed = true;
    }
    out.set(r.id, {
      registrant_id: r.id,
      webinar_id: webinar.id,
      attended: true,
      join_time: new Date(minJoin).toISOString(),
      leave_time: anyOpen ? null : new Date(maxLeave).toISOString(),
      watch_minutes: r2(watch),
      sessions_count: list.length,
      stayed_till_pitch: stayed,
    });
  }
  return out;
}

// ---- Ad spend allocation (port of v_webinar_ad_spend) ----
// Spend of an ad on a day is shared across webinars in proportion to that day's registrants.

export function allocateAdSpend(registrants: Registrant[], adSpend: AdSpendRow[]): Map<number, number> {
  const regCount = new Map<string, Map<number, number>>(); // "ad|date" -> webinar -> n
  for (const r of registrants) {
    if (!r.ad_id) continue;
    const key = `${r.ad_id}|${istDateKey(r.registered_at)}`;
    let m = regCount.get(key);
    if (!m) {
      m = new Map();
      regCount.set(key, m);
    }
    m.set(r.webinar_id, (m.get(r.webinar_id) ?? 0) + 1);
  }
  const out = new Map<number, number>();
  for (const sp of adSpend) {
    const m = regCount.get(`${sp.ad_id}|${sp.date}`);
    if (!m) continue;
    let total = 0;
    for (const n of m.values()) total += n;
    for (const [wid, n] of m) {
      out.set(wid, (out.get(wid) ?? 0) + (sp.spend_inr * n) / total);
    }
  }
  for (const [k, v] of out) out.set(k, r2(v));
  return out;
}

// ---- Webinar metrics (port of v_webinar_metrics_calc) ----

export function computeWebinarMetrics(args: {
  webinarId: number;
  registrants: Registrant[];
  attendance: Map<number, Attendance>;
  calls: Call[];
  sales: Sale[];
  adSpendInr: number;
}): WebinarMetrics {
  const { webinarId, registrants, attendance, calls, sales, adSpendInr } = args;
  const regs = registrants.filter((r) => r.webinar_id === webinarId);
  let attendees = 0;
  let stayed = 0;
  let watchTotal = 0;
  for (const r of regs) {
    const a = attendance.get(r.id);
    if (a?.attended) {
      attendees += 1;
      watchTotal += a.watch_minutes;
      if (a.stayed_till_pitch) stayed += 1;
    }
  }
  const callers = new Set(
    calls.filter((c) => c.webinar_id === webinarId && c.status !== "canceled").map((c) => c.registrant_id),
  );
  const paid = sales.filter((s) => s.webinar_id === webinarId && s.status === "paid");
  const revenue = paid.reduce((sum, s) => sum + s.amount_inr, 0);
  return {
    registrations: regs.length,
    attendees,
    show_up_pct: showUpPct(attendees, regs.length),
    avg_watch_minutes: attendees > 0 ? r2(watchTotal / attendees) : 0,
    stayed_till_pitch: stayed,
    stayed_till_pitch_pct: stayedTillPitchPct(stayed, attendees),
    calls_booked: callers.size,
    sales_count: paid.length,
    revenue_inr: revenue,
    ad_spend_inr: adSpendInr,
    revenue_per_registrant: revenuePerRegistrant(revenue, regs.length),
    roas: roas(revenue, adSpendInr),
    cost_per_registrant: costPerRegistrant(adSpendInr, regs.length),
    cost_per_attendee: costPerAttendee(adSpendInr, attendees),
  };
}

// ---- Ad action rules (shown verbatim in the UI tooltip) ----

export const AD_RULES = {
  minSpend: 3000,
  minRegistrations: 20,
  scaleRoas: 5,
  keepRoas: 2.5,
  breakEven: 1,
} as const;

export const AD_RULE_LINES: { action: AdAction; rule: string }[] = [
  { action: "Scale", rule: `ROAS ≥ ${AD_RULES.scaleRoas}× with enough data` },
  { action: "Keep", rule: `ROAS ${AD_RULES.keepRoas}× to ${AD_RULES.scaleRoas}×` },
  { action: "Watch", rule: `ROAS ${AD_RULES.breakEven}× to ${AD_RULES.keepRoas}×, or less than ₹${AD_RULES.minSpend.toLocaleString("en-IN")} spent / ${AD_RULES.minRegistrations} registrants` },
  { action: "Pause", rule: `ROAS below ${AD_RULES.breakEven}× with enough data` },
];

export function classifyAd(args: { spend: number; registrations: number; roasValue: number | null }): {
  action: AdAction;
  reason: string;
} {
  const { spend, registrations, roasValue } = args;
  if (spend < AD_RULES.minSpend || registrations < AD_RULES.minRegistrations) {
    return {
      action: "Watch",
      reason: `Not enough data yet: ₹${Math.round(spend).toLocaleString("en-IN")} spent, ${registrations} registrants.`,
    };
  }
  const x = roasValue ?? 0;
  if (x >= AD_RULES.scaleRoas) return { action: "Scale", reason: `ROAS ${formatRoas(x)} is at or above ${AD_RULES.scaleRoas}×.` };
  if (x >= AD_RULES.keepRoas) return { action: "Keep", reason: `ROAS ${formatRoas(x)} is between ${AD_RULES.keepRoas}× and ${AD_RULES.scaleRoas}×.` };
  if (x >= AD_RULES.breakEven) return { action: "Watch", reason: `ROAS ${formatRoas(x)} is only just above break-even.` };
  return { action: "Pause", reason: `ROAS ${formatRoas(x)} is below break-even after ₹${Math.round(spend).toLocaleString("en-IN")} spent.` };
}

// ---- Retention (minute-by-minute live viewers, like the /retention endpoint) ----

export interface RetentionPoint {
  minute: number;
  viewers: number;
}

export function computeRetention(
  webinar: Webinar,
  sessions: AttendanceSession[],
  nowMs: number,
): RetentionPoint[] {
  const start = new Date(webinar.scheduled_at).getTime();
  const end = start + webinar.duration_minutes * 60000;
  const vNow = Math.min(nowMs, end);
  const elapsedMin = Math.max(0, Math.floor((vNow - start) / 60000));
  const lastMinute = webinar.status === "closed" ? webinar.duration_minutes : Math.min(webinar.duration_minutes, elapsedMin);
  const diff = new Array<number>(webinar.duration_minutes + 2).fill(0);
  for (const s of sessions) {
    if (s.webinar_id !== webinar.id) continue;
    const j = Math.max(0, Math.floor((new Date(s.join_time).getTime() - start) / 60000));
    const lRaw = s.leave_time ? new Date(s.leave_time).getTime() : vNow;
    const l = Math.min(webinar.duration_minutes + 1, Math.floor((lRaw - start) / 60000));
    if (l < j) continue;
    diff[j] += 1;
    diff[l + 1] -= 1;
  }
  const out: RetentionPoint[] = [];
  let cur = 0;
  for (let m = 0; m <= lastMinute; m++) {
    cur += diff[m];
    out.push({ minute: m, viewers: cur });
  }
  return out;
}

/** The biggest viewer losses over rolling windows, spaced so they do not overlap. */
export function biggestDrops(points: RetentionPoint[], count = 3, window = 4): { minute: number; lost: number; pct: number }[] {
  if (points.length < window + 2) return [];
  const peak = Math.max(...points.map((p) => p.viewers), 1);
  const cand: { minute: number; lost: number; pct: number }[] = [];
  for (let i = 2; i + window < points.length; i++) {
    const before = (points[i].viewers + points[i - 1].viewers + points[i - 2].viewers) / 3;
    const after = (points[i + window].viewers + points[i + window - 1].viewers) / 2;
    const lost = before - after;
    if (lost > 0) cand.push({ minute: points[i].minute + Math.round(window / 2), lost: Math.round(lost), pct: Math.round((100 * lost) / peak) });
  }
  cand.sort((a, b) => b.lost - a.lost);
  const picked: typeof cand = [];
  for (const c of cand) {
    if (picked.every((p) => Math.abs(p.minute - c.minute) >= 8)) picked.push(c);
    if (picked.length === count) break;
  }
  return picked.sort((a, b) => a.minute - b.minute);
}

export function watchHistogram(
  attendance: Attendance[],
  bin = 10,
  maxMinutes = 100,
): { from: number; to: number; label: string; count: number }[] {
  const bins = Math.ceil(maxMinutes / bin);
  const out = Array.from({ length: bins }, (_, i) => ({
    from: i * bin,
    to: (i + 1) * bin,
    label: i === bins - 1 ? `${i * bin}+` : `${i * bin}–${(i + 1) * bin}`,
    count: 0,
  }));
  for (const a of attendance) {
    if (!a.attended) continue;
    const idx = Math.min(bins - 1, Math.floor(a.watch_minutes / bin));
    out[idx].count += 1;
  }
  return out;
}
