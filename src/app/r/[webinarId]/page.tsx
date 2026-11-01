"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, CheckCircle2, Clock, Download, ShieldCheck, Video } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/states";
import { buildIcs, downloadIcs, googleCalendarUrl } from "@/lib/calendar";
import { formatISTPattern, normalizePhone } from "@/lib/format";
import { usePublicWebinar, useRegister } from "@/lib/hooks";
import { COACH } from "@/lib/mock/config";

const schema = z.object({
  name: z.string().trim().min(2, "Tell us your name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().refine((v) => !!normalizePhone(v), "Enter a 10-digit Indian mobile number"),
  consent: z.boolean().refine((v) => v === true, "Please tick this so we can send your reminders"),
});
type Values = z.infer<typeof schema>;

const TRACKED = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ad_id", "adset_id", "campaign_id"] as const;

export default function PublicRegistrationPage() {
  return (
    <Suspense>
      <RegistrationView />
    </Suspense>
  );
}

function RegistrationView() {
  const { webinarId } = useParams<{ webinarId: string }>();
  const wid = Number(webinarId);
  const qs = useSearchParams();
  const webinar = usePublicWebinar(wid);
  const register = useRegister({ toast: false });
  const [done, setDone] = useState<null | { name: string; duplicate: boolean }>(null);
  const attempts = useRef<number[]>([]);

  const tracking = Object.fromEntries(TRACKED.map((k) => [k, qs.get(k) ?? ""]).filter(([, v]) => v)) as Record<(typeof TRACKED)[number], string>;

  const {
    register: field,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", phone: "", consent: false } });

  const onSubmit = handleSubmit(async (v) => {
    // sample of the public handler's rate limit: 5 attempts a minute per visitor
    const now = Date.now();
    attempts.current = attempts.current.filter((t) => now - t < 60_000);
    if (attempts.current.length >= 5) {
      toast.error("Too many attempts. Please wait a minute and try again.");
      return;
    }
    attempts.current.push(now);
    try {
      const out = await register.mutateAsync({
        webinar_id: wid,
        name: v.name,
        email: v.email,
        phone: v.phone,
        source: "landing_page",
        consent: true,
        ...tracking,
      });
      setDone({ name: v.name.split(" ")[0], duplicate: out.duplicate });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't save your registration. Please try again.");
    }
  });

  return (
    <div className="min-h-dvh bg-page">
      <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-5 pb-10 pt-6 sm:pt-12">
        <header className="mb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-surface">AV</div>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold">{COACH.name}</p>
            <p className="text-[13px] text-ink-3">{COACH.brand}</p>
          </div>
        </header>

        {webinar.isPending ? (
          <div className="space-y-4" aria-busy>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-64" />
          </div>
        ) : webinar.error || !webinar.data ? (
          <div role="alert" className="rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
            <p className="text-lg font-semibold">We can&apos;t find that webinar</p>
            <p className="mt-2 text-[14px] text-ink-3">The link may be old or mistyped. Ask the host for the latest one.</p>
          </div>
        ) : webinar.data.status === "closed" || webinar.data.status === "cancelled" ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
            <p className="text-lg font-semibold">Registration has closed</p>
            <p className="mt-2 text-[14px] text-ink-3">This session has already happened. Follow {COACH.name} to catch the next one.</p>
          </div>
        ) : done ? (
          <ThankYou name={done.name} duplicate={done.duplicate} webinar={webinar.data} />
        ) : (
          <>
            <div className="mb-6">
              <p className="eyebrow mb-3">Free live training</p>
              <h1 className="text-[28px] font-semibold leading-[1.12] tracking-[-0.025em] sm:text-[34px]">{webinar.data.title.split(" — ")[0]}</h1>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-ink-2">
                <span className="inline-flex items-center gap-2">
                  <CalendarPlus className="size-4 text-accent" aria-hidden />
                  {formatISTPattern(webinar.data.scheduled_at, "EEEE d MMMM")}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock className="size-4 text-accent" aria-hidden />
                  {formatISTPattern(webinar.data.scheduled_at, "h:mm a")} IST · {webinar.data.duration_minutes} min
                </span>
                <span className="inline-flex items-center gap-2">
                  <Video className="size-4 text-accent" aria-hidden />
                  Live on Zoom
                </span>
              </div>
            </div>

            <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
              <Field label="Your name" error={errors.name?.message}>
                {(id, d) => <Input id={id} autoComplete="name" aria-describedby={d} aria-invalid={!!errors.name} className="h-11 text-base" placeholder="Asha Sharma" {...field("name")} />}
              </Field>
              <Field label="Email" error={errors.email?.message}>
                {(id, d) => <Input id={id} type="email" autoComplete="email" inputMode="email" aria-describedby={d} aria-invalid={!!errors.email} className="h-11 text-base" placeholder="asha@gmail.com" {...field("email")} />}
              </Field>
              <Field label="WhatsApp number" error={errors.phone?.message} hint="We send your joining link and reminders here.">
                {(id, d) => (
                  <div className="flex">
                    <span className="inline-flex h-11 items-center rounded-l-lg border border-r-0 border-line bg-surface-2 px-3 text-base text-ink-2">+91</span>
                    <Input id={id} type="tel" autoComplete="tel-national" inputMode="tel" aria-describedby={d} aria-invalid={!!errors.phone} className="h-11 rounded-l-none text-base" placeholder="98765 43210" {...field("phone")} />
                  </div>
                )}
              </Field>
              <div>
                <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-snug text-ink-2">
                  <Checkbox className="mt-0.5 size-5" aria-invalid={!!errors.consent} aria-describedby="consent-error" {...field("consent")} />
                  <span>I agree to get my joining link, reminders and occasional offers from {COACH.name} on WhatsApp and email. I can reply STOP at any time.</span>
                </label>
                {errors.consent ? (
                  <p id="consent-error" role="alert" className="mt-1.5 text-xs text-critical-text">
                    {errors.consent.message}
                  </p>
                ) : null}
              </div>
              <Button type="submit" variant="primary" size="lg" className="w-full" loading={register.isPending}>
                Save my seat
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-3">
                <ShieldCheck className="size-3.5" aria-hidden /> Free. No spam. Your details stay with {COACH.name}.
              </p>
            </form>

            {Object.keys(tracking).length > 0 ? (
              <details className="mt-5 rounded-xl border border-dashed border-line px-4 py-3 text-xs text-ink-3">
                <summary className="cursor-pointer font-medium text-ink-2">Sample mode: tracking captured from this link</summary>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  {Object.entries(tracking).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="font-mono">{k}</dt>
                      <dd className="break-all font-mono text-ink-2">{v}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function ThankYou({ name, duplicate, webinar }: { name: string; duplicate: boolean; webinar: NonNullable<ReturnType<typeof usePublicWebinar>["data"]> }) {
  const title = webinar.title.split(" — ")[0];
  const details = `Live training with ${COACH.name}. ${COACH.brand}.`;
  const gcal = googleCalendarUrl({ title, startIso: webinar.scheduled_at, durationMin: webinar.duration_minutes, details, url: webinar.join_url });
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-card sm:p-8" role="status" aria-live="polite">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-good/12 text-good-text">
        <CheckCircle2 className="size-8" aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{duplicate ? `You're already in, ${name}.` : `You're in, ${name}!`}</h1>
      <p className="mt-2 text-[15px] text-ink-2">{title}</p>
      <p className="tnum mt-1 text-[15px] font-semibold">
        {formatISTPattern(webinar.scheduled_at, "EEEE d MMMM, h:mm a")} IST
      </p>
      <div className="mt-6 grid gap-2.5">
        <a href={gcal} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-[15px] font-medium text-surface hover:bg-ink/85">
          <CalendarPlus className="size-4" aria-hidden /> Add to Google Calendar
        </a>
        <Button variant="secondary" size="lg" onClick={() => downloadIcs("webinar.ics", buildIcs({ uid: String(webinar.id), title, startIso: webinar.scheduled_at, durationMin: webinar.duration_minutes, details, url: webinar.join_url }))}>
          <Download /> Apple / Outlook calendar (.ics)
        </Button>
      </div>
      <p className="mt-6 text-[13px] leading-relaxed text-ink-3">We&apos;ll message you on WhatsApp a day before, an hour before and 10 minutes before, each with your joining link.</p>
    </div>
  );
}
