import { describe, expect, it } from "vitest";
import { getAttribution, getTrends, listWebinars, getRegistrants } from "./queries";
import { ADS } from "./config";

describe("sample data shape", () => {
  const webinars = listWebinars();
  it("has 10 webinars: 8 closed, 1 live, 1 scheduled", () => {
    expect(webinars).toHaveLength(10);
    expect(webinars.filter((w) => w.status === "closed")).toHaveLength(8);
    expect(webinars.filter((w) => w.status === "live")).toHaveLength(1);
    expect(webinars.filter((w) => w.status === "scheduled")).toHaveLength(1);
  });
  it("keeps registrants within 150-450 and show-up within 25-45% on closed webinars", () => {
    for (const w of webinars) {
      expect(w.metrics.registrations).toBeGreaterThanOrEqual(150);
      expect(w.metrics.registrations).toBeLessThanOrEqual(450);
    }
    for (const w of webinars.filter((x) => x.status === "closed")) {
      expect(w.metrics.show_up_pct!).toBeGreaterThanOrEqual(25);
      expect(w.metrics.show_up_pct!).toBeLessThanOrEqual(45);
    }
  });
  it("uses 3 campaigns, 6 adsets and 12 ads", () => {
    expect(new Set(ADS.map((a) => a.campaign_id)).size).toBe(3);
    expect(new Set(ADS.map((a) => a.adset_id)).size).toBe(6);
    expect(ADS).toHaveLength(12);
  });
  it("gives every registrant a +91 phone", () => {
    const { rows } = getRegistrants({ page: 1, page_size: 200 });
    for (const r of rows) expect(r.phone).toMatch(/^\+91[6-9]\d{9}$/);
  });
});

describe("the story the Trends and Attribution pages reveal", () => {
  const t = getTrends().dims;
  const by = <T,>(rows: T[], f: (r: T) => number) => [...rows].sort((a, b) => f(b) - f(a));

  it("Saturday 7 PM wins on show-up", () => {
    const best = by(t.time_slot, (r) => r.avg_show_up_pct ?? 0)[0];
    expect(best.dimension_value).toBe("Sat-19:00");
  });
  it("the Pricing topic converts best", () => {
    const best = by(t.topic, (r) => r.revenue_per_registrant ?? 0)[0];
    expect(best.dimension_value).toBe("Pricing Your Coaching Offer");
  });
  it("one high-volume ad has poor ROAS", () => {
    const ads = getAttribution("ad").rows;
    const biggest = by(ads, (r) => r.registrations)[0];
    expect(biggest.label).toContain("7 LinkedIn myths");
    expect(biggest.roas ?? 0).toBeLessThan(1);
    expect(biggest.action).toBe("Pause");
  });
  it("the Instagram bio is small but very profitable", () => {
    const a = getAttribution("ad");
    const bio = a.organic.find((o) => o.source === "Instagram bio")!;
    const totalRegs = a.split.paid.registrations + a.split.organic.registrations;
    const paidRpr = a.split.paid.revenue_inr / a.split.paid.registrations;
    expect(bio.registrations / totalRegs).toBeLessThan(0.1);
    expect(bio.revenue_per_registrant!).toBeGreaterThan(paidRpr * 3);
    expect(a.organic[0].source).toBe("Instagram bio");
  });
  it("labels spread across Scale / Keep / Watch / Pause", () => {
    const actions = new Set(getAttribution("ad").rows.map((r) => r.action));
    expect(actions.size).toBeGreaterThanOrEqual(3);
    expect(actions.has("Pause")).toBe(true);
  });
});
