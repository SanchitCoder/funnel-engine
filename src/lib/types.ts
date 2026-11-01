// Domain types. They mirror the tables of the Webinar Funnel Engine workflow
// (webinars, registrants, attendance_sessions, segments, calls, sales, ad_spend, event_log).

export type WebinarStatus = "scheduled" | "live" | "closed" | "cancelled";
export type SegmentName = "no_show" | "early_leaver" | "stayed_till_offer";
export type FollowupStatus =
  | "pending"
  | "sequence_running"
  | "replied"
  | "booked"
  | "purchased"
  | "completed"
  | "opted_out";
export type CallStatus = "booked" | "canceled" | "completed";
export type SaleStatus = "paid" | "refunded" | "failed";

export interface Webinar {
  id: number;
  title: string;
  topic: string;
  scheduled_at: string; // ISO (UTC)
  time_slot: string; // e.g. "Sat-19:00" (IST)
  platform: string;
  platform_webinar_id: string;
  pitch_start_minute: number;
  duration_minutes: number;
  offer_name: string;
  offer_price: number;
  status: WebinarStatus;
  closed_at: string | null;
  join_url: string;
  replay_url: string;
  payment_link: string;
  booking_link: string;
  is_test: boolean;
}

export interface Registrant {
  id: number;
  webinar_id: number;
  person_id: number; // stable across webinars (same email / phone)
  name: string;
  email: string;
  phone: string; // +91XXXXXXXXXX
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  ad_id: string | null;
  adset_id: string | null;
  campaign_id: string | null;
  registered_at: string;
  source: string; // landing_page | meta_instant_form | manual | csv
  opted_out: boolean;
}

export interface AttendanceSession {
  id: number;
  registrant_id: number;
  webinar_id: number;
  join_time: string;
  leave_time: string | null; // null = still in the room
}

export interface Attendance {
  registrant_id: number;
  webinar_id: number;
  attended: boolean;
  join_time: string | null;
  leave_time: string | null;
  watch_minutes: number;
  sessions_count: number;
  stayed_till_pitch: boolean;
}

export interface Segment {
  registrant_id: number;
  webinar_id: number;
  segment: SegmentName;
  followup_status: FollowupStatus;
  followup_step: number;
  last_followup_at: string | null;
}

export interface Call {
  id: number;
  registrant_id: number;
  webinar_id: number;
  booked_at: string;
  scheduled_for: string | null;
  source: string;
  status: CallStatus;
}

export interface Sale {
  id: number;
  registrant_id: number | null;
  webinar_id: number;
  payment_id: string;
  provider: string;
  amount_inr: number;
  tier: "Standard" | "VIP";
  status: SaleStatus;
  paid_at: string;
  note?: string;
}

export interface AdSpendRow {
  date: string; // yyyy-MM-dd (IST)
  campaign_id: string;
  adset_id: string;
  ad_id: string;
  spend_inr: number;
  impressions: number;
  clicks: number;
}

export interface EventLogRow {
  id: number;
  branch: string;
  event_type: string;
  payload: Record<string, string | number | boolean | null>;
  created_at: string;
}

export interface ErrorLogRow {
  id: number;
  node: string;
  error: string;
  execution_id: string;
  created_at: string;
}

export interface ReplyRow {
  registrant_id: number;
  text: string;
  intent: "interested" | "question" | "later";
  at: string;
}

export interface AdCatalogEntry {
  ad_id: string;
  adset_id: string;
  campaign_id: string;
  name: string;
  adset_name: string;
  campaign_name: string;
}

// ---- Computed shapes (what the read endpoints would return) ----

export interface WebinarMetrics {
  registrations: number;
  attendees: number;
  show_up_pct: number | null;
  avg_watch_minutes: number;
  stayed_till_pitch: number; // count
  stayed_till_pitch_pct: number | null;
  calls_booked: number;
  sales_count: number;
  revenue_inr: number;
  ad_spend_inr: number;
  revenue_per_registrant: number | null;
  roas: number | null;
  cost_per_registrant: number | null;
  cost_per_attendee: number | null;
}

export interface WebinarWithMetrics extends Webinar {
  metrics: WebinarMetrics;
}

export interface TrendRow {
  dimension_value: string;
  label: string;
  webinars_count: number;
  avg_show_up_pct: number | null;
  avg_stayed_till_pitch_pct: number | null;
  sales: number;
  revenue_inr: number;
  spend_inr: number;
  roas: number | null;
  revenue_per_registrant: number | null;
}

export type TrendDimension = "topic" | "time_slot" | "campaign" | "adset" | "ad";

export type AdAction = "Scale" | "Keep" | "Watch" | "Pause";

export interface AttributionRow {
  id: string;
  label: string;
  parent: string | null;
  spend_inr: number;
  impressions: number;
  clicks: number;
  registrations: number;
  attendees: number;
  sales: number;
  revenue_inr: number;
  roas: number | null;
  cost_per_registrant: number | null;
  cost_per_attendee: number | null;
  action: AdAction;
  reason: string;
}

export interface OrganicSource {
  source: string;
  registrations: number;
  attendees: number;
  sales: number;
  revenue_inr: number;
  revenue_per_registrant: number | null;
}

export interface RegistrantRow {
  registrant_id: number;
  person_id: number;
  webinar_id: number;
  webinar_title: string;
  webinar_slot: string;
  webinar_date: string;
  name: string;
  email: string;
  phone: string;
  source_label: string;
  ad_id: string | null;
  attended: boolean;
  watch_minutes: number;
  segment: SegmentName | null;
  followup_status: FollowupStatus | null;
  followup_step: number;
  prior_webinars_attended: number;
  registered_at: string;
  last_reply?: string;
}
