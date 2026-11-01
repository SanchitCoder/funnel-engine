import type { AdCatalogEntry, SegmentName } from "../types";

export const COACH = {
  name: "Ankit Verma",
  brand: "Scale Your Coaching Business",
  whatsapp: "+919876500123",
  email: "ankit@scaleyourcoaching.in",
};

export const OFFER = {
  name: "Coaching Business Accelerator",
  price: 24999,
  vipName: "Coaching Business Accelerator · VIP",
  vipPrice: 49999,
};

export const TOPICS = [
  "First 10 High-Ticket Clients",
  "LinkedIn Lead Gen for Coaches",
  "Pricing Your Coaching Offer",
  "Webinar to ₹10L Funnel",
  "Instagram Content That Sells",
];

export const SLOTS = ["Sat-19:00", "Wed-20:00", "Sun-11:00", "Thu-13:00"];

/** The workflow's CONFIG.followup_plan */
export const FOLLOWUP_PLAN: Record<SegmentName, { step: number; delay_min: number; msg: string }[]> = {
  no_show: [
    { step: 1, delay_min: 0, msg: "noshow_replay" },
    { step: 2, delay_min: 1440, msg: "noshow_scarcity" },
    { step: 3, delay_min: 2880, msg: "noshow_final_offer" },
  ],
  early_leaver: [
    { step: 1, delay_min: 0, msg: "early_missed" },
    { step: 2, delay_min: 1440, msg: "early_call_push" },
  ],
  stayed_till_offer: [
    { step: 1, delay_min: 0, msg: "offer_recap" },
    { step: 2, delay_min: 1440, msg: "deadline_24h" },
    { step: 3, delay_min: 2880, msg: "deadline_48h" },
  ],
};

export const MESSAGE_LABELS: Record<string, string> = {
  noshow_replay: "Replay link",
  noshow_scarcity: "Replay coming down",
  noshow_final_offer: "Final call on the offer",
  early_missed: "What you missed",
  early_call_push: "Book a free call",
  offer_recap: "Offer recap",
  deadline_24h: "24 hours left",
  deadline_48h: "Last chance",
};

export const SEGMENT_LABELS: Record<SegmentName, string> = {
  no_show: "No-shows",
  early_leaver: "Early leavers",
  stayed_till_offer: "Stayed till offer",
};

export const SEGMENT_HINT: Record<SegmentName, string> = {
  no_show: "Registered but never joined",
  early_leaver: "Left before the pitch",
  stayed_till_offer: "Still in the room at the pitch",
};

export interface AdProfile extends AdCatalogEntry {
  weight: number; // share of paid registrations
  showMult: number; // show-up multiplier
  buyMult: number; // purchase-probability multiplier
  cpl: number; // cost per registrant (₹)
}

const C1 = { id: "120214501230001", name: "Cold · Coaching Interests" };
const C2 = { id: "120214501230002", name: "Lookalike · Past Attendees" };
const C3 = { id: "120214501230003", name: "Retarget · Engagers" };

const S = (id: string, name: string, c: { id: string; name: string }) => ({ id, name, c });
const A1 = S("120214501240001", "Interest · Business Coaches", C1);
const A2 = S("120214501240002", "Interest · LinkedIn Creators", C1);
const A3 = S("120214501240003", "Lookalike 1% · Attendees", C2);
const A4 = S("120214501240004", "Lookalike 2–3% · Buyers", C2);
const A5 = S("120214501240005", "IG Engagers 30d", C3);
const A6 = S("120214501240006", "Video Viewers 50%", C3);

const ad = (
  n: number,
  name: string,
  s: ReturnType<typeof S>,
  weight: number,
  showMult: number,
  buyMult: number,
  cpl: number,
): AdProfile => ({
  ad_id: `1202145012500${String(n).padStart(2, "0")}`,
  name,
  adset_id: s.id,
  adset_name: s.name,
  campaign_id: s.c.id,
  campaign_name: s.c.name,
  weight,
  showMult,
  buyMult,
  cpl,
});

export const ADS: AdProfile[] = [
  ad(1, "Reel · Stuck at ₹50k a month?", A1, 10, 1.0, 1.1, 120),
  ad(2, "Static · 3 client calls a week", A1, 6, 0.95, 0.9, 140),
  ad(3, "Carousel · 7 LinkedIn myths", A2, 22, 0.65, 0.03, 95), // high volume, poor quality
  ad(4, "Reel · Post once a week", A2, 7, 0.9, 0.8, 130),
  ad(5, "Reel · Founder story", A3, 9, 1.2, 1.5, 160),
  ad(6, "Static · Free training", A3, 6, 1.1, 1.3, 150),
  ad(7, "Reel · The ₹10L blueprint", A4, 5, 1.25, 1.8, 210),
  ad(8, "Video · Student wins", A4, 4, 1.15, 1.4, 190),
  ad(9, "Static · Last seats", A5, 5, 1.3, 1.2, 90),
  ad(10, "Reel · Behind the scenes", A5, 3, 1.0, 0.7, 110),
  ad(11, "Video · 60s teaser", A6, 4, 1.1, 1.0, 100),
  ad(12, "Carousel · FAQ", A6, 2, 0.8, 0.4, 95),
];

export const ORGANIC_SOURCES: { source: string; medium: string; weight: number; showMult: number; buyMult: number; label: string }[] = [
  { source: "instagram_bio", medium: "bio", weight: 45, showMult: 1.35, buyMult: 3.0, label: "Instagram bio" },
  { source: "youtube", medium: "organic", weight: 20, showMult: 1.2, buyMult: 1.4, label: "YouTube" },
  { source: "whatsapp_community", medium: "community", weight: 20, showMult: 1.3, buyMult: 1.6, label: "WhatsApp community" },
  { source: "email_newsletter", medium: "email", weight: 15, showMult: 1.25, buyMult: 1.5, label: "Email newsletter" },
];

export function sourceLabel(utmSource: string | null, adId: string | null): string {
  if (adId) return "Meta ads";
  const o = ORGANIC_SOURCES.find((s) => s.source === utmSource);
  return o ? o.label : utmSource ? utmSource : "Direct";
}

export const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Arjun", "Rohan", "Karan", "Rahul", "Amit", "Sandeep", "Vikram", "Nikhil", "Manish",
  "Pooja", "Priya", "Neha", "Anjali", "Kavya", "Sneha", "Ritu", "Meera", "Divya", "Shruti", "Ananya", "Isha", "Swati",
  "Nisha", "Deepak", "Suresh", "Rajesh", "Harsh", "Mohit", "Gaurav", "Varun", "Tarun", "Yash", "Kunal", "Siddharth",
  "Abhishek", "Ayesha", "Fatima", "Simran", "Harpreet", "Gurpreet", "Jasleen", "Lakshmi", "Revathi", "Aravind",
  "Karthik", "Sanjay", "Prakash", "Tanvi", "Riya", "Aisha", "Mahesh", "Naveen", "Pallavi", "Rashmi", "Vandana",
  "Ishaan", "Dev", "Kabir", "Zoya", "Mansi", "Tejas", "Omkar", "Chetan", "Bhavna", "Komal", "Jyoti", "Sunita",
];

export const LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Singh", "Patel", "Mehta", "Shah", "Joshi", "Iyer", "Nair", "Reddy", "Rao", "Kulkarni",
  "Deshmukh", "Chopra", "Malhotra", "Kapoor", "Bansal", "Agarwal", "Jain", "Mishra", "Pandey", "Tiwari", "Yadav",
  "Chauhan", "Bhatt", "Desai", "Menon", "Pillai", "Das", "Banerjee", "Chatterjee", "Ghosh", "Sen", "Kaur", "Khan",
  "Ansari", "Naidu", "Hegde", "Shetty", "Saxena", "Arora", "Bhatia", "Sethi", "Trivedi", "Kohli", "Thakur", "Rawat",
];

export const REPLY_TEXTS: { text: string; intent: "interested" | "question" | "later" }[] = [
  { text: "Yes interested, can you share the price?", intent: "interested" },
  { text: "I'm in. How do I pay?", intent: "interested" },
  { text: "Is there an EMI option?", intent: "question" },
  { text: "What's the difference between Standard and VIP?", intent: "question" },
  { text: "Call me tomorrow after 5pm please", intent: "interested" },
  { text: "Will this work for fitness coaching?", intent: "question" },
  { text: "Can I get the replay link again?", intent: "question" },
  { text: "Not right now, maybe next month", intent: "later" },
  { text: "Send me the payment link", intent: "interested" },
  { text: "Is the cohort starting this month?", intent: "question" },
];

export const ERROR_SAMPLES: { node: string; error: string }[] = [
  { node: "Send – WhatsApp Template", error: "(#132000) Number of parameters does not match the expected number of params" },
  { node: "Facebook Graph – Fetch Ad Insights", error: "Request timed out after 30000ms" },
  { node: "Register – Upsert Registrant", error: "duplicate key value violates unique constraint \"ux_registrants_phone\"" },
  { node: "Zoom – Fetch Participant Report", error: "Zoom API 429: rate limit reached, retry after 12s" },
  { node: "Payment – Match and Record Sale", error: "invalid input syntax for type numeric: \"\"" },
  { node: "Send – Gmail Fallback", error: "Recipient address rejected: invalid domain" },
];
