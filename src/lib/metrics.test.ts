import { describe, expect, it } from "vitest";
import {
  biggestDrops,
  classifyAd,
  computeAttendance,
  computeRetention,
  costPerAttendee,
  costPerRegistrant,
  revenuePerRegistrant,
  roas,
  showUpPct,
  stayedTillPitchPct,
} from "./metrics";
import type { AttendanceSession, Registrant, Webinar } from "./types";
import { deriveTimeSlot, formatINR, formatINRCompact } from "./format";

const webinar: Webinar = {
  id: 1,
  title: "T",
  topic: "T",
  scheduled_at: "2026-10-10T13:30:00Z", // Sat 19:00 IST
  time_slot: "Sat-19:00",
  platform: "zoom",
  platform_webinar_id: "x",
  pitch_start_minute: 60,
  duration_minutes: 90,
  offer_name: "o",
  offer_price: 24999,
  status: "closed",
  closed_at: null,
  join_url: "",
  replay_url: "",
  payment_link: "",
  booking_link: "",
  is_test: false,
};

const reg = (id: number): Registrant => ({
  id,
  webinar_id: 1,
  person_id: id,
  name: `P${id}`,
  email: `p${id}@x.in`,
  phone: "+919999999999",
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  ad_id: null,
  adset_id: null,
  campaign_id: null,
  registered_at: "2026-10-05T10:00:00Z",
  source: "landing_page",
  opted_out: false,
});

const at = (min: number) => new Date(Date.parse(webinar.scheduled_at) + min * 60000).toISOString();

describe("ratio formulas", () => {
  it("matches the backend definitions", () => {
    expect(showUpPct(40, 100)).toBe(40);
    expect(stayedTillPitchPct(20, 40)).toBe(50);
    expect(revenuePerRegistrant(50000, 100)).toBe(500);
    expect(roas(90000, 30000)).toBe(3);
    expect(costPerRegistrant(30000, 100)).toBe(300);
    expect(costPerAttendee(30000, 40)).toBe(750);
  });
  it("returns null on a zero denominator", () => {
    expect(showUpPct(0, 0)).toBeNull();
    expect(roas(100, 0)).toBeNull();
    expect(costPerAttendee(100, 0)).toBeNull();
  });
});

describe("computeAttendance", () => {
  const regs = [reg(1), reg(2), reg(3)];
  const sessions: AttendanceSession[] = [
    { id: 1, registrant_id: 1, webinar_id: 1, join_time: at(2), leave_time: at(30) },
    { id: 2, registrant_id: 1, webinar_id: 1, join_time: at(35), leave_time: at(80) },
    { id: 3, registrant_id: 2, webinar_id: 1, join_time: at(5), leave_time: at(20) },
  ];
  const att = computeAttendance(webinar, regs, sessions, Date.parse(at(200)));

  it("sums multi-session watch time and flags the pitch", () => {
    const a = att.get(1)!;
    expect(a.attended).toBe(true);
    expect(a.sessions_count).toBe(2);
    expect(a.watch_minutes).toBe(73); // 28 + 45
    expect(a.stayed_till_pitch).toBe(true);
  });
  it("marks early leavers and no-shows", () => {
    expect(att.get(2)!.stayed_till_pitch).toBe(false);
    expect(att.get(2)!.watch_minutes).toBe(15);
    expect(att.get(3)!.attended).toBe(false);
  });
});

describe("retention", () => {
  it("counts concurrent viewers per minute", () => {
    const sessions: AttendanceSession[] = [
      { id: 1, registrant_id: 1, webinar_id: 1, join_time: at(0), leave_time: at(10) },
      { id: 2, registrant_id: 2, webinar_id: 1, join_time: at(5), leave_time: at(20) },
    ];
    const pts = computeRetention(webinar, sessions, Date.parse(at(200)));
    expect(pts[0].viewers).toBe(1);
    expect(pts[7].viewers).toBe(2);
    expect(pts[15].viewers).toBe(1);
    expect(pts[30].viewers).toBe(0);
  });
  it("finds the sharpest drop", () => {
    const pts = Array.from({ length: 60 }, (_, m) => ({ minute: m, viewers: m < 30 ? 100 : 40 }));
    const drops = biggestDrops(pts, 1);
    expect(drops[0].minute).toBeGreaterThan(26);
    expect(drops[0].minute).toBeLessThan(34);
  });
});

describe("ad action rules", () => {
  it("is Watch below the data threshold", () => {
    expect(classifyAd({ spend: 1000, registrations: 10, roasValue: 9 }).action).toBe("Watch");
  });
  it("scales, keeps and pauses by ROAS", () => {
    expect(classifyAd({ spend: 10000, registrations: 100, roasValue: 6 }).action).toBe("Scale");
    expect(classifyAd({ spend: 10000, registrations: 100, roasValue: 3 }).action).toBe("Keep");
    expect(classifyAd({ spend: 10000, registrations: 100, roasValue: 0.4 }).action).toBe("Pause");
  });
});

describe("formatting", () => {
  it("uses Indian grouping and compact lakhs", () => {
    expect(formatINR(120000)).toBe("₹1,20,000");
    expect(formatINRCompact(120000)).toBe("₹1.2L");
    expect(formatINRCompact(24999)).toBe("₹25k");
  });
  it("derives the IST time slot", () => {
    expect(deriveTimeSlot("2026-10-10T13:30:00Z")).toBe("Sat-19:00");
  });
});
