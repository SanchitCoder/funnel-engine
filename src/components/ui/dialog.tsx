"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

function Overlay() {
  return <RadixDialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />;
}

function CloseButton() {
  return (
    <RadixDialog.Close asChild>
      <Button variant="ghost" size="icon" className="absolute right-3 top-3 size-8" aria-label="Close">
        <X />
      </Button>
    </RadixDialog.Close>
  );
}

export function DialogContent({
  title,
  description,
  children,
  className,
  wide,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <RadixDialog.Portal>
      <Overlay />
      <RadixDialog.Content
        className={cn(
          "anim-dialog fixed left-1/2 top-1/2 z-50 flex max-h-[min(90dvh,860px)] w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-line bg-surface shadow-2xl outline-none",
          wide ? "max-w-3xl" : "max-w-lg",
          className,
        )}
      >
        <div className="border-b border-line px-6 py-4 pr-14">
          <RadixDialog.Title className="text-base font-semibold tracking-tight">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="mt-1 text-[13px] text-ink-3">{description}</RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          )}
        </div>
        <CloseButton />
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export function SheetContent({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Portal>
      <Overlay />
      <RadixDialog.Content
        className={cn(
          "anim-sheet fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col border-l border-line bg-surface shadow-2xl outline-none",
          className,
        )}
      >
        <div className="border-b border-line px-6 py-4 pr-14">
          <RadixDialog.Title className="text-base font-semibold tracking-tight">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="mt-1 text-[13px] text-ink-3">{description}</RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          )}
        </div>
        <CloseButton />
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-wrap items-center justify-end gap-2">{children}</div>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending,
  tone = "primary",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  tone?: "primary" | "danger";
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
