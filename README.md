# Funnel Engine: webinar dashboard (sample data)

A frontend for the "Webinar Funnel Engine" n8n automation, running entirely on seeded sample data for
**Ankit Verma – Scale Your Coaching Business**. Nothing is sent anywhere; changes you make live in memory until you reload.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run lint
npm test
```

## Pages

| Route | What it shows |
| --- | --- |
| `/` | KPI cards (count-up, sparkline, change vs previous webinar), live banner, plain-language insights, next-webinar countdown |
| `/webinars` | List with status badges, **New webinar** form (live time-slot preview), compare 2–4 |
| `/webinars/[id]` | Funnel, retention curve with pitch marker and drop points, watch-time histogram, segments, sales, calls. Actions: close & start follow-ups, import attendance CSV, log booked call, add registrant |
| `/segments` | Three boards, status heat-matrix, message-sequence timeline, "Needs a human now", people table with CSV export |
| `/trends` | Topic / time slot / campaign / adset / ad rankings, best & worst call-outs, low-data warning, day × time heatmap |
| `/attribution` | Spend-vs-revenue scatter, Scale/Keep/Watch/Pause leaderboard with visible rules, paid vs organic |
| `/people` | Search across every webinar, journey drawer, repeat attendees flagged |
| `/sales` | Monthly revenue, sales and calls tables, record manual payment |
| `/system` | Initialise backend, test runner + cleanup, endpoint health check, event and error logs |
| `/r/[webinarId]` | Public, mobile-first registration page (captures `utm_*`, `ad_id`, `adset_id`, `campaign_id`; +91 phone; consent; add-to-calendar) |

`⌘K` / `Ctrl+K` searches webinars, people and ads.

## The sample data tells a story

Saturday 7 PM wins on show-up · the *Pricing Your Coaching Offer* topic converts best · one high-volume ad
("Carousel · 7 LinkedIn myths") has poor ROAS · the Instagram bio is small but very profitable.
`src/lib/mock/story.test.ts` asserts all four, so the data cannot silently drift.

## How it is built

- **One metrics module** (`src/lib/metrics.ts`, unit-tested) computes every number from raw records using the
  workflow's formulas: show-up = attendees ÷ registrations, stayed-till-pitch = stayed ÷ attendees,
  revenue per registrant = revenue ÷ registrations, ROAS = revenue ÷ spend, cost per registrant = spend ÷ registrations,
  cost per attendee = spend ÷ attendees. Paid sales only.
- `src/lib/mock/seed.ts` generates deterministic raw records (webinars, registrants, sessions, calls, sales, ad spend).
  `queries.ts` is the read side, `db.ts` the write side, `hooks.ts` wraps both in TanStack Query.
- The simulated clock starts at **Sat 7 Nov 2026, 7:35 PM IST**, so the 7 PM webinar is 35 minutes in.
- Stack: Next.js 15 (App Router), TypeScript, Tailwind v4, TanStack Query + Table, Recharts, Framer Motion,
  React Hook Form + Zod, date-fns-tz. Chart colours follow a validated palette; every chart has a caption and a
  "view as table" toggle. Light and dark themes, keyboard accessible.

## Connecting the real workflow later

The hooks in `src/lib/hooks.ts` are the only place the UI touches data. Swap the functions imported from
`src/lib/mock/*` for calls to a server-side proxy that forwards to the n8n webhooks (keep the Header Auth secret on the server).
