"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { fromZonedTime } from "date-fns-tz";
import { Check, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FollowupBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { simNow } from "@/lib/clock";
import { formatINR, formatISTPattern, formatISTShort, IST } from "@/lib/format";
import { useManualPayment, useRegistrants } from "@/lib/hooks";
import { OFFER } from "@/lib/mock/config";
import type { RegistrantRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const schema = z.object({
  amount_inr: z.number({ error: "Enter the amount" }).positive("Amount must be more than ₹0").max(1_000_000, "That looks too large"),
  paid_at: z.string().min(1, "When was it paid?"),
  note: z.string().trim().max(200, "Keep the note under 200 characters").optional(),
});
type Values = z.infer<typeof schema>;

export function ManualPaymentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const pay = useManualPayment();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [person, setPerson] = useState<RegistrantRow | null>(null);
  const [review, setReview] = useState<Values | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const results = useRegistrants({ search: debounced || "·none·", page_size: 6 });
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { amount_inr: OFFER.price, paid_at: formatISTPattern(new Date(simNow()).toISOString(), "yyyy-MM-dd'T'HH:mm"), note: "" },
  });
  const amount = watch("amount_inr");

  const close = () => {
    onOpenChange(false);
    setTimeout(() => {
      setSearch("");
      setPerson(null);
      setReview(null);
      reset();
    }, 200);
  };

  const confirm = async () => {
    if (!person || !review) return;
    await pay.mutateAsync({ registrant_id: person.registrant_id, amount_inr: review.amount_inr, paid_at: fromZonedTime(review.paid_at, IST).toISOString(), note: review.note || undefined });
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent title={review ? "Review and record" : "Record a manual payment"} description={review ? "Nothing is saved until you confirm." : "For UPI or bank transfers that did not come through Razorpay. The person's follow-up sequence stops straight away."}>
        {review && person ? (
          <div className="space-y-4">
            <dl className="divide-y divide-line rounded-xl border border-line text-[13.5px]">
              <Row k="Person" v={`${person.name} · ${person.email}`} />
              <Row k="Webinar" v={person.webinar_title} />
              <Row k="Amount" v={formatINR(review.amount_inr)} strong />
              <Row k="Paid on" v={`${formatISTPattern(fromZonedTime(review.paid_at, IST).toISOString(), "d MMM yyyy, h:mm a")} IST`} />
              <Row k="Provider" v="manual (no signature check)" />
              {review.note ? <Row k="Note" v={review.note} /> : null}
            </dl>
            <p className="text-[13px] text-ink-3">This counts toward revenue and ROAS, and moves {person.name.split(" ")[0]} to <strong className="text-ink-2">Purchased</strong>, which stops any remaining messages.</p>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setReview(null)} disabled={pay.isPending}>
                Back
              </Button>
              <Button variant="primary" onClick={confirm} loading={pay.isPending}>
                Record payment
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            noValidate
            className="space-y-4"
            onSubmit={handleSubmit((v) => {
              if (!person) return;
              setReview(v);
            })}
          >
            <Field label="Who paid?" hint={!person ? "Search by name, email or phone." : undefined}>
              {(id, d) =>
                person ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2">
                    <div className="min-w-0 text-[13.5px]">
                      <p className="truncate font-medium">{person.name}</p>
                      <p className="truncate text-xs text-ink-3">
                        {person.email} · {formatISTShort(person.webinar_date)}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setPerson(null)}>
                      Change
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-ink-3" aria-hidden />
                      <Input id={id} aria-describedby={d} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Asha Sharma" autoComplete="off" />
                    </div>
                    {debounced ? (
                      <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line" role="listbox" aria-label="Matching people">
                        {results.data?.rows.length ? (
                          results.data.rows.map((r) => (
                            <li key={r.registrant_id}>
                              <button type="button" role="option" aria-selected={false} onClick={() => setPerson(r)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface-2">
                                <span className="min-w-0">
                                  <span className="block truncate text-[13.5px] font-medium">{r.name}</span>
                                  <span className="block truncate text-xs text-ink-3">
                                    {r.email} · {formatISTShort(r.webinar_date)}
                                  </span>
                                </span>
                                <FollowupBadge status={r.followup_status} />
                              </button>
                            </li>
                          ))
                        ) : (
                          <li className="px-3 py-3 text-[13px] text-ink-3">{results.isFetching ? "Searching…" : "No one matches that."}</li>
                        )}
                      </ul>
                    ) : null}
                  </div>
                )
              }
            </Field>

            <Field label="Amount (₹)" error={errors.amount_inr?.message}>
              {(id, d) => (
                <div>
                  <Input id={id} type="number" inputMode="numeric" aria-describedby={d} aria-invalid={!!errors.amount_inr} {...register("amount_inr", { valueAsNumber: true })} />
                  <div className="mt-2 flex gap-2">
                    {[
                      { label: `Standard ${formatINR(OFFER.price)}`, v: OFFER.price },
                      { label: `VIP ${formatINR(OFFER.vipPrice)}`, v: OFFER.vipPrice },
                    ].map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setValue("amount_inr", o.v, { shouldValidate: true })}
                        className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs", amount === o.v ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-2 hover:bg-surface-3")}
                      >
                        {amount === o.v ? <Check className="size-3" aria-hidden /> : null}
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Field>
            <Field label="Paid on (IST)" error={errors.paid_at?.message}>
              {(id, d) => <Input id={id} type="datetime-local" aria-describedby={d} {...register("paid_at")} />}
            </Field>
            <Field label="Note" error={errors.note?.message} hint="Optional. For example the UPI reference.">
              {(id, d) => <Textarea id={id} aria-describedby={d} className="min-h-16" {...register("note")} />}
            </Field>
            <DialogFooter>
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={!person}>
                Review
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <dt className="shrink-0 text-ink-3">{k}</dt>
      <dd className={cn("text-right", strong && "tnum text-base font-semibold")}>{v}</dd>
    </div>
  );
}
