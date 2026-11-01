import { AlertTriangle, Inbox, RotateCw, type LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton rounded-lg", className)} aria-hidden {...props} />;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-surface-3 text-ink-3">
        <Icon className="size-5" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-sm text-[13px] text-ink-3">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Couldn't load this",
  error,
  onRetry,
  className,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Something went wrong while loading.";
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-critical/10 text-critical-text">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-[13px] text-ink-3">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">
          <RotateCw /> Try again
        </Button>
      ) : null}
    </div>
  );
}
