// In-memory store + the "write" side of the sample backend.
// Responses mimic the workflow's webhook responses ({status, records_affected, ids, ...}).

import { deriveTimeSlot, normalizePhone } from "../format";
import { computeAttendance } from "../metrics";
import { simNow } from "../clock";
import { COACH, FOLLOWUP_PLAN, OFFER } from "./config";
import { generateDataset, type Dataset } from "./seed";
import type { Call, FollowupStatus, Registrant, Sale, Segment, SegmentName, Webinar } from "../types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

let ds: Dataset | null = null;
let version = 0;
let testRuns = 0;

export function getDb(): Dataset {
  if (!ds) ds = generateDataset();
  return ds;
}

export function dbVersion(): number {
  return version;
}

function touch() {
  version += 1;
}

export function resetDb() {
  ds = null;
  testRuns = 0;
  touch();
}

const nowIso = () => new Date(simNow()).toISOString();

function logEvent(branch: string, event_type: string, payload: Record<string, string | number | boolean | null>) {
  const d = getDb();
  d.counters.event += 1;
  d.events.push({ id: d.counters.event, branch, event_type, payload, created_at: nowIso() });
}

// ---------------------------------------------------------------- create webinar

export interface CreateWebinarInput {
  title: string;
  topic: string;
  scheduled_at: string; // ISO
  platform: string;
  platform_webinar_id?: string;
  pitch_start_minute: number;
  duration_minutes: number;
  offer_name: string;
  offer_price: number;
}

export function createWebinar(input: CreateWebinarInput) {
  const d = getDb();
  if (!input.title.trim() || Number.isNaN(Date.parse(input.scheduled_at))) {
    throw new ApiError("title and a valid scheduled_at (ISO 8601) are required", 400);
  }
  const existing = d.webinars.find((w) => w.title === input.title && w.scheduled_at === input.scheduled_at);
  const slot = deriveTimeSlot(input.scheduled_at);
  if (existing) {
    Object.assign(existing, {
      topic: input.topic || existing.topic,
      time_slot: slot,
      pitch_start_minute: input.pitch_start_minute,
      duration_minutes: input.duration_minutes,
      offer_name: input.offer_name,
      offer_price: input.offer_price,
    });
    touch();
    return { status: "ok" as const, message: "Webinar updated", created: false, time_slot: slot, ids: { webinar_id: existing.id, coach_id: 1 } };
  }
  d.counters.webinar += 1;
  const id = d.counters.webinar;
  const pid = input.platform_webinar_id || `8${String(Math.floor(Math.random() * 1e10)).padStart(10, "0")}`;
  const w: Webinar = {
    id,
    title: input.title,
    topic: input.topic,
    scheduled_at: input.scheduled_at,
    time_slot: slot,
    platform: input.platform,
    platform_webinar_id: pid,
    pitch_start_minute: input.pitch_start_minute,
    duration_minutes: input.duration_minutes,
    offer_name: input.offer_name,
    offer_price: input.offer_price,
    status: Date.parse(input.scheduled_at) > simNow() ? "scheduled" : "live",
    closed_at: null,
    join_url: `https://zoom.us/j/${pid}`,
    replay_url: `https://scaleyourcoaching.in/replay/${id}`,
    payment_link: `https://rzp.io/l/accelerator-${id}`,
    booking_link: "https://cal.com/ankit-verma/strategy-call",
    is_test: false,
  };
  d.webinars.push(w);
  logEvent("create", "webinar_created", { webinar_id: id, time_slot: slot });
  touch();
  return { status: "ok" as const, message: "Webinar created", created: true, time_slot: slot, ids: { webinar_id: id, coach_id: 1 } };
}

// ---------------------------------------------------------------- register

export interface RegisterInput {
  webinar_id: number;
  name?: string;
  email?: string;
  phone?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  source?: string;
  consent?: boolean;
}

export function registerPerson(input: RegisterInput) {
  const d = getDb();
  const w = d.webinars.find((x) => x.id === input.webinar_id);
  if (!w) throw new ApiError("webinar not found", 404);
  const email = (input.email ?? "").trim().toLowerCase();
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const phone = normalizePhone(input.phone ?? "");
  if (!emailOk && !phone) throw new ApiError("a valid email or an Indian mobile number is required", 400);

  const dup = d.registrants.find(
    (r) => r.webinar_id === w.id && ((emailOk && r.email === email) || (phone && r.phone === phone)),
  );
  if (dup) {
    return { status: "ok" as const, message: "Already registered — no duplicate created", duplicate: true, records_affected: 0, ids: { registrant_id: dup.id, webinar_id: w.id } };
  }
  const known = d.registrants.find((r) => (emailOk && r.email === email) || (phone && r.phone === phone));
  let personId = known?.person_id;
  if (!personId) {
    d.counters.person += 1;
    personId = d.counters.person;
  }
  d.counters.registrant += 1;
  const r: Registrant = {
    id: d.counters.registrant,
    webinar_id: w.id,
    person_id: personId,
    name: (input.name ?? "").trim().replace(/\s+/g, " ") || known?.name || "Unknown",
    email: emailOk ? email : known?.email ?? "",
    phone: phone || known?.phone || "",
    utm_source: input.utm_source || null,
    utm_medium: input.utm_medium || null,
    utm_campaign: input.utm_campaign || null,
    utm_content: input.utm_content || null,
    ad_id: input.ad_id || null,
    adset_id: input.adset_id || null,
    campaign_id: input.campaign_id || null,
    registered_at: nowIso(),
    source: input.source || "manual",
    opted_out: false,
  };
  d.registrants.push(r);
  logEvent("register", "registered", { registrant_id: r.id, webinar_id: w.id, source: r.source });
  touch();
  return { status: "ok" as const, message: "Registration saved", duplicate: false, records_affected: 1, ids: { registrant_id: r.id, webinar_id: w.id } };
}

// ---------------------------------------------------------------- attendance (CSV rows)

export interface AttendanceInput {
  webinar_id: number;
  email: string;
  join_time: string;
  leave_time?: string;
}

export function importAttendanceRow(input: AttendanceInput) {
  const d = getDb();
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new ApiError("not a usable participant event: invalid email", 400);
  }
  const join = Date.parse(input.join_time);
  const leave = input.leave_time ? Date.parse(input.leave_time) : NaN;
  if (Number.isNaN(join)) throw new ApiError("not a usable participant event: join_time is not a date", 400);
  if (input.leave_time && (Number.isNaN(leave) || leave < join)) throw new ApiError("leave_time must be after join_time", 400);
  const reg = d.registrants.find((r) => r.webinar_id === input.webinar_id && r.email === email);
  if (!reg) {
    return { status: "ok" as const, matched: false, records_affected: 0, message: "No registrant with this email for this webinar" };
  }
  const joinIso = new Date(join).toISOString();
  const exists = d.sessions.find((s) => s.registrant_id === reg.id && s.join_time === joinIso);
  if (exists) {
    return { status: "ok" as const, matched: true, records_affected: 0, message: "Session already recorded", ids: { registrant_id: reg.id, webinar_id: input.webinar_id } };
  }
  d.counters.session += 1;
  d.sessions.push({
    id: d.counters.session,
    registrant_id: reg.id,
    webinar_id: input.webinar_id,
    join_time: joinIso,
    leave_time: input.leave_time ? new Date(leave).toISOString() : null,
  });
  touch();
  return { status: "ok" as const, matched: true, records_affected: 1, message: "Session recorded", ids: { registrant_id: reg.id, webinar_id: input.webinar_id } };
}

// ---------------------------------------------------------------- close webinar

export function closeWebinar(webinarId: number) {
  const d = getDb();
  const w = d.webinars.find((x) => x.id === webinarId);
  if (!w) throw new ApiError("webinar not found", 404);
  const now = simNow();
  const regs = d.registrants.filter((r) => r.webinar_id === w.id);
  const att = computeAttendance(w, regs, d.sessions, now);
  const counts: Record<SegmentName, number> = { no_show: 0, early_leaver: 0, stayed_till_offer: 0 };
  let attendees = 0;
  for (const r of regs) {
    const a = att.get(r.id)!;
    if (a.attended) attendees += 1;
    const seg: SegmentName = !a.attended ? "no_show" : a.stayed_till_pitch ? "stayed_till_offer" : "early_leaver";
    counts[seg] += 1;
    const existing = d.segments.find((s) => s.registrant_id === r.id && s.webinar_id === w.id);
    if (existing) {
      if (existing.followup_step === 0 && existing.followup_status === "pending") existing.segment = seg;
      continue;
    }
    const hasSale = d.sales.some((s) => s.registrant_id === r.id && s.status === "paid");
    const hasCall = d.calls.some((c) => c.registrant_id === r.id && c.status === "booked");
    const status: FollowupStatus = r.opted_out ? "opted_out" : hasSale ? "purchased" : hasCall ? "booked" : "sequence_running";
    const running = status === "sequence_running";
    const seg0: Segment = {
      registrant_id: r.id,
      webinar_id: w.id,
      segment: seg,
      followup_status: status,
      followup_step: running ? 1 : 0, // step 1 has delay 0, so it goes out right away
      last_followup_at: running ? new Date(now).toISOString() : null,
    };
    d.segments.push(seg0);
  }
  if (w.status !== "closed") {
    w.status = "closed";
    w.closed_at = new Date(now).toISOString();
    logEvent("close", "webinar_closed", { webinar_id: w.id, registrants: regs.length });
  }
  touch();
  void FOLLOWUP_PLAN;
  return {
    status: "ok" as const,
    message: `Webinar closed. ${regs.length} registrants segmented, follow-ups started.`,
    records_affected: regs.length,
    registrants: regs.length,
    attendees,
    segments: counts,
    followups: "started",
    metrics: "recomputing",
    ids: { webinar_id: w.id },
  };
}

// ---------------------------------------------------------------- calls

export interface CallInput {
  email: string;
  webinar_id?: number;
  scheduled_for: string;
  source: string;
}

export function logCall(input: CallInput) {
  const d = getDb();
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError("an invitee email is required", 400);
  const matches = d.registrants
    .filter((r) => r.email === email && (!input.webinar_id || r.webinar_id === input.webinar_id))
    .sort((a, b) => b.webinar_id - a.webinar_id);
  const reg = matches[0];
  if (!reg) return { status: "ok" as const, matched: false, records_affected: 0, message: "No registrant with this email" };
  const when = input.scheduled_for ? new Date(input.scheduled_for).toISOString() : null;
  const dup = d.calls.find((c) => c.registrant_id === reg.id && c.scheduled_for === when && c.status !== "canceled");
  if (dup) return { status: "ok" as const, matched: true, duplicate: true, records_affected: 0, message: "That call is already logged", ids: { registrant_id: reg.id, call_id: dup.id } };
  d.counters.call += 1;
  const call: Call = {
    id: d.counters.call,
    registrant_id: reg.id,
    webinar_id: reg.webinar_id,
    booked_at: nowIso(),
    scheduled_for: when,
    source: input.source || "generic",
    status: "booked",
  };
  d.calls.push(call);
  let stopped = 0;
  const seg = d.segments.find((s) => s.registrant_id === reg.id && s.webinar_id === reg.webinar_id);
  if (seg && ["pending", "sequence_running", "replied"].includes(seg.followup_status)) {
    seg.followup_status = "booked";
    stopped = 1;
  }
  logEvent("call", "call_booked", { registrant_id: reg.id, webinar_id: reg.webinar_id, call_id: call.id });
  touch();
  return {
    status: "ok" as const,
    matched: true,
    duplicate: false,
    records_affected: 1,
    message: stopped ? `Call logged for ${reg.name}. Follow-up sequence stopped.` : `Call logged for ${reg.name}.`,
    ids: { registrant_id: reg.id, call_id: call.id },
    sequences_stopped: stopped,
  };
}

// ---------------------------------------------------------------- manual payment

export interface ManualPaymentInput {
  registrant_id: number;
  amount_inr: number;
  paid_at: string;
  note?: string;
}

export function recordManualPayment(input: ManualPaymentInput) {
  const d = getDb();
  const reg = d.registrants.find((r) => r.id === input.registrant_id);
  if (!reg) throw new ApiError("registrant not found", 404);
  if (!(input.amount_inr > 0)) throw new ApiError("amount_inr must be greater than 0", 400);
  d.counters.sale += 1;
  const sale: Sale = {
    id: d.counters.sale,
    registrant_id: reg.id,
    webinar_id: reg.webinar_id,
    payment_id: `MANUAL-${Date.now().toString(36).toUpperCase()}`,
    provider: "manual",
    amount_inr: input.amount_inr,
    tier: input.amount_inr >= OFFER.vipPrice ? "VIP" : "Standard",
    status: "paid",
    paid_at: new Date(input.paid_at || simNow()).toISOString(),
    note: input.note || undefined,
  };
  d.sales.push(sale);
  let stopped = 0;
  const seg = d.segments.find((s) => s.registrant_id === reg.id && s.webinar_id === reg.webinar_id);
  if (seg && seg.followup_status !== "opted_out") {
    seg.followup_status = "purchased";
    stopped = 1;
  }
  logEvent("payment", "payment_received", { registrant_id: reg.id, webinar_id: reg.webinar_id, amount_inr: sale.amount_inr, provider: "manual" });
  touch();
  return {
    status: "ok" as const,
    message: `Manual payment recorded for ${reg.name}${stopped ? ". Follow-up sequence stopped." : "."}`,
    records_affected: 1,
    ids: { sale_id: sale.id, registrant_id: reg.id, webinar_id: reg.webinar_id },
    sequences_stopped: stopped,
  };
}

// ---------------------------------------------------------------- system

export function setupBackend() {
  return {
    status: "ok" as const,
    message: "Backend initialised. Tables, indexes, views and functions are in place.",
    records_affected: 33,
    created: {
      tables: ["ad_spend", "attendance", "attendance_sessions", "calls", "coaches", "error_log", "event_log", "message_log", "registrants", "sales", "segments", "trend_metrics", "webinar_metrics", "webinars"],
      views: ["v_segment_breakdown", "v_trend_metrics_calc", "v_webinar_ad_spend", "v_webinar_funnel", "v_webinar_metrics_calc"],
      functions: ["claim_message", "close_webinar", "normalize_phone", "recompute_attendance", "recompute_trends", "recompute_webinar_metrics"],
      indexes: Array.from({ length: 8 }, (_, i) => `ix_sample_${i + 1}`),
    },
  };
}

export type TestScenario = "full_funnel" | "poor_attendance" | "strong_pitch";

export function runTestScenario(scenario: TestScenario, size = 12) {
  testRuns += 1;
  const noShow = scenario === "poor_attendance" ? 0.7 : scenario === "strong_pitch" ? 0.2 : 0.4;
  const attendees = Math.round(size * (1 - noShow));
  const sales = scenario === "poor_attendance" ? 0 : scenario === "strong_pitch" ? 4 : 2;
  const checks = [
    { name: "registrations", expected: size, actual: size, pass: true },
    { name: "attendees", expected: attendees, actual: attendees, pass: true },
    { name: "show_up_pct", expected: Math.round((attendees / size) * 10000) / 100, actual: Math.round((attendees / size) * 10000) / 100, pass: true },
    { name: "sales_count", expected: sales, actual: sales, pass: true },
    { name: "revenue_inr", expected: sales * 25000, actual: sales * 25000, pass: true },
    { name: "duplicate registration was deduped", expected: true, actual: true, pass: true },
    { name: "duplicate payment was deduped", expected: true, actual: true, pass: true },
    { name: "every step returned HTTP 200", expected: true, actual: true, pass: true },
  ];
  return {
    status: "ok" as const,
    message: `Scenario "${scenario}" passed ${checks.length} of ${checks.length} checks`,
    records_affected: 24 + size,
    ids: { webinar_id: 9000 + testRuns },
    result: {
      scenario,
      size,
      all_checks_passed: true,
      steps: ["create", "register ×" + size, "adspend", "reminders", "attendance", "close", "call", "payment", "followups ×3", "digest", "metrics", "trends"].map((s) => ({ step: s, http_status: 200, status: "ok" })),
      checks,
    },
  };
}

export function cleanupTestData() {
  const deleted = { webinars_deleted: testRuns, ad_spend_deleted: testRuns * 3, events_deleted: testRuns * 14 };
  testRuns = 0;
  return { status: "ok" as const, message: deleted.webinars_deleted ? "Test data removed" : "Nothing to clean up", records_affected: deleted.webinars_deleted, deleted };
}

export function coachProfile() {
  return COACH;
}
