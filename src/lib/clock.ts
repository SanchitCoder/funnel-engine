"use client";

import { useEffect, useState } from "react";

/** The sample dashboard "wakes up" at Sat 7 Nov 2026, 7:35 PM IST: the 7 PM webinar is 35 minutes in. */
export const SIM_START_MS = Date.parse("2026-11-07T14:05:00Z");

const PAGE_LOAD_MS = Date.now();

/** Simulated "now": starts at SIM_START_MS and ticks in real time. */
export function simNow(): number {
  return SIM_START_MS + (Date.now() - PAGE_LOAD_MS);
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(SIM_START_MS);
  useEffect(() => {
    const tick = () => setNow(simNow());
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
