function stamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalendarUrl(args: { title: string; startIso: string; durationMin: number; details: string; url: string }): string {
  const start = Date.parse(args.startIso);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: args.title,
    dates: `${stamp(start)}/${stamp(start + args.durationMin * 60000)}`,
    details: `${args.details}\n\nJoin: ${args.url}`,
    location: args.url,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcs(args: { uid: string; title: string; startIso: string; durationMin: number; details: string; url: string }): string {
  const start = Date.parse(args.startIso);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Funnel Engine//Webinar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${args.uid}@funnel-engine`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(start + args.durationMin * 60000)}`,
    `SUMMARY:${esc(args.title)}`,
    `DESCRIPTION:${esc(`${args.details}\n\nJoin: ${args.url}`)}`,
    `LOCATION:${esc(args.url)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Webinar starts in 1 hour",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
