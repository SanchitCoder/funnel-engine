// Deterministic sample data for "Ankit Verma – Scale Your Coaching Business".
// Raw records only; every metric in the UI is computed from these by lib/metrics.ts.

import type {
  AdSpendRow,
  AttendanceSession,
  Call,
  ErrorLogRow,
  EventLogRow,
  FollowupStatus,
  Registrant,
  ReplyRow,
  Sale,
  Segment,
  SegmentName,
  Webinar,
} from "../types";
import { deriveTimeSlot, istDateKey } from "../format";
import { computeAttendance } from "../metrics";
import {
  ADS,
  COACH,
  ERROR_SAMPLES,
  FIRST_NAMES,
  FOLLOWUP_PLAN,
  LAST_NAMES,
  OFFER,
  ORGANIC_SOURCES,
  REPLY_TEXTS,
} from "./config";

import { SIM_START_MS } from "../clock";

export { SIM_START_MS };

export interface Dataset {
  webinars: Webinar[];
  registrants: Registrant[];
  sessions: AttendanceSession[];
  segments: Segment[];
  calls: Call[];
  sales: Sale[];
  adSpend: AdSpendRow[];
  events: EventLogRow[];
  errors: ErrorLogRow[];
  replies: ReplyRow[];
  counters: { webinar: number; registrant: number; session: number; call: number; sale: number; event: number; person: number };
}

class Rng {
  private a: number;
  constructor(seed: number) {
    this.a = seed >>> 0;
  }
  next(): number {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  between(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.between(a, b + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  weighted(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }
}

interface Spec {
  title: string;
  topic: string;
  iso: string;
  pitch: number;
  dur: number;
  regs: number;
  status: "closed" | "live" | "scheduled";
  closeAfterMin?: number;
}

const SPECS: Spec[] = [
  { title: "First 10 High-Ticket Clients — Live Masterclass", topic: "First 10 High-Ticket Clients", iso: "2026-08-22T13:30:00Z", pitch: 60, dur: 90, regs: 312, status: "closed" },
  { title: "LinkedIn Lead Gen for Coaches — Live Workshop", topic: "LinkedIn Lead Gen for Coaches", iso: "2026-09-02T14:30:00Z", pitch: 65, dur: 95, regs: 248, status: "closed" },
  { title: "Instagram Content That Sells — Live Session", topic: "Instagram Content That Sells", iso: "2026-09-13T05:30:00Z", pitch: 55, dur: 85, regs: 186, status: "closed" },
  { title: "Pricing Your Coaching Offer — Live Workshop", topic: "Pricing Your Coaching Offer", iso: "2026-09-19T13:30:00Z", pitch: 60, dur: 90, regs: 402, status: "closed" },
  { title: "Webinar to ₹10L Funnel — Live Masterclass", topic: "Webinar to ₹10L Funnel", iso: "2026-10-01T07:30:00Z", pitch: 70, dur: 100, regs: 163, status: "closed" },
  { title: "First 10 High-Ticket Clients — Round 2", topic: "First 10 High-Ticket Clients", iso: "2026-10-10T13:30:00Z", pitch: 60, dur: 90, regs: 358, status: "closed" },
  { title: "Pricing Your Coaching Offer — Round 2", topic: "Pricing Your Coaching Offer", iso: "2026-10-28T14:30:00Z", pitch: 65, dur: 90, regs: 291, status: "closed" },
  { title: "Pricing Your Coaching Offer — Round 3", topic: "Pricing Your Coaching Offer", iso: "2026-11-05T07:30:00Z", pitch: 60, dur: 90, regs: 224, status: "closed", closeAfterMin: 420 },
  { title: "LinkedIn Lead Gen for Coaches — Round 2", topic: "LinkedIn Lead Gen for Coaches", iso: "2026-11-07T13:30:00Z", pitch: 65, dur: 90, regs: 372, status: "live" },
  { title: "Webinar to ₹10L Funnel — Round 2", topic: "Webinar to ₹10L Funnel", iso: "2026-11-11T14:30:00Z", pitch: 62, dur: 90, regs: 168, status: "scheduled" },
];

const BASE_SHOW: Record<string, number> = { "Sat-19:00": 0.41, "Wed-20:00": 0.32, "Sun-11:00": 0.3, "Thu-13:00": 0.25 };
const BASE_STAY: Record<string, number> = { "Sat-19:00": 0.55, "Wed-20:00": 0.47, "Sun-11:00": 0.42, "Thu-13:00": 0.38 };
const TOPIC_BUY: Record<string, number> = {
  "Pricing Your Coaching Offer": 2.4,
  "First 10 High-Ticket Clients": 1.0,
  "LinkedIn Lead Gen for Coaches": 0.8,
  "Webinar to ₹10L Funnel": 1.2,
  "Instagram Content That Sells": 0.8,
};
const TOPIC_STAY_BONUS: Record<string, number> = { "Pricing Your Coaching Offer": 0.05 };

interface Person {
  id: number;
  name: string;
  email: string;
  phone: string;
  regs: number;
  attended: number;
}

const DOMAINS = ["gmail.com", "gmail.com", "gmail.com", "gmail.com", "gmail.com", "yahoo.in", "outlook.com", "hotmail.com", "rediffmail.com"];

export function generateDataset(): Dataset {
  const rng = new Rng(20261107);
  const now = SIM_START_MS;
  const day = 86400000;
  const min = 60000;

  const persons: Person[] = [];
  const usedEmail = new Set<string>();
  const usedPhone = new Set<string>();

  function newPerson(): Person {
    let first = "";
    let last = "";
    let email = "";
    for (let i = 0; i < 20; i++) {
      first = rng.pick(FIRST_NAMES);
      last = rng.pick(LAST_NAMES);
      const style = rng.int(0, 3);
      const n = rng.int(1, 99);
      const local = style === 0 ? `${first}.${last}` : style === 1 ? `${first}${last}${n}` : style === 2 ? `${first[0]}${last}${n}` : `${last}.${first}`;
      const domain = rng.chance(0.17) ? `${last.toLowerCase()}consulting.in` : rng.pick(DOMAINS);
      email = `${local}@${domain}`.toLowerCase();
      if (!usedEmail.has(email)) break;
      email = `${first}.${last}${rng.int(100, 9999)}@gmail.com`.toLowerCase();
      if (!usedEmail.has(email)) break;
    }
    usedEmail.add(email);
    let phone = "";
    do {
      phone = `+91${rng.int(6, 9)}${String(rng.int(0, 999999999)).padStart(9, "0")}`;
    } while (usedPhone.has(phone));
    usedPhone.add(phone);
    const p: Person = { id: persons.length + 1, name: `${first} ${last}`, email, phone, regs: 0, attended: 0 };
    persons.push(p);
    return p;
  }

  const webinars: Webinar[] = [];
  const registrants: Registrant[] = [];
  const sessions: AttendanceSession[] = [];
  const calls: Call[] = [];
  const sales: Sale[] = [];
  const segments: Segment[] = [];
  const replies: ReplyRow[] = [];
  const events: EventLogRow[] = [];
  const counters = { webinar: 0, registrant: 0, session: 0, call: 0, sale: 0, event: 0, person: 0 };

  const pushEvent = (branch: string, event_type: string, payload: EventLogRow["payload"], iso: string) => {
    counters.event += 1;
    events.push({ id: counters.event, branch, event_type, payload, created_at: iso });
  };
  const iso = (ms: number) => new Date(ms).toISOString();

  for (const spec of SPECS) {
    counters.webinar += 1;
    const wid = counters.webinar;
    const startMs = Date.parse(spec.iso);
    const slot = deriveTimeSlot(spec.iso);
    const closedAt = spec.status === "closed" ? startMs + (spec.closeAfterMin ?? spec.dur + 20) * min : null;
    const zoomId = `8${String(rng.int(0, 9999999999)).padStart(10, "0")}`;
    const w: Webinar = {
      id: wid,
      title: spec.title,
      topic: spec.topic,
      scheduled_at: spec.iso,
      time_slot: slot,
      platform: "zoom",
      platform_webinar_id: zoomId,
      pitch_start_minute: spec.pitch,
      duration_minutes: spec.dur,
      offer_name: OFFER.name,
      offer_price: OFFER.price,
      status: spec.status,
      closed_at: closedAt ? iso(closedAt) : null,
      join_url: `https://zoom.us/j/${zoomId}`,
      replay_url: `https://scaleyourcoaching.in/replay/${wid}`,
      payment_link: `https://rzp.io/l/accelerator-${wid}`,
      booking_link: "https://cal.com/ankit-verma/strategy-call",
      is_test: false,
    };
    webinars.push(w);

    // ---- registrants ----
    const returning = persons.filter((p) => p.attended > 0);
    const inThisWebinar = new Set<number>();
    const kMin = Math.max(0, Math.floor((startMs - now) / day));
    const dayWeights = Array.from({ length: 14 }, (_, k) => (k < kMin ? 0 : Math.exp(-k / 3.2) + 0.06));
    const regTime = (): number => {
      for (let tries = 0; tries < 60; tries++) {
        const k = rng.weighted(dayWeights);
        const t = startMs - (k + rng.next()) * day;
        const hour = new Date(t + 19800000).getUTCHours();
        if (hour < 7) continue;
        if (t > startMs - 2 * min) continue;
        if (t > now - min) continue;
        return t;
      }
      return Math.min(startMs - 3600000, now - 3600000);
    };

    const adWeights = ADS.map((a) => a.weight);
    const orgWeights = ORGANIC_SOURCES.map((o) => o.weight);
    const wRegs: Registrant[] = [];

    for (let i = 0; i < spec.regs; i++) {
      let person: Person | undefined;
      if (returning.length && rng.chance(0.14)) {
        for (let tries = 0; tries < 6; tries++) {
          const cand = rng.pick(returning);
          if (!inThisWebinar.has(cand.id)) {
            person = cand;
            break;
          }
        }
      }
      if (!person) person = newPerson();
      inThisWebinar.add(person.id);
      person.regs += 1;

      const paid = rng.chance(0.86);
      let ad_id: string | null = null;
      let adset_id: string | null = null;
      let campaign_id: string | null = null;
      let utm_source: string;
      let utm_medium: string;
      let utm_campaign: string | null = null;
      let utm_content: string | null = null;
      let regSource = "landing_page";
      if (paid) {
        const ad = ADS[rng.weighted(adWeights)];
        ad_id = ad.ad_id;
        adset_id = ad.adset_id;
        campaign_id = ad.campaign_id;
        utm_source = rng.chance(0.7) ? "facebook" : "instagram";
        utm_medium = "paid_social";
        utm_campaign = ad.campaign_name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        utm_content = ad.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        if (rng.chance(0.3)) regSource = "meta_instant_form";
      } else {
        const o = ORGANIC_SOURCES[rng.weighted(orgWeights)];
        utm_source = o.source;
        utm_medium = o.medium;
      }
      wRegs.push({
        id: 0,
        webinar_id: wid,
        person_id: person.id,
        name: person.name,
        email: person.email,
        phone: person.phone,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        ad_id,
        adset_id,
        campaign_id,
        registered_at: iso(regTime()),
        source: regSource,
        opted_out: rng.chance(0.012),
      });
    }
    wRegs.sort((a, b) => a.registered_at.localeCompare(b.registered_at));
    // multipliers are recomputed from the record's source fields
    const multFor = (r: Registrant) => {
      if (r.ad_id) {
        const ad = ADS.find((a) => a.ad_id === r.ad_id)!;
        return { show: ad.showMult, buy: ad.buyMult };
      }
      const o = ORGANIC_SOURCES.find((s) => s.source === r.utm_source)!;
      return { show: o.showMult, buy: o.buyMult };
    };
    for (const r of wRegs) {
      counters.registrant += 1;
      r.id = counters.registrant;
    }
    registrants.push(...wRegs);

    if (spec.status === "scheduled") continue;

    // ---- attendance sessions ----
    const noise = 1 + (rng.next() - 0.5) * 0.08;
    const pStayW = Math.min(0.85, (BASE_STAY[slot] ?? 0.45) + (TOPIC_STAY_BONUS[spec.topic] ?? 0) + (rng.next() - 0.5) * 0.06);
    const elapsedMin = (now - startMs) / min;
    const attended = new Map<number, boolean>();

    for (const r of wRegs) {
      const person = persons[r.person_id - 1];
      const m = multFor(r);
      const returningBoost = person.attended > 0 ? 1.25 : 1;
      const pAttend = Math.min(0.9, Math.max(0.03, (BASE_SHOW[slot] ?? 0.3) * m.show * noise * returningBoost));
      if (!rng.chance(pAttend)) {
        attended.set(r.id, false);
        continue;
      }
      attended.set(r.id, true);
      const stay = rng.chance(Math.min(0.9, pStayW * Math.pow(m.show, 0.4)));
      // join offset in minutes
      const jr = rng.next();
      let join = jr < 0.7 ? Math.min(25, -Math.log(1 - rng.next() * 0.98) * 2.5) : jr < 0.9 ? rng.between(6, 20) : rng.between(20, 45);
      join = Math.min(join, spec.dur - 8);
      let leave: number;
      if (stay) {
        leave = rng.chance(0.6) ? spec.dur - rng.between(0, 12) : spec.pitch + rng.between(2, Math.max(3, spec.dur - spec.pitch));
        leave = Math.min(spec.dur, Math.max(spec.pitch + 1, leave));
      } else {
        const lr = rng.next();
        leave = lr < 0.42 ? rng.between(6, 16) : lr < 0.78 ? rng.between(16, 38) : rng.between(38, spec.pitch - 1);
        leave = Math.min(spec.pitch - 1, Math.max(leave, join + 2));
      }
      if (join >= leave - 2) join = Math.max(0, leave - rng.between(3, 10));
      let intervals: [number, number][] = [[join, leave]];
      if (leave - join > 14 && rng.chance(0.27)) {
        const g0 = rng.between(join + 4, leave - 8);
        const len = rng.between(1, 7);
        intervals = [[join, g0], [g0 + len, leave]];
        if (leave - g0 - len > 14 && rng.chance(0.25)) {
          const h0 = rng.between(g0 + len + 4, leave - 5);
          intervals = [[join, g0], [g0 + len, h0], [h0 + rng.between(1, 5), leave]];
        }
      }
      for (const [a, b] of intervals) {
        if (b <= a) continue;
        if (spec.status === "live" && a > elapsedMin) continue;
        counters.session += 1;
        const open = spec.status === "live" && b > elapsedMin;
        sessions.push({
          id: counters.session,
          registrant_id: r.id,
          webinar_id: wid,
          join_time: iso(startMs + a * min + rng.int(0, 59) * 1000),
          leave_time: open ? null : iso(startMs + b * min + rng.int(0, 59) * 1000),
        });
      }
    }

    // attendance snapshot (for segment + call + sale decisions)
    const att = computeAttendance(w, wRegs, sessions, now);
    for (const r of wRegs) {
      const a = att.get(r.id);
      if (a?.attended) persons[r.person_id - 1].attended += 1;
    }
    if (spec.status === "live") continue;

    // ---- calls and sales ----
    const endMs = startMs + spec.dur * min;
    const closeMs = closedAt ?? endMs;
    const callByReg = new Map<number, Call>();
    const saleByReg = new Map<number, Sale>();
    const topicBuy = TOPIC_BUY[spec.topic] ?? 1;

    for (const r of wRegs) {
      const a = att.get(r.id)!;
      const seg: SegmentName = !a.attended ? "no_show" : a.stayed_till_pitch ? "stayed_till_offer" : "early_leaver";
      const m = multFor(r);
      const pCall = (seg === "stayed_till_offer" ? 0.11 : seg === "early_leaver" ? 0.035 : 0.008) * Math.pow(m.buy, 0.5) * (r.ad_id ? 1 : 1.3);
      let call: Call | undefined;
      if (rng.chance(pCall)) {
        const bookedMs = endMs + rng.between(5 * min, seg === "no_show" ? 30 * 3600000 : 40 * 3600000);
        if (bookedMs < now) {
          const schedMs = bookedMs + rng.between(1, 4) * day;
          const sched = new Date(Math.floor(schedMs / day) * day + rng.int(5, 13) * 3600000 + 1800000);
          counters.call += 1;
          const past = sched.getTime() < now;
          call = {
            id: counters.call,
            registrant_id: r.id,
            webinar_id: wid,
            booked_at: iso(bookedMs),
            scheduled_for: sched.toISOString(),
            source: rng.chance(0.7) ? "cal_com" : "calendly",
            status: past ? (rng.chance(0.82) ? "completed" : "canceled") : rng.chance(0.93) ? "booked" : "canceled",
          };
          calls.push(call);
          callByReg.set(r.id, call);
          pushEvent("call", call.status === "canceled" ? "call_canceled" : "call_booked", { registrant_id: r.id, webinar_id: wid, call_id: call.id }, call.booked_at);
        }
      }
      const base = seg === "stayed_till_offer" ? 0.05 : seg === "early_leaver" ? 0.016 : 0.006;
      const callBoost = call && call.status !== "canceled" ? 2.2 : 1;
      const pBuy = Math.min(0.5, base * topicBuy * m.buy * callBoost);
      if (rng.chance(pBuy)) {
        let paidMs: number;
        if (call && call.status !== "canceled" && call.scheduled_for) {
          paidMs = Date.parse(call.scheduled_for) + rng.between(0.5, 30) * 3600000;
        } else {
          paidMs = endMs + rng.between(10 * min, 70 * 3600000);
        }
        if (paidMs < now) {
          counters.sale += 1;
          const vip = rng.chance(0.2);
          const manual = rng.chance(0.18);
          const sale: Sale = {
            id: counters.sale,
            registrant_id: r.id,
            webinar_id: wid,
            payment_id: manual ? `MANUAL-${wid}${String(counters.sale).padStart(3, "0")}` : `pay_${Math.floor(rng.next() * 36 ** 10).toString(36).padStart(10, "0").toUpperCase()}${counters.sale}`,
            provider: manual ? "manual" : "razorpay",
            amount_inr: vip ? OFFER.vipPrice : OFFER.price,
            tier: vip ? "VIP" : "Standard",
            status: "paid",
            paid_at: iso(paidMs),
            note: manual ? "UPI transfer confirmed by Ankit" : undefined,
          };
          sales.push(sale);
          saleByReg.set(r.id, sale);
          pushEvent("payment", "payment_received", { registrant_id: r.id, webinar_id: wid, amount_inr: sale.amount_inr, provider: sale.provider }, sale.paid_at);
        }
      }
    }

    // one refunded sale in the older webinars (paid sales only feed metrics)
    if (wid === 2) {
      const refunded = [...saleByReg.values()][0];
      if (refunded) {
        refunded.status = "refunded";
        refunded.note = "Refunded within 7-day guarantee";
        pushEvent("payment", "payment_refunded", { registrant_id: refunded.registrant_id, webinar_id: wid, amount_inr: refunded.amount_inr }, iso(Date.parse(refunded.paid_at) + 3 * day));
      }
    }

    // ---- segments and follow-ups ----
    const sinceClose = (now - closeMs) / day;
    for (const r of wRegs) {
      const a = att.get(r.id)!;
      const seg: SegmentName = !a.attended ? "no_show" : a.stayed_till_pitch ? "stayed_till_offer" : "early_leaver";
      const plan = FOLLOWUP_PLAN[seg];
      const stepsDue = plan.filter((p) => closeMs + p.delay_min * min <= now).length;
      const lastAt = stepsDue ? closeMs + plan[stepsDue - 1].delay_min * min : null;
      const sale = saleByReg.get(r.id);
      const call = callByReg.get(r.id);
      let status: FollowupStatus;
      let replied = false;
      if (r.opted_out) status = "opted_out";
      else if (sale && sale.status === "paid") status = "purchased";
      else if (call && call.status !== "canceled") status = "booked";
      else {
        replied = stepsDue >= 1 && rng.chance(sinceClose <= 14 ? 0.06 : 0.01);
        status = replied ? "replied" : stepsDue >= plan.length ? "completed" : stepsDue >= 1 ? "sequence_running" : "pending";
      }
      if (replied && lastAt) {
        const rp = rng.pick(REPLY_TEXTS);
        const at = Math.min(now - 5 * min, lastAt + rng.between(10 * min, 20 * 3600000));
        replies.push({ registrant_id: r.id, text: rp.text, intent: rp.intent, at: iso(at) });
        pushEvent("reply", "reply_received", { registrant_id: r.id, text: rp.text }, iso(at));
        pushEvent("reply", `reply_intent_${rp.intent}`, { registrant_id: r.id, summary: rp.text }, iso(at + 4000));
      }
      segments.push({
        registrant_id: r.id,
        webinar_id: wid,
        segment: seg,
        followup_status: status,
        followup_step: stepsDue,
        last_followup_at: lastAt ? iso(lastAt) : null,
      });
    }
    pushEvent("close", "webinar_closed", { webinar_id: wid, registrants: wRegs.length }, iso(closeMs));
  }

  // recent registrations only, so the event log stays readable
  for (const r of registrants) {
    if (now - Date.parse(r.registered_at) < 3 * day) {
      pushEvent("register", "registered", { registrant_id: r.id, webinar_id: r.webinar_id, source: r.source }, r.registered_at);
    }
  }

  // ---- ad spend: each ad-day costs (registrants that day × the ad's cost per lead) ----
  const adSpend: AdSpendRow[] = [];
  const perAdDay = new Map<string, number>();
  for (const r of registrants) {
    if (!r.ad_id) continue;
    const key = `${r.ad_id}|${istDateKey(r.registered_at)}`;
    perAdDay.set(key, (perAdDay.get(key) ?? 0) + 1);
  }
  for (const [key, n] of [...perAdDay.entries()].sort()) {
    const [ad_id, date] = key.split("|");
    const ad = ADS.find((a) => a.ad_id === ad_id)!;
    const spend = Math.round(n * ad.cpl * rng.between(0.8, 1.3));
    const impressions = Math.round((spend / rng.between(150, 260)) * 1000);
    adSpend.push({
      date,
      campaign_id: ad.campaign_id,
      adset_id: ad.adset_id,
      ad_id,
      spend_inr: spend,
      impressions,
      clicks: Math.round(impressions * rng.between(0.012, 0.024)),
    });
  }

  const errors: ErrorLogRow[] = ERROR_SAMPLES.map((e, i) => ({
    id: i + 1,
    node: e.node,
    error: e.error,
    execution_id: String(48210 + i * 37 + rng.int(0, 20)),
    created_at: iso(now - (i * 1.4 + rng.between(0.2, 1)) * day),
  }));

  counters.person = persons.length;
  return { webinars, registrants, sessions, segments, calls, sales, adSpend, events, errors, replies, counters };
}

export { COACH };
