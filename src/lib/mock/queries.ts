// The "read" side of the sample backend. Every function is computed from raw records
// through lib/metrics.ts, and returns the shape a read endpoint would return.

import { formatISTPattern, istDateKey, istMonthKey } from "../format";
import {
  allocateAdSpend,
  biggestDrops,
  classifyAd,
  computeAttendance,
  computeRetention,
  computeWebinarMetrics,
  costPerAttendee,
  costPerRegistrant,
  revenuePerRegistrant,
  roas,
  showUpPct,
  watchHistogram,
} from "../metrics";
import { simNow } from "../clock";
import { ADS, COACH, FOLLOWUP_PLAN, MESSAGE_LABELS, ORGANIC_SOURCES, sourceLabel } from "./config";
import { dbVersion, getDb } from "./db";
import type {
  AdSpendRow,
  Attendance,
  AttributionRow,
  Call,
  CallStatus,
  FollowupStatus,
  OrganicSource,
  Registrant,
  RegistrantRow,
  Sale,
  Segment,
  SegmentName,
  TrendDimension,
  TrendRow,
  Webinar,
  WebinarWithMetrics,
} from "../types";

// ------------------------------------------------------------------ memo helpers

const memo = new Map<string, unknown>();
function memoize<T>(key: string, fn: () => T): T {
  const full = `${dbVersion()}:${Math.floor(simNow() / 60000)}:${key}`;
  if (memo.has(full)) return memo.get(full) as T;
  if (memo.size > 300) memo.clear();
  const v = fn();
  memo.set(full, v);
  return v;
}

const real = (w: Webinar) => !w.is_test;

function regsByWebinar(): Map<number, Registrant[]> {
  return memoize("regsByWebinar", () => {
    const m = new Map<number, Registrant[]>();
    for (const r of getDb().registrants) {
      const l = m.get(r.webinar_id);
      if (l) l.push(r);
      else m.set(r.webinar_id, [r]);
    }
    return m;
  });
}

function attendanceFor(webinarId: number): Map<number, Attendance> {
  return memoize(`att:${webinarId}`, () => {
    const d = getDb();
    const w = d.webinars.find((x) => x.id === webinarId);
    if (!w) return new Map();
    return computeAttendance(w, regsByWebinar().get(webinarId) ?? [], d.sessions, simNow());
  });
}

function allAttendance(): Map<number, Attendance> {
  return memoize("allAtt", () => {
    const all = new Map<number, Attendance>();
    for (const w of getDb().webinars) for (const [k, v] of attendanceFor(w.id)) all.set(k, v);
    return all;
  });
}

function spendByWebinar(): Map<number, number> {
  return memoize("spendByWebinar", () => allocateAdSpend(getDb().registrants, getDb().adSpend));
}

function paidSaleByRegistrant(): Map<number, number> {
  return memoize("paidSaleByReg", () => {
    const m = new Map<number, number>();
    for (const s of getDb().sales) {
      if (s.status !== "paid" || s.registrant_id === null) continue;
      m.set(s.registrant_id, (m.get(s.registrant_id) ?? 0) + s.amount_inr);
    }
    return m;
  });
}

function segmentKey(webinarId: number, registrantId: number) {
  return `${webinarId}:${registrantId}`;
}
function segmentMap(): Map<string, Segment> {
  return memoize("segMap", () => {
    const m = new Map<string, Segment>();
    for (const s of getDb().segments) m.set(segmentKey(s.webinar_id, s.registrant_id), s);
    return m;
  });
}

function personAttendedCount(): Map<number, number> {
  return memoize("personAtt", () => {
    const m = new Map<number, number>();
    const att = allAttendance();
    for (const r of getDb().registrants) {
      if (att.get(r.id)?.attended) m.set(r.person_id, (m.get(r.person_id) ?? 0) + 1);
    }
    return m;
  });
}

// ------------------------------------------------------------------ webinars

function metricsFor(w: Webinar) {
  const d = getDb();
  return computeWebinarMetrics({
    webinarId: w.id,
    registrants: regsByWebinar().get(w.id) ?? [],
    attendance: attendanceFor(w.id),
    calls: d.calls,
    sales: d.sales,
    adSpendInr: spendByWebinar().get(w.id) ?? 0,
  });
}

export function listWebinars(): WebinarWithMetrics[] {
  return memoize("list", () =>
    getDb()
      .webinars.filter(real)
      .map((w) => ({ ...w, metrics: metricsFor(w) }))
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
  );
}

export interface SegmentSummary {
  total: number;
  statuses: Partial<Record<FollowupStatus, number>>;
}

export function getWebinarDetail(id: number) {
  const w = getDb().webinars.find((x) => x.id === id);
  if (!w) return null;
  const segments: Record<SegmentName, SegmentSummary> = {
    no_show: { total: 0, statuses: {} },
    early_leaver: { total: 0, statuses: {} },
    stayed_till_offer: { total: 0, statuses: {} },
  };
  for (const s of getDb().segments) {
    if (s.webinar_id !== id) continue;
    const e = segments[s.segment];
    e.total += 1;
    e.statuses[s.followup_status] = (e.statuses[s.followup_status] ?? 0) + 1;
  }
  return { webinar: w, metrics: metricsFor(w), segments };
}

export function getRetention(id: number) {
  const d = getDb();
  const w = d.webinars.find((x) => x.id === id);
  if (!w) return null;
  const points = computeRetention(w, d.sessions, simNow());
  const att = [...attendanceFor(id).values()];
  const peak = points.reduce((m, p) => Math.max(m, p.viewers), 0);
  return {
    webinar_id: id,
    status: w.status,
    pitch_start_minute: w.pitch_start_minute,
    duration_minutes: w.duration_minutes,
    peak,
    points,
    // everyone leaving in the last 10 minutes is normal, so it is not a "drop point"
    drops: biggestDrops(w.status === "closed" ? points.filter((p) => p.minute <= w.duration_minutes - 10) : points),
    histogram: watchHistogram(att, 10, Math.max(60, Math.ceil(w.duration_minutes / 10) * 10)),
  };
}

// ------------------------------------------------------------------ people

function rowFor(r: Registrant): RegistrantRow {
  const d = getDb();
  const w = d.webinars.find((x) => x.id === r.webinar_id)!;
  const a = allAttendance().get(r.id);
  const seg = segmentMap().get(segmentKey(r.webinar_id, r.id));
  const total = personAttendedCount().get(r.person_id) ?? 0;
  const reply = lastReply(r.id);
  return {
    registrant_id: r.id,
    person_id: r.person_id,
    webinar_id: r.webinar_id,
    webinar_title: w.title,
    webinar_slot: w.time_slot,
    webinar_date: w.scheduled_at,
    name: r.name,
    email: r.email,
    phone: r.phone,
    source_label: sourceLabel(r.utm_source, r.ad_id),
    ad_id: r.ad_id,
    attended: a?.attended ?? false,
    watch_minutes: a?.watch_minutes ?? 0,
    segment: seg?.segment ?? null,
    followup_status: seg?.followup_status ?? null,
    followup_step: seg?.followup_step ?? 0,
    prior_webinars_attended: Math.max(0, total - (a?.attended ? 1 : 0)),
    registered_at: r.registered_at,
    last_reply: reply?.text,
  };
}

function lastReply(registrantId: number) {
  const list = getDb().replies.filter((x) => x.registrant_id === registrantId);
  return list.length ? list[list.length - 1] : undefined;
}

export interface RegistrantParams {
  webinar_id?: number;
  segment?: SegmentName;
  followup_status?: FollowupStatus;
  attended?: boolean;
  source?: string; // "paid" | "organic" | a utm_source
  search?: string;
  repeat?: boolean;
  page?: number;
  page_size?: number;
}

export function getRegistrants(p: RegistrantParams) {
  const d = getDb();
  const q = (p.search ?? "").trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const att = allAttendance();
  const segs = segmentMap();
  const realIds = new Set(d.webinars.filter(real).map((w) => w.id));
  const out: Registrant[] = [];
  for (const r of d.registrants) {
    if (!realIds.has(r.webinar_id)) continue;
    if (p.webinar_id && r.webinar_id !== p.webinar_id) continue;
    if (p.attended !== undefined && (att.get(r.id)?.attended ?? false) !== p.attended) continue;
    if (p.segment || p.followup_status) {
      const s = segs.get(segmentKey(r.webinar_id, r.id));
      if (!s) continue;
      if (p.segment && s.segment !== p.segment) continue;
      if (p.followup_status && s.followup_status !== p.followup_status) continue;
    }
    if (p.source) {
      if (p.source === "paid" && !r.ad_id) continue;
      if (p.source === "organic" && r.ad_id) continue;
      if (p.source !== "paid" && p.source !== "organic" && r.utm_source !== p.source) continue;
    }
    if (q) {
      const hit = r.name.toLowerCase().includes(q) || r.email.includes(q) || (digits.length >= 3 && r.phone.includes(digits));
      if (!hit) continue;
    }
    out.push(r);
  }
  out.sort((a, b) => b.registered_at.localeCompare(a.registered_at));
  const pageSize = p.page_size ?? 25;
  const page = p.page ?? 1;
  let rows = out.slice((page - 1) * pageSize, page * pageSize).map(rowFor);
  let total = out.length;
  if (p.repeat) {
    rows = out.map(rowFor).filter((r) => r.prior_webinars_attended > 0);
    total = rows.length;
    rows = rows.slice((page - 1) * pageSize, page * pageSize);
  }
  return { rows, total, page, page_size: pageSize };
}

export function getRegistrantsAll(p: RegistrantParams): RegistrantRow[] {
  return getRegistrants({ ...p, page: 1, page_size: 100000 }).rows;
}

export interface TimelineItem {
  at: string;
  kind: "registered" | "reminder" | "join" | "leave" | "segment" | "followup" | "reply" | "call" | "payment" | "optout";
  title: string;
  detail?: string;
  tone?: "neutral" | "good" | "warn";
}

export function getPerson(registrantId: number) {
  const d = getDb();
  const r = d.registrants.find((x) => x.id === registrantId);
  if (!r) return null;
  const w = d.webinars.find((x) => x.id === r.webinar_id)!;
  const now = simNow();
  const a = allAttendance().get(r.id);
  const seg = segmentMap().get(segmentKey(r.webinar_id, r.id));
  const items: TimelineItem[] = [];
  const startMs = Date.parse(w.scheduled_at);

  items.push({ at: r.registered_at, kind: "registered", title: "Registered", detail: `${sourceLabel(r.utm_source, r.ad_id)} · ${r.source.replace(/_/g, " ")}`, tone: "neutral" });

  for (const [mins, label] of [[1440, "24 hours before"], [60, "1 hour before"], [10, "10 minutes before"]] as const) {
    const at = startMs - mins * 60000;
    if (at > Date.parse(r.registered_at) && at <= now) {
      items.push({ at: new Date(at).toISOString(), kind: "reminder", title: `Reminder sent · ${label}`, detail: r.phone ? "WhatsApp template webinar_reminder" : "Email fallback", tone: "neutral" });
    }
  }

  const mySessions = d.sessions.filter((s) => s.registrant_id === r.id).sort((x, y) => x.join_time.localeCompare(y.join_time));
  for (const s of mySessions) {
    items.push({ at: s.join_time, kind: "join", title: "Joined the room", tone: "good" });
    if (s.leave_time) items.push({ at: s.leave_time, kind: "leave", title: "Left the room", tone: "neutral" });
    else items.push({ at: new Date(now).toISOString(), kind: "leave", title: "Still in the room", detail: "Session is open", tone: "good" });
  }
  if (!mySessions.length && w.status === "closed") {
    items.push({ at: new Date(startMs + w.duration_minutes * 60000).toISOString(), kind: "leave", title: "Never joined", detail: "No attendance recorded", tone: "warn" });
  }

  if (seg) {
    const closeMs = w.closed_at ? Date.parse(w.closed_at) : startMs + w.duration_minutes * 60000;
    items.push({ at: new Date(closeMs).toISOString(), kind: "segment", title: `Segmented · ${seg.segment.replace(/_/g, " ")}`, detail: seg.segment === "stayed_till_offer" ? "Still watching at the pitch" : seg.segment === "early_leaver" ? "Left before the pitch" : "Registered but did not attend" });
    const plan = FOLLOWUP_PLAN[seg.segment];
    plan.slice(0, seg.followup_step).forEach((p) => {
      items.push({ at: new Date(closeMs + p.delay_min * 60000).toISOString(), kind: "followup", title: `Follow-up ${p.step} sent · ${MESSAGE_LABELS[p.msg] ?? p.msg}`, detail: r.phone ? "WhatsApp" : "Email", tone: "neutral" });
    });
  }

  for (const rp of d.replies.filter((x) => x.registrant_id === r.id)) {
    items.push({ at: rp.at, kind: "reply", title: "Replied", detail: `“${rp.text}” · classified ${rp.intent}`, tone: rp.intent === "interested" ? "good" : "neutral" });
  }
  const myCalls = d.calls.filter((c) => c.registrant_id === r.id);
  for (const c of myCalls) {
    items.push({
      at: c.booked_at,
      kind: "call",
      title: c.status === "canceled" ? "Call canceled" : c.status === "completed" ? "Call completed" : "Call booked",
      detail: c.scheduled_for ? `For ${formatISTPattern(c.scheduled_for, "EEE d MMM, h:mm a")} IST via ${c.source.replace("_", ".")}` : c.source,
      tone: c.status === "canceled" ? "warn" : "good",
    });
  }
  const mySales = d.sales.filter((s) => s.registrant_id === r.id);
  for (const s of mySales) {
    items.push({
      at: s.paid_at,
      kind: "payment",
      title: s.status === "paid" ? `Paid ₹${s.amount_inr.toLocaleString("en-IN")} · ${s.tier}` : `Payment ${s.status}`,
      detail: `${s.provider}${s.note ? ` · ${s.note}` : ""}`,
      tone: s.status === "paid" ? "good" : "warn",
    });
  }
  if (r.opted_out) items.push({ at: new Date(startMs + w.duration_minutes * 60000 + 3600000).toISOString(), kind: "optout", title: "Opted out", detail: "All messages stopped", tone: "warn" });

  items.sort((x, y) => x.at.localeCompare(y.at));

  const others = d.registrants
    .filter((x) => x.person_id === r.person_id && x.id !== r.id)
    .map((x) => {
      const ww = d.webinars.find((y) => y.id === x.webinar_id)!;
      return { registrant_id: x.id, webinar_title: ww.title, scheduled_at: ww.scheduled_at, attended: allAttendance().get(x.id)?.attended ?? false };
    })
    .sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));

  return {
    registrant: r,
    webinar: w,
    attendance: a ?? null,
    segment: seg ?? null,
    row: rowFor(r),
    timeline: items,
    other_registrations: others,
    total_paid: mySales.filter((s) => s.status === "paid").reduce((t, s) => t + s.amount_inr, 0),
  };
}

// ------------------------------------------------------------------ segments

export function getSegments(webinarId: number) {
  const d = getDb();
  const w = d.webinars.find((x) => x.id === webinarId);
  if (!w) return null;
  const segs = d.segments.filter((s) => s.webinar_id === webinarId);
  const statuses: FollowupStatus[] = ["pending", "sequence_running", "replied", "booked", "purchased", "completed", "opted_out"];
  const names: SegmentName[] = ["no_show", "early_leaver", "stayed_till_offer"];
  const closeMs = w.closed_at ? Date.parse(w.closed_at) : null;
  const matrix = names.map((name) => {
    const mine = segs.filter((s) => s.segment === name);
    const counts = Object.fromEntries(statuses.map((s) => [s, 0])) as Record<FollowupStatus, number>;
    for (const s of mine) counts[s.followup_status] += 1;
    return { segment: name, total: mine.length, statuses: counts };
  });
  const plan = names.map((name) => {
    const mine = segs.filter((s) => s.segment === name && !["purchased", "booked", "opted_out"].includes(s.followup_status));
    return {
      segment: name,
      steps: FOLLOWUP_PLAN[name].map((p) => {
        const dueMs = closeMs !== null ? closeMs + p.delay_min * 60000 : null;
        return {
          step: p.step,
          msg: p.msg,
          label: MESSAGE_LABELS[p.msg] ?? p.msg,
          delay_min: p.delay_min,
          due_at: dueMs !== null ? new Date(dueMs).toISOString() : null,
          reached: mine.filter((s) => s.followup_step >= p.step).length,
          waiting: mine.length,
        };
      }),
    };
  });
  const needsHuman = segs
    .filter((s) => s.followup_status === "replied")
    .map((s) => {
      const r = d.registrants.find((x) => x.id === s.registrant_id)!;
      const rp = lastReply(r.id);
      return { ...rowFor(r), reply_at: rp?.at ?? null, reply_intent: rp?.intent ?? null };
    })
    .sort((a, b) => (b.reply_at ?? "").localeCompare(a.reply_at ?? ""));
  return { webinar: w, matrix, plan, needs_human: needsHuman, closed: w.status === "closed" };
}

// ------------------------------------------------------------------ trends

interface WebinarRollup {
  w: Webinar;
  m: ReturnType<typeof metricsFor>;
}

function closedRollups(): WebinarRollup[] {
  return memoize("closedRollups", () =>
    getDb()
      .webinars.filter((w) => real(w) && w.status === "closed")
      .map((w) => ({ w, m: metricsFor(w) })),
  );
}

function avg(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
}

/** Spend of closed webinars per ad (ad-day spend shared across webinars by that day's registrants). */
function closedAdSpend(): { byAd: Map<string, { spend: number; impressions: number; clicks: number }>; pending: number } {
  return memoize("closedAdSpend", () => {
    const d = getDb();
    const closedIds = new Set(d.webinars.filter((w) => real(w) && w.status === "closed").map((w) => w.id));
    const regCount = new Map<string, Map<number, number>>();
    for (const r of d.registrants) {
      if (!r.ad_id) continue;
      const key = `${r.ad_id}|${istDateKey(r.registered_at)}`;
      let m = regCount.get(key);
      if (!m) regCount.set(key, (m = new Map()));
      m.set(r.webinar_id, (m.get(r.webinar_id) ?? 0) + 1);
    }
    const byAd = new Map<string, { spend: number; impressions: number; clicks: number }>();
    let pending = 0;
    for (const sp of d.adSpend as AdSpendRow[]) {
      const m = regCount.get(`${sp.ad_id}|${sp.date}`);
      if (!m) continue;
      let total = 0;
      for (const n of m.values()) total += n;
      let share = 0;
      for (const [wid, n] of m) if (closedIds.has(wid)) share += n / total;
      pending += sp.spend_inr * (1 - share);
      if (share === 0) continue;
      const e = byAd.get(sp.ad_id) ?? { spend: 0, impressions: 0, clicks: 0 };
      e.spend += sp.spend_inr * share;
      e.impressions += sp.impressions * share;
      e.clicks += sp.clicks * share;
      byAd.set(sp.ad_id, e);
    }
    return { byAd, pending: Math.round(pending) };
  });
}

interface IdStats {
  registrations: number;
  attendees: number;
  stayed: number;
  sales: number;
  revenue: number;
  webinars: Set<number>;
}

function statsById(key: "ad_id" | "adset_id" | "campaign_id"): Map<string, IdStats> {
  return memoize(`statsBy:${key}`, () => {
    const d = getDb();
    const closed = new Set(d.webinars.filter((w) => real(w) && w.status === "closed").map((w) => w.id));
    const att = allAttendance();
    const paid = new Map<number, { n: number; amount: number }>();
    for (const s of d.sales) {
      if (s.status !== "paid" || s.registrant_id === null) continue;
      const e = paid.get(s.registrant_id) ?? { n: 0, amount: 0 };
      e.n += 1;
      e.amount += s.amount_inr;
      paid.set(s.registrant_id, e);
    }
    const m = new Map<string, IdStats>();
    for (const r of d.registrants) {
      const id = r[key];
      if (!id || !closed.has(r.webinar_id)) continue;
      const e = m.get(id) ?? { registrations: 0, attendees: 0, stayed: 0, sales: 0, revenue: 0, webinars: new Set<number>() };
      e.registrations += 1;
      const a = att.get(r.id);
      if (a?.attended) e.attendees += 1;
      if (a?.stayed_till_pitch) e.stayed += 1;
      const p = paid.get(r.id);
      if (p) {
        e.sales += p.n;
        e.revenue += p.amount;
      }
      e.webinars.add(r.webinar_id);
      m.set(id, e);
    }
    return m;
  });
}

function adLabel(level: "campaign" | "adset" | "ad", id: string): { label: string; parent: string | null } {
  const a = level === "ad" ? ADS.find((x) => x.ad_id === id) : level === "adset" ? ADS.find((x) => x.adset_id === id) : ADS.find((x) => x.campaign_id === id);
  if (!a) return { label: id, parent: null };
  if (level === "ad") return { label: a.name, parent: a.adset_name };
  if (level === "adset") return { label: a.adset_name, parent: a.campaign_name };
  return { label: a.campaign_name, parent: null };
}

function spendFor(level: "campaign" | "adset" | "ad", id: string) {
  const { byAd } = closedAdSpend();
  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  for (const ad of ADS) {
    const match = level === "ad" ? ad.ad_id === id : level === "adset" ? ad.adset_id === id : ad.campaign_id === id;
    if (!match) continue;
    const e = byAd.get(ad.ad_id);
    if (e) {
      spend += e.spend;
      impressions += e.impressions;
      clicks += e.clicks;
    }
  }
  return { spend: Math.round(spend), impressions: Math.round(impressions), clicks: Math.round(clicks) };
}

/** Registrations per IST day for the last `days` days, for the pace mini-chart. */
export function getRegistrationPace(webinarId: number, days = 10) {
  const now = simNow();
  const counts = new Map<string, number>();
  for (const r of regsByWebinar().get(webinarId) ?? []) {
    const k = istDateKey(r.registered_at);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const out: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = istDateKey(new Date(now - i * 86400000).toISOString());
    out.push({ date: k, count: counts.get(k) ?? 0 });
  }
  return out;
}

export function getTrends() {
  return memoize("trends", () => {
    const rollups = closedRollups();
    const dims: Record<TrendDimension, TrendRow[]> = { topic: [], time_slot: [], campaign: [], adset: [], ad: [] };

    for (const dim of ["topic", "time_slot"] as const) {
      const groups = new Map<string, WebinarRollup[]>();
      for (const ru of rollups) {
        const k = dim === "topic" ? ru.w.topic : ru.w.time_slot;
        const l = groups.get(k);
        if (l) l.push(ru);
        else groups.set(k, [ru]);
      }
      for (const [k, list] of groups) {
        const revenue = list.reduce((s, x) => s + x.m.revenue_inr, 0);
        const spend = list.reduce((s, x) => s + x.m.ad_spend_inr, 0);
        const regs = list.reduce((s, x) => s + x.m.registrations, 0);
        dims[dim].push({
          dimension_value: k,
          label: k,
          webinars_count: list.length,
          avg_show_up_pct: avg(list.map((x) => x.m.show_up_pct)),
          avg_stayed_till_pitch_pct: avg(list.map((x) => x.m.stayed_till_pitch_pct)),
          sales: list.reduce((s, x) => s + x.m.sales_count, 0),
          revenue_inr: revenue,
          spend_inr: Math.round(spend),
          roas: roas(revenue, spend),
          revenue_per_registrant: revenuePerRegistrant(revenue, regs),
        });
      }
    }
    for (const [dim, key] of [["campaign", "campaign_id"], ["adset", "adset_id"], ["ad", "ad_id"]] as const) {
      for (const [id, st] of statsById(key)) {
        const { spend } = spendFor(dim, id);
        dims[dim].push({
          dimension_value: id,
          label: adLabel(dim, id).label,
          webinars_count: st.webinars.size,
          avg_show_up_pct: showUpPct(st.attendees, st.registrations),
          avg_stayed_till_pitch_pct: st.attendees ? Math.round((10000 * st.stayed) / st.attendees) / 100 : null,
          sales: st.sales,
          revenue_inr: st.revenue,
          spend_inr: spend,
          roas: roas(st.revenue, spend),
          revenue_per_registrant: revenuePerRegistrant(st.revenue, st.registrations),
        });
      }
    }

    // day × time heatmap from the time_slot rows ("Sat-19:00")
    const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const cells = dims.time_slot.map((t) => {
      const [day, time] = t.dimension_value.split("-");
      return { day, time, show_up: t.avg_show_up_pct, webinars: t.webinars_count };
    });
    const times = [...new Set(cells.map((c) => c.time))].sort();
    return { dims, heatmap: { days: dayOrder, times, cells } };
  });
}

// ------------------------------------------------------------------ attribution

export function getAttribution(level: "campaign" | "adset" | "ad") {
  return memoize(`attr:${level}`, () => {
    const key = level === "ad" ? "ad_id" : level === "adset" ? "adset_id" : "campaign_id";
    const stats = statsById(key);
    const rows: AttributionRow[] = [];
    for (const [id, st] of stats) {
      const { spend, impressions, clicks } = spendFor(level, id);
      const rs = roas(st.revenue, spend);
      const cls = classifyAd({ spend, registrations: st.registrations, roasValue: rs });
      const lab = adLabel(level, id);
      rows.push({
        id,
        label: lab.label,
        parent: lab.parent,
        spend_inr: spend,
        impressions,
        clicks,
        registrations: st.registrations,
        attendees: st.attendees,
        sales: st.sales,
        revenue_inr: st.revenue,
        roas: rs,
        cost_per_registrant: costPerRegistrant(spend, st.registrations),
        cost_per_attendee: costPerAttendee(spend, st.attendees),
        action: cls.action,
        reason: cls.reason,
      });
    }
    rows.sort((a, b) => b.revenue_inr - a.revenue_inr);

    // organic vs paid, from closed webinars' registrants
    const d = getDb();
    const closed = new Set(d.webinars.filter((w) => real(w) && w.status === "closed").map((w) => w.id));
    const att = allAttendance();
    const sales = paidSaleByRegistrant();
    const saleCount = new Map<number, number>();
    for (const s of d.sales) if (s.status === "paid" && s.registrant_id !== null) saleCount.set(s.registrant_id, (saleCount.get(s.registrant_id) ?? 0) + 1);
    const organic = new Map<string, OrganicSource>();
    const split = {
      paid: { registrations: 0, attendees: 0, sales: 0, revenue_inr: 0 },
      organic: { registrations: 0, attendees: 0, sales: 0, revenue_inr: 0 },
    };
    for (const r of d.registrants) {
      if (!closed.has(r.webinar_id)) continue;
      const bucket = r.ad_id ? split.paid : split.organic;
      bucket.registrations += 1;
      const a = att.get(r.id);
      if (a?.attended) bucket.attendees += 1;
      bucket.sales += saleCount.get(r.id) ?? 0;
      bucket.revenue_inr += sales.get(r.id) ?? 0;
      if (!r.ad_id) {
        const k = r.utm_source ?? "direct";
        const e = organic.get(k) ?? { source: k, registrations: 0, attendees: 0, sales: 0, revenue_inr: 0, revenue_per_registrant: null };
        e.registrations += 1;
        if (a?.attended) e.attendees += 1;
        e.sales += saleCount.get(r.id) ?? 0;
        e.revenue_inr += sales.get(r.id) ?? 0;
        organic.set(k, e);
      }
    }
    const organicRows = [...organic.values()]
      .map((o) => ({ ...o, source: ORGANIC_SOURCES.find((x) => x.source === o.source)?.label ?? o.source, revenue_per_registrant: revenuePerRegistrant(o.revenue_inr, o.registrations) }))
      .sort((a, b) => b.revenue_inr - a.revenue_inr);
    const totalSpend = rows.length ? [...closedAdSpend().byAd.values()].reduce((s, x) => s + x.spend, 0) : 0;
    return {
      level,
      rows,
      organic: organicRows,
      split: { ...split, paid_spend_inr: Math.round(totalSpend) },
      pending_spend_inr: closedAdSpend().pending,
    };
  });
}

// ------------------------------------------------------------------ sales & calls

export function getSales(p: { webinar_id?: number; provider?: string; status?: string; page?: number; page_size?: number }) {
  const d = getDb();
  const page = p.page ?? 1;
  const pageSize = p.page_size ?? 15;
  const realIds = new Set(d.webinars.filter(real).map((w) => w.id));
  const filtered = d.sales
    .filter((s) => realIds.has(s.webinar_id))
    .filter((s) => !p.webinar_id || s.webinar_id === p.webinar_id)
    .filter((s) => !p.provider || s.provider === p.provider)
    .filter((s) => !p.status || s.status === p.status)
    .sort((a, b) => b.paid_at.localeCompare(a.paid_at));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize).map((s) => saleRow(s));
  const paid = filtered.filter((s) => s.status === "paid");

  const byMonth = new Map<string, { revenue: number; sales: number }>();
  for (const s of d.sales) {
    if (s.status !== "paid" || !realIds.has(s.webinar_id)) continue;
    if (p.webinar_id && s.webinar_id !== p.webinar_id) continue;
    const k = istMonthKey(s.paid_at);
    const e = byMonth.get(k) ?? { revenue: 0, sales: 0 };
    e.revenue += s.amount_inr;
    e.sales += 1;
    byMonth.set(k, e);
  }
  const months = ["2026-08", "2026-09", "2026-10", "2026-11"].map((k) => ({
    month: k,
    label: formatISTPattern(`${k}-15T06:00:00Z`, "MMM yyyy"),
    revenue_inr: byMonth.get(k)?.revenue ?? 0,
    sales: byMonth.get(k)?.sales ?? 0,
  }));
  return {
    rows,
    total: filtered.length,
    page,
    page_size: pageSize,
    totals: { paid_count: paid.length, revenue_inr: paid.reduce((t, s) => t + s.amount_inr, 0), refunded: filtered.filter((s) => s.status === "refunded").length },
    months,
  };
}

function saleRow(s: Sale) {
  const d = getDb();
  const r = d.registrants.find((x) => x.id === s.registrant_id);
  const w = d.webinars.find((x) => x.id === s.webinar_id);
  return { ...s, name: r?.name ?? "Unmatched payer", email: r?.email ?? "", webinar_title: w?.title ?? "" };
}

export function getCalls(p: { webinar_id?: number; status?: CallStatus; page?: number; page_size?: number }) {
  const d = getDb();
  const page = p.page ?? 1;
  const pageSize = p.page_size ?? 15;
  const realIds = new Set(d.webinars.filter(real).map((w) => w.id));
  const filtered = d.calls
    .filter((c) => realIds.has(c.webinar_id))
    .filter((c) => !p.webinar_id || c.webinar_id === p.webinar_id)
    .filter((c) => !p.status || c.status === p.status)
    .sort((a, b) => b.booked_at.localeCompare(a.booked_at));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize).map((c: Call) => {
    const r = d.registrants.find((x) => x.id === c.registrant_id);
    const w = d.webinars.find((x) => x.id === c.webinar_id);
    const seg = r ? segmentMap().get(segmentKey(r.webinar_id, r.id)) : undefined;
    return { ...c, name: r?.name ?? "", email: r?.email ?? "", phone: r?.phone ?? "", webinar_title: w?.title ?? "", followup_status: seg?.followup_status ?? null };
  });
  const counts = { booked: 0, completed: 0, canceled: 0 };
  for (const c of filtered) counts[c.status] += 1;
  return { rows, total: filtered.length, page, page_size: pageSize, counts };
}

// ------------------------------------------------------------------ logs, public, search

export function getLogs(type: "event" | "error", page = 1, pageSize = 20) {
  const d = getDb();
  if (type === "event") {
    const sorted = [...d.events].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { type, rows: sorted.slice((page - 1) * pageSize, page * pageSize), total: sorted.length, page, page_size: pageSize };
  }
  const sorted = [...d.errors].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { type, rows: sorted.slice((page - 1) * pageSize, page * pageSize), total: sorted.length, page, page_size: pageSize };
}

export function getPublicWebinar(id: number) {
  const w = getDb().webinars.find((x) => x.id === id && !x.is_test);
  if (!w) return null;
  return {
    id: w.id,
    title: w.title,
    topic: w.topic,
    scheduled_at: w.scheduled_at,
    duration_minutes: w.duration_minutes,
    time_slot: w.time_slot,
    status: w.status,
    coach: COACH,
    join_url: w.join_url,
  };
}

export function searchAll(q: string) {
  const d = getDb();
  const s = q.trim().toLowerCase();
  const webinars = d.webinars
    .filter(real)
    .filter((w) => !s || w.title.toLowerCase().includes(s) || w.topic.toLowerCase().includes(s) || w.time_slot.toLowerCase().includes(s))
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
    .slice(0, 5)
    .map((w) => ({ id: w.id, title: w.title, status: w.status, scheduled_at: w.scheduled_at }));
  const ads = ADS.filter((a) => !s || a.name.toLowerCase().includes(s) || a.adset_name.toLowerCase().includes(s) || a.campaign_name.toLowerCase().includes(s))
    .slice(0, 5)
    .map((a) => ({ ad_id: a.ad_id, name: a.name, adset_name: a.adset_name }));
  let people: { registrant_id: number; name: string; email: string; webinar_title: string }[] = [];
  if (s.length >= 2) {
    const seen = new Set<number>();
    const digits = s.replace(/\D/g, "");
    for (let i = d.registrants.length - 1; i >= 0 && people.length < 6; i--) {
      const r = d.registrants[i];
      if (seen.has(r.person_id)) continue;
      if (r.name.toLowerCase().includes(s) || r.email.includes(s) || (digits.length >= 4 && r.phone.includes(digits))) {
        seen.add(r.person_id);
        const w = d.webinars.find((x) => x.id === r.webinar_id);
        people.push({ registrant_id: r.id, name: r.name, email: r.email, webinar_title: w?.title ?? "" });
      }
    }
  } else {
    people = [];
  }
  return { webinars, ads, people };
}
