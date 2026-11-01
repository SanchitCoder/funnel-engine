"use client";

import { Copy, Eye, EyeOff, MessageCircle, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";
import { formatPhone, maskPhone } from "@/lib/format";

export async function copyText(text: string, label = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label}: ${text}`);
  } catch {
    toast.error("Couldn't copy. Select the text and copy it manually.");
  }
}

/** Phones are masked until someone clicks to reveal. */
export function MaskedPhone({ phone, className }: { phone: string; className?: string }) {
  const [shown, setShown] = useState(false);
  if (!phone) return <span className="text-ink-3">—</span>;
  return (
    <button
      type="button"
      onClick={() => setShown((s) => !s)}
      aria-label={shown ? "Hide phone number" : "Reveal phone number"}
      className={`group inline-flex items-center gap-1.5 rounded-md text-left tnum text-ink-2 hover:text-ink ${className ?? ""}`}
    >
      <span>{shown ? formatPhone(phone) : maskPhone(phone)}</span>
      {shown ? <EyeOff className="size-3.5 text-ink-3" aria-hidden /> : <Eye className="size-3.5 text-ink-3 opacity-60 group-hover:opacity-100" aria-hidden />}
    </button>
  );
}

export function PersonActions({
  name,
  phone,
  email,
  message,
}: {
  name: string;
  phone: string;
  email: string;
  message?: string;
}) {
  const first = name.split(" ")[0];
  const text = encodeURIComponent(message ?? `Hi ${first}, this is Ankit from Scale Your Coaching Business. `);
  const wa = phone ? `https://wa.me/${phone.replace(/\D/g, "")}?text=${text}` : null;
  return (
    <div className="flex items-center gap-1">
      {wa ? (
        <Tip content="WhatsApp">
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`WhatsApp ${name}`}
            className="inline-flex size-8 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <MessageCircle className="size-4" />
          </a>
        </Tip>
      ) : null}
      {phone ? (
        <Tip content="Call">
          <a
            href={`tel:${phone}`}
            aria-label={`Call ${name}`}
            className="inline-flex size-8 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <Phone className="size-4" />
          </a>
        </Tip>
      ) : null}
      {email ? (
        <Tip content="Copy email">
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Copy email of ${name}`} onClick={() => copyText(email, "Email copied")}>
            <Copy />
          </Button>
        </Tip>
      ) : null}
    </div>
  );
}
