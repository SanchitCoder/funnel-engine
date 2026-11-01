"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { fromZonedTime } from "date-fns-tz";
import { CheckCircle2, FileUp, TriangleAlert, XCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { simNow } from "@/lib/clock";
import { formatISTPattern, IST, normalizePhone } from "@/lib/format";
import { useAttendanceImport, useLogCall, useRegister, useRegistrants } from "@/lib/hooks";
import { getRegistrantsAll } from "@/lib/mock/queries";
import type { AttendanceInput } from "@/lib/mock/db";
import { cn } from "@/lib/utils";

// ======================================================================== CSV import

export interface ParsedRow {
  line: number;
  email: string;
  join_time?: string;
  leave_time?: string;
  error?: string;
}

/** Minimal RFC-4180 style parser: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const EMAIL_KEYS = ["email", "useremail", "participantemail", "emailaddress"];
const JOIN_KEYS = ["jointime", "join", "joined", "joinedat", "start", "starttime"];
const LEAVE_KEYS = ["leavetime", "leave", "left", "leftat", "end", "endtime"];

function toIso(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(v);
  const normalised = v.replace(" ", "T");
  const d = hasZone ? new Date(normalised) : fromZonedTime(normalised.length === 16 ? normalised : normalised.slice(0, 19), IST);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseAttendance(text: string): { rows: ParsedRow[]; headerError?: string } {
  const grid = parseCsv(text);
  if (grid.length === 0) return { rows: [], headerError: "The file is empty." };
  const header = grid[0].map(norm);
  const find = (keys: string[]) => header.findIndex((h) => keys.includes(h));
  const ei = find(EMAIL_KEYS);
  const ji = find(JOIN_KEYS);
  const li = find(LEAVE_KEYS);
  if (ei < 0 || ji < 0) return { rows: [], headerError: "Needs an email column and a join_time column. Header found: " + grid[0].join(", ") };
  const rows: ParsedRow[] = grid.slice(1).map((cells, idx) => {
    const email = (cells[ei] ?? "").trim().toLowerCase();
    const join = toIso(cells[ji] ?? "");
    const leaveRaw = li >= 0 ? (cells[li] ?? "").trim() : "";
    const leave = leaveRaw ? toIso(leaveRaw) : undefined;
    let error: string | undefined;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) error = "Invalid email";
    else if (!join) error = "join_time is not a date";
    else if (leaveRaw && !leave) error = "leave_time is not a date";
    else if (leave && join && leave < join) error = "leave_time is before join_time";
    return { line: idx + 2, email, join_time: join ?? undefined, leave_time: leave ?? undefined, error };
  });
  return { rows };
}

type Result = { row: ParsedRow; state: "recorded" | "duplicate" | "unmatched" | "failed"; message: string };

export function ImportAttendanceDialog({ open, onOpenChange, webinarId, webinarStart }: { open: boolean; onOpenChange: (o: boolean) => void; webinarId: number; webinarStart: string }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [phase, setPhase] = useState<"choose" | "importing" | "done">("choose");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const importer = useAttendanceImport();

  const parsed = useMemo(() => (text.trim() ? parseAttendance(text) : null), [text]);
  const valid = parsed?.rows.filter((r) => !r.error) ?? [];
  const invalid = parsed?.rows.filter((r) => r.error) ?? [];

  const reset = () => {
    setText("");
    setFileName(null);
    setPhase("choose");
    setProgress(0);
    setResults([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const loadSample = () => {
    const people = getRegistrantsAll({ webinar_id: webinarId }).slice(0, 9);
    const start = Date.parse(webinarStart);
    const at = (m: number) => formatISTPattern(new Date(start + m * 60000).toISOString(), "yyyy-MM-dd HH:mm:ss");
    const lines = ["email,join_time,leave_time"];
    people.forEach((p, i) => lines.push(`${p.email},${at(2 + i)},${at(40 + i * 5)}`));
    lines.push(`not.registered@example.com,${at(5)},${at(30)}`);
    lines.push(`bad-email,${at(5)},${at(30)}`);
    lines.push(`${people[0]?.email ?? "a@b.in"},${at(60)},${at(10)}`);
    setText(lines.join("\n"));
    setFileName("sample-attendance.csv");
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error("That file is over 2 MB. Split it and import in parts.");
      return;
    }
    setText(await file.text());
    setFileName(file.name);
  };

  const run = async () => {
    setPhase("importing");
    setProgress(0);
    const out: Result[] = [];
    const BATCH = 10;
    for (let i = 0; i < valid.length; i += BATCH) {
      const slice = valid.slice(i, i + BATCH);
      const payload: AttendanceInput[] = slice.map((r) => ({ webinar_id: webinarId, email: r.email, join_time: r.join_time as string, leave_time: r.leave_time }));
      const res = await importer.importBatch(payload);
      res.forEach((r, k) => {
        const row = slice[k];
        out.push({
          row,
          state: !r.ok ? "failed" : !r.matched ? "unmatched" : r.message.includes("already") ? "duplicate" : "recorded",
          message: r.message,
        });
      });
      setProgress(Math.min(valid.length, i + BATCH));
      setResults([...out]);
    }
    for (const r of invalid) out.push({ row: r, state: "failed", message: r.error ?? "Invalid row" });
    setResults(out);
    setPhase("done");
    await importer.done();
    const ok = out.filter((r) => r.state === "recorded").length;
    toast.success(`Imported ${ok} session${ok === 1 ? "" : "s"} from ${fileName ?? "pasted CSV"}`);
  };

  const count = (s: Result["state"]) => results.filter((r) => r.state === s).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (phase === "importing") return;
        onOpenChange(o);
        if (!o) setTimeout(reset, 200);
      }}
    >
      <DialogContent title="Import attendance (CSV)" description="For platforms that are not Zoom. Each row is sent as its own attendance event, ten at a time." wide>
        {phase === "choose" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" id="csv-file" onChange={(e) => onFile(e.target.files?.[0])} />
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                <FileUp /> Choose a CSV file
              </Button>
              <Button variant="ghost" onClick={loadSample}>
                Use a sample file
              </Button>
              {fileName ? <span className="text-[13px] text-ink-3">{fileName}</span> : null}
            </div>
            <Field label="…or paste CSV text" hint="Columns: email, join_time, leave_time. Times without a timezone are read as IST.">
              {(id, d) => <Textarea id={id} aria-describedby={d} value={text} onChange={(e) => setText(e.target.value)} placeholder={"email,join_time,leave_time\nasha@gmail.com,2026-11-05 13:02:10,2026-11-05 14:20:00"} className="min-h-24 font-mono text-xs" />}
            </Field>

            {parsed?.headerError ? (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-[13px] text-critical-text">
                <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {parsed.headerError}
              </p>
            ) : parsed ? (
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-3 text-[13px]">
                  <span className="font-semibold">{parsed.rows.length} rows</span>
                  <span className="text-good-text">{valid.length} ready</span>
                  {invalid.length ? <span className="text-critical-text">{invalid.length} will be skipped</span> : null}
                </div>
                <div className="scroll-thin max-h-56 overflow-auto rounded-lg border border-line">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-surface-2 text-left text-ink-3">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Line</th>
                        <th className="px-3 py-2 font-semibold">Email</th>
                        <th className="px-3 py-2 font-semibold">Joined (IST)</th>
                        <th className="px-3 py-2 font-semibold">Left (IST)</th>
                        <th className="px-3 py-2 font-semibold">Check</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 50).map((r) => (
                        <tr key={r.line} className="border-t border-line">
                          <td className="tnum px-3 py-1.5 text-ink-3">{r.line}</td>
                          <td className="px-3 py-1.5">{r.email || "—"}</td>
                          <td className="tnum px-3 py-1.5">{r.join_time ? formatISTPattern(r.join_time, "h:mm:ss a") : "—"}</td>
                          <td className="tnum px-3 py-1.5">{r.leave_time ? formatISTPattern(r.leave_time, "h:mm:ss a") : "still in"}</td>
                          <td className="px-3 py-1.5">{r.error ? <span className="text-critical-text">{r.error}</span> : <span className="text-good-text">OK</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsed.rows.length > 50 ? <p className="mt-1.5 text-xs text-ink-3">Showing the first 50 rows. All {parsed.rows.length} will be processed.</p> : null}
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={valid.length === 0} onClick={run}>
                Import {valid.length || ""} {valid.length === 1 ? "row" : "rows"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span className="font-medium">{phase === "importing" ? "Sending to the backend…" : "Import finished"}</span>
                <span className="tnum text-ink-3">
                  {progress} of {valid.length}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={valid.length} aria-valuenow={progress} aria-label="Import progress">
                <div className="h-full rounded-full bg-s1 transition-[width] duration-300" style={{ width: `${valid.length ? (progress / valid.length) * 100 : 0}%` }} />
              </div>
            </div>
            {phase === "done" ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Tally label="Recorded" n={count("recorded")} tone="good" />
                <Tally label="Already there" n={count("duplicate")} tone="neutral" />
                <Tally label="No matching registrant" n={count("unmatched")} tone="warn" />
                <Tally label="Failed / skipped" n={count("failed")} tone="bad" />
              </div>
            ) : null}
            <div className="scroll-thin max-h-64 overflow-auto rounded-lg border border-line">
              <ul className="divide-y divide-line text-xs">
                {results.map((r) => (
                  <li key={r.row.line} className="flex items-center gap-2 px-3 py-1.5">
                    {r.state === "recorded" ? <CheckCircle2 className="size-3.5 shrink-0 text-good-text" aria-hidden /> : r.state === "failed" ? <XCircle className="size-3.5 shrink-0 text-critical-text" aria-hidden /> : <TriangleAlert className="size-3.5 shrink-0 text-ink-3" aria-hidden />}
                    <span className="tnum w-8 shrink-0 text-ink-3">#{r.row.line}</span>
                    <span className="min-w-0 flex-1 truncate">{r.row.email || "—"}</span>
                    <span className="shrink-0 text-ink-3">{r.message}</span>
                  </li>
                ))}
              </ul>
            </div>
            {phase === "done" ? (
              <DialogFooter>
                <Button variant="secondary" onClick={reset}>
                  Import another
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    onOpenChange(false);
                    setTimeout(reset, 200);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Tally({ label, n, tone }: { label: string; n: number; tone: "good" | "neutral" | "warn" | "bad" }) {
  return (
    <div className={cn("rounded-xl border px-3 py-2.5", tone === "good" && "border-good/30 bg-good/10", tone === "warn" && "border-warning/50 bg-warning/15", tone === "bad" && "border-critical/30 bg-critical/10", tone === "neutral" && "border-line bg-surface-2")}>
      <div className="tnum text-xl font-semibold">{n}</div>
      <div className="text-[11.5px] leading-tight text-ink-2">{label}</div>
    </div>
  );
}

// ======================================================================== log call

const callSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter the invitee's email"),
  scheduled_for: z.string().min(1, "When is the call?"),
  source: z.string().min(1),
});
type CallValues = z.infer<typeof callSchema>;

export function LogCallDialog({ open, onOpenChange, webinarId }: { open: boolean; onOpenChange: (o: boolean) => void; webinarId: number }) {
  const log = useLogCall();
  const suggestions = useRegistrants({ webinar_id: webinarId, segment: "stayed_till_offer", page_size: 6 });
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CallValues>({
    resolver: zodResolver(callSchema),
    defaultValues: { email: "", scheduled_for: formatISTPattern(new Date(simNow() + 2 * 86400000).toISOString(), "yyyy-MM-dd'T'11:00"), source: "cal_com" },
  });
  const submit = handleSubmit(async (v) => {
    const out = await log.mutateAsync({ email: v.email, webinar_id: webinarId, scheduled_for: fromZonedTime(v.scheduled_for, IST).toISOString(), source: v.source });
    if (out.matched) {
      reset();
      onOpenChange(false);
    }
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Log a booked call" description="Use this when a call was booked outside Cal.com or Calendly. It stops the person's follow-up sequence.">
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label="Invitee email" error={errors.email?.message}>
            {(id, d) => <Input id={id} type="email" autoComplete="off" aria-describedby={d} aria-invalid={!!errors.email} placeholder="asha.sharma@gmail.com" {...register("email")} />}
          </Field>
          {suggestions.data?.rows.length ? (
            <div>
              <p className="mb-1.5 text-xs text-ink-3">Stayed till the pitch, tap to fill:</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.data.rows.map((r) => (
                  <button key={r.registrant_id} type="button" onClick={() => setValue("email", r.email, { shouldValidate: true })} className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs hover:bg-surface-3">
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Call time (IST)" error={errors.scheduled_for?.message}>
              {(id, d) => <Input id={id} type="datetime-local" aria-describedby={d} {...register("scheduled_for")} />}
            </Field>
            <Field label="Booked via">
              {(id) => (
                <Select id={id} {...register("source")}>
                  <option value="cal_com">Cal.com</option>
                  <option value="calendly">Calendly</option>
                  <option value="phone">Phone / DM</option>
                  <option value="generic">Other</option>
                </Select>
              )}
            </Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={log.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={log.isPending}>
              Log call
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ======================================================================== add registrant

const regSchema = z
  .object({
    name: z.string().trim().min(2, "Add a name"),
    email: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    utm_source: z.string(),
  })
  .superRefine((v, ctx) => {
    const emailOk = !!v.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email);
    const phoneOk = !!v.phone && !!normalizePhone(v.phone);
    if (v.email && !emailOk) ctx.addIssue({ code: "custom", path: ["email"], message: "That email does not look right" });
    if (v.phone && !phoneOk) ctx.addIssue({ code: "custom", path: ["phone"], message: "Use an Indian mobile number, e.g. 98765 43210" });
    if (!emailOk && !phoneOk && !v.email && !v.phone) ctx.addIssue({ code: "custom", path: ["email"], message: "Add an email or an Indian mobile number" });
  });
type RegValues = z.infer<typeof regSchema>;

export function AddRegistrantDialog({ open, onOpenChange, webinarId }: { open: boolean; onOpenChange: (o: boolean) => void; webinarId: number }) {
  const reg = useRegister();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegValues>({ resolver: zodResolver(regSchema), defaultValues: { name: "", email: "", phone: "", utm_source: "manual" } });
  const submit = handleSubmit(async (v) => {
    const out = await reg.mutateAsync({
      webinar_id: webinarId,
      name: v.name,
      email: v.email,
      phone: v.phone,
      utm_source: v.utm_source === "manual" ? undefined : v.utm_source,
      utm_medium: v.utm_source === "manual" ? undefined : "bio",
      source: "manual",
    });
    if (!out.duplicate) {
      reset();
      onOpenChange(false);
    }
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add a registrant" description="For people who signed up outside the landing page, such as a DM or a phone call.">
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label="Full name" error={errors.name?.message}>
            {(id, d) => <Input id={id} autoComplete="off" aria-describedby={d} aria-invalid={!!errors.name} {...register("name")} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" error={errors.email?.message}>
              {(id, d) => <Input id={id} type="email" autoComplete="off" aria-describedby={d} aria-invalid={!!errors.email} {...register("email")} />}
            </Field>
            <Field label="Mobile (+91)" error={errors.phone?.message}>
              {(id, d) => (
                <div className="flex">
                  <span className="inline-flex h-9 items-center rounded-l-lg border border-r-0 border-line bg-surface-2 px-3 text-sm text-ink-3">+91</span>
                  <Input id={id} inputMode="tel" autoComplete="off" aria-describedby={d} aria-invalid={!!errors.phone} placeholder="98765 43210" className="rounded-l-none" {...register("phone")} />
                </div>
              )}
            </Field>
          </div>
          <Field label="Where did they come from?">
            {(id) => (
              <Select id={id} {...register("utm_source")}>
                <option value="manual">Added by hand</option>
                <option value="instagram_bio">Instagram bio</option>
                <option value="youtube">YouTube</option>
                <option value="whatsapp_community">WhatsApp community</option>
                <option value="email_newsletter">Email newsletter</option>
              </Select>
            )}
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={reg.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={reg.isPending}>
              Add registrant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
