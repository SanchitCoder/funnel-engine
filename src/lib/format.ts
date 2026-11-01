import { formatInTimeZone } from "date-fns-tz";

export const IST = "Asia/Kolkata";

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

/** ₹1,20,000 */
export function formatINR(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}₹${inr.format(Math.abs(Math.round(value)))}`;
}

/** ₹1.2L, ₹3.4Cr, ₹45k */
export function formatINRCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
  if (abs >= 1e4) return `${sign}₹${trim(abs / 1e3)}k`;
  return `${sign}₹${inr.format(Math.round(abs))}`;
}

function trim(n: number): string {
  return n >= 100 ? String(Math.round(n)) : n.toFixed(n >= 10 ? 1 : 2).replace(/\.?0+$/, "");
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return inr.format(Math.round(value));
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits).replace(/\.0$/, "")}%`;
}

export function formatMinutes(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value < 60) return `${num1.format(value)} min`;
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  return `${h}h ${m}m`;
}

export function formatRoas(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value < 1 ? value.toFixed(2) : value.toFixed(1))}×`;
}

/** "Sat, 7 Nov · 7:00 PM IST" */
export function formatIST(iso: string, pattern = "EEE, d MMM · h:mm a"): string {
  return `${formatInTimeZone(new Date(iso), IST, pattern)} IST`;
}

/** Pattern-formatted IST time with no suffix. */
export function formatISTPattern(iso: string, pattern: string): string {
  return formatInTimeZone(new Date(iso), IST, pattern);
}

export function formatISTDate(iso: string): string {
  return formatInTimeZone(new Date(iso), IST, "d MMM yyyy");
}

export function formatISTShort(iso: string): string {
  return formatInTimeZone(new Date(iso), IST, "d MMM");
}

export function formatISTTime(iso: string): string {
  return `${formatInTimeZone(new Date(iso), IST, "h:mm a")}`;
}

/** time_slot as the backend derives it: ccc-HH:mm in Asia/Kolkata */
export function deriveTimeSlot(iso: string): string {
  return formatInTimeZone(new Date(iso), IST, "EEE-HH:mm");
}

export function istDateKey(iso: string): string {
  return formatInTimeZone(new Date(iso), IST, "yyyy-MM-dd");
}

export function istMonthKey(iso: string): string {
  return formatInTimeZone(new Date(iso), IST, "yyyy-MM");
}

export function relativeFrom(iso: string, nowMs: number): string {
  const diff = nowMs - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60000);
  let text: string;
  if (min < 1) text = "just now";
  else if (min < 60) text = `${min}m`;
  else if (min < 60 * 24) text = `${Math.round(min / 60)}h`;
  else text = `${Math.round(min / 1440)}d`;
  if (text === "just now") return text;
  return diff >= 0 ? `${text} ago` : `in ${text}`;
}

export function maskPhone(phone: string): string {
  if (phone.length < 8) return phone;
  return `${phone.slice(0, 3)} ${phone.slice(3, 4)}•••• ••${phone.slice(-2)}`;
}

export function formatPhone(phone: string): string {
  if (!phone.startsWith("+91") || phone.length !== 13) return phone;
  return `+91 ${phone.slice(3, 8)} ${phone.slice(8)}`;
}

export function slotLabel(slot: string): string {
  // "Sat-19:00" -> "Sat · 7:00 PM"
  const [day, time] = slot.split("-");
  if (!day || !time) return slot;
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${day} · ${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function topicShort(topic: string): string {
  return topic.length > 26 ? `${topic.slice(0, 24)}…` : topic;
}

/** Normalise an Indian mobile number to +91XXXXXXXXXX (same rules as the workflow). Returns "" when invalid. */
export function normalizePhone(raw: string): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(d)) return `+91${d}`;
  if (/^0[6-9]\d{9}$/.test(d)) return `+91${d.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(d)) return `+${d}`;
  if (/^0091[6-9]\d{9}$/.test(d)) return `+${d.slice(2)}`;
  return "";
}
