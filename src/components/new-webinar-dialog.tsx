"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { CalendarClock, Info } from "lucide-react";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { simNow } from "@/lib/clock";
import { deriveTimeSlot, formatISTPattern, formatPct, IST, slotLabel } from "@/lib/format";
import { useCreateWebinar, useTrends } from "@/lib/hooks";
import { OFFER, TOPICS } from "@/lib/mock/config";

const schema = z
  .object({
    title: z.string().trim().min(3, "Give the webinar a title (at least 3 characters)"),
    topic: z.string().min(1, "Pick a topic"),
    scheduled_at: z.string().min(1, "Pick a date and time (IST)"),
    platform: z.string().min(1),
    platform_webinar_id: z.string().trim().optional(),
    pitch_start_minute: z.number({ error: "Enter the pitch minute" }).int().min(0, "Cannot be negative").max(300),
    duration_minutes: z.number({ error: "Enter the duration" }).int().min(15, "At least 15 minutes").max(360),
    offer_name: z.string().trim().min(2, "Name the offer"),
    offer_price: z.number({ error: "Enter the price" }).min(0, "Cannot be negative"),
  })
  .refine((v) => v.pitch_start_minute < v.duration_minutes, { path: ["pitch_start_minute"], message: "The pitch must start before the webinar ends" })
  .refine((v) => !Number.isNaN(Date.parse(v.scheduled_at)), { path: ["scheduled_at"], message: "That is not a valid date" });

type FormValues = z.infer<typeof schema>;

function defaultStart(): string {
  const d = addDays(new Date(simNow()), 7);
  return `${formatInTimeZone(d, IST, "yyyy-MM-dd")}T19:00`;
}

export function NewWebinarDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (id: number) => void }) {
  const create = useCreateWebinar();
  const trends = useTrends();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      topic: TOPICS[0],
      scheduled_at: defaultStart(),
      platform: "zoom",
      platform_webinar_id: "",
      pitch_start_minute: 60,
      duration_minutes: 90,
      offer_name: OFFER.name,
      offer_price: OFFER.price,
    },
  });

  const values = useWatch({ control });
  const preview = useMemo(() => {
    if (!values.scheduled_at) return null;
    const utc = fromZonedTime(values.scheduled_at, IST);
    if (Number.isNaN(utc.getTime())) return null;
    const iso = utc.toISOString();
    const slot = deriveTimeSlot(iso);
    const dur = Number(values.duration_minutes) || 0;
    const pitch = Number(values.pitch_start_minute) || 0;
    const history = trends.data?.dims.time_slot.find((t) => t.dimension_value === slot);
    return {
      iso,
      slot,
      start: formatISTPattern(iso, "EEEE d MMM, h:mm a"),
      pitchAt: formatISTPattern(new Date(utc.getTime() + pitch * 60000).toISOString(), "h:mm a"),
      endsAt: formatISTPattern(new Date(utc.getTime() + dur * 60000).toISOString(), "h:mm a"),
      history,
    };
  }, [values.scheduled_at, values.duration_minutes, values.pitch_start_minute, trends.data]);

  const onSubmit = handleSubmit(async (v) => {
    const iso = fromZonedTime(v.scheduled_at, IST).toISOString();
    const out = await create.mutateAsync({
      title: v.title,
      topic: v.topic,
      scheduled_at: iso,
      platform: v.platform,
      platform_webinar_id: v.platform_webinar_id || undefined,
      pitch_start_minute: v.pitch_start_minute,
      duration_minutes: v.duration_minutes,
      offer_name: v.offer_name,
      offer_price: v.offer_price,
    });
    reset();
    onOpenChange(false);
    onCreated?.(out.ids.webinar_id);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New webinar" description="Times are in IST. The time slot is derived the same way the backend derives it." wide>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" error={errors.title?.message} className="sm:col-span-2">
              {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.title} placeholder="Pricing Your Coaching Offer — Round 4" {...register("title")} />}
            </Field>
            <Field label="Topic" error={errors.topic?.message}>
              {(id, d) => (
                <Select id={id} aria-describedby={d} {...register("topic")}>
                  {TOPICS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Starts (IST)" error={errors.scheduled_at?.message}>
              {(id, d) => <Input id={id} type="datetime-local" step={900} aria-describedby={d} aria-invalid={!!errors.scheduled_at} {...register("scheduled_at")} />}
            </Field>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-accent/25 bg-accent-soft px-4 py-3" aria-live="polite">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            <div className="min-w-0 text-[13px]">
              {preview ? (
                <>
                  <p className="font-semibold text-ink">
                    Time slot <span className="tnum rounded-md bg-surface px-1.5 py-0.5 font-mono text-[12px]">{preview.slot}</span>
                    <span className="ml-2 font-normal text-ink-2">{slotLabel(preview.slot)}</span>
                  </p>
                  <p className="mt-1 text-ink-2">
                    {preview.start} IST · pitch at {preview.pitchAt} · ends {preview.endsAt}
                  </p>
                  <p className="mt-1.5 flex items-start gap-1.5 text-ink-3">
                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {preview.history
                      ? `This slot has averaged ${formatPct(preview.history.avg_show_up_pct, 0)} show-up across ${preview.history.webinars_count} past webinar${preview.history.webinars_count > 1 ? "s" : ""}.`
                      : "You have not run a webinar in this slot yet, so it is a fresh test."}
                  </p>
                </>
              ) : (
                <p className="text-ink-3">Pick a start time to preview the slot.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Platform">
              {(id) => (
                <Select id={id} {...register("platform")}>
                  <option value="zoom">Zoom</option>
                  <option value="gmeet">Google Meet</option>
                  <option value="webinarjam">WebinarJam</option>
                  <option value="other">Other</option>
                </Select>
              )}
            </Field>
            <Field label="Pitch starts (min)" error={errors.pitch_start_minute?.message}>
              {(id, d) => <Input id={id} type="number" inputMode="numeric" aria-describedby={d} aria-invalid={!!errors.pitch_start_minute} {...register("pitch_start_minute", { valueAsNumber: true })} />}
            </Field>
            <Field label="Duration (min)" error={errors.duration_minutes?.message}>
              {(id, d) => <Input id={id} type="number" inputMode="numeric" aria-describedby={d} aria-invalid={!!errors.duration_minutes} {...register("duration_minutes", { valueAsNumber: true })} />}
            </Field>
            <Field label="Platform webinar ID" hint="Optional. Used to match Zoom events." className="sm:col-span-1">
              {(id, d) => <Input id={id} aria-describedby={d} placeholder="84521769034" {...register("platform_webinar_id")} />}
            </Field>
            <Field label="Offer" error={errors.offer_name?.message} className="sm:col-span-1">
              {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.offer_name} {...register("offer_name")} />}
            </Field>
            <Field label="Offer price (₹)" error={errors.offer_price?.message}>
              {(id, d) => <Input id={id} type="number" inputMode="numeric" aria-describedby={d} aria-invalid={!!errors.offer_price} {...register("offer_price", { valueAsNumber: true })} />}
            </Field>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={create.isPending}>
              Create webinar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
