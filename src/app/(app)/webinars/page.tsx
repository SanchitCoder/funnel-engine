"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { GitCompareArrows, Plus, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { CompareDialog } from "@/components/compare-dialog";
import { DataTable } from "@/components/data-table";
import { NewWebinarDialog } from "@/components/new-webinar-dialog";
import { PageHeader } from "@/components/page-header";
import { WebinarStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Input } from "@/components/ui/form";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tip } from "@/components/ui/tooltip";
import { formatINRCompact, formatISTPattern, formatNumber, formatPct, formatRoas, slotLabel } from "@/lib/format";
import { useWebinars } from "@/lib/hooks";
import type { WebinarStatus, WebinarWithMetrics } from "@/lib/types";

export default function WebinarsPage() {
  return (
    <Suspense>
      <WebinarsView />
    </Suspense>
  );
}

function WebinarsView() {
  const router = useRouter();
  const params = useSearchParams();
  const { data, isPending, error, refetch } = useWebinars();
  const [status, setStatus] = useState<"all" | WebinarStatus>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(params.get("new") === "1");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? [])
      .filter((w) => status === "all" || w.status === status)
      .filter((w) => !q || w.title.toLowerCase().includes(q) || w.topic.toLowerCase().includes(q) || w.time_slot.toLowerCase().includes(q))
      .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
  }, [data, status, query]);

  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));
  const chosen = (data ?? []).filter((w) => selected.includes(w.id)).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

  const columns = useMemo<ColumnDef<WebinarWithMetrics, unknown>[]>(
    () => [
      {
        id: "select",
        header: () => <span className="sr-only">Select to compare</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const w = row.original;
          const checked = selected.includes(w.id);
          const full = selected.length >= 4 && !checked;
          return (
            <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <Tip content={full ? "Compare up to 4 webinars" : "Select to compare"}>
                <span>
                  <Checkbox checked={checked} disabled={full} onChange={() => toggle(w.id)} aria-label={`Select ${w.title} to compare`} />
                </span>
              </Tip>
            </span>
          );
        },
      },
      {
        id: "title",
        header: "Webinar",
        accessorFn: (w) => w.title,
        cell: ({ row }) => (
          <div className="min-w-[220px]">
            <p className="font-medium leading-snug">{row.original.title}</p>
            <p className="mt-0.5 text-xs text-ink-3">{row.original.topic}</p>
          </div>
        ),
      },
      {
        id: "date",
        header: "When (IST)",
        accessorFn: (w) => w.scheduled_at,
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <p>{formatISTPattern(row.original.scheduled_at, "EEE d MMM")}</p>
            <p className="mt-0.5 text-xs text-ink-3">{slotLabel(row.original.time_slot).split("· ")[1]}</p>
          </div>
        ),
      },
      { id: "status", header: "Status", accessorFn: (w) => w.status, cell: ({ row }) => <WebinarStatusBadge status={row.original.status} /> },
      { id: "regs", header: "Registered", meta: { align: "right" }, accessorFn: (w) => w.metrics.registrations, cell: ({ row }) => formatNumber(row.original.metrics.registrations) },
      { id: "show", header: "Show-up", meta: { align: "right" }, accessorFn: (w) => w.metrics.show_up_pct ?? -1, cell: ({ row }) => (row.original.status === "scheduled" ? "—" : formatPct(row.original.metrics.show_up_pct, 1)) },
      { id: "sales", header: "Sales", meta: { align: "right" }, accessorFn: (w) => w.metrics.sales_count, cell: ({ row }) => (row.original.status === "scheduled" ? "—" : formatNumber(row.original.metrics.sales_count)) },
      { id: "rev", header: "Revenue", meta: { align: "right" }, accessorFn: (w) => w.metrics.revenue_inr, cell: ({ row }) => (row.original.status === "scheduled" ? "—" : formatINRCompact(row.original.metrics.revenue_inr)) },
      { id: "roas", header: "ROAS", meta: { align: "right" }, accessorFn: (w) => w.metrics.roas ?? -1, cell: ({ row }) => (row.original.status === "closed" ? formatRoas(row.original.metrics.roas) : "—") },
    ],
    [selected],
  );

  return (
    <>
      <PageHeader
        eyebrow="Webinars"
        title="Every webinar, side by side"
        description="Open one for the full funnel, or tick two to four and compare them."
        actions={
          <>
            <Button variant="secondary" disabled={selected.length < 2} onClick={() => setCompareOpen(true)}>
              <GitCompareArrows /> Compare{selected.length ? ` (${selected.length})` : ""}
            </Button>
            <Button variant="primary" onClick={() => setNewOpen(true)}>
              <Plus /> New webinar
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
              <TabsTrigger value="live">Live</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-ink-3" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, topic or slot" className="pl-9" aria-label="Search webinars" />
          </div>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : (
          <DataTable
            caption="Webinars"
            columns={columns}
            data={rows}
            isLoading={isPending}
            onRowClick={(w) => router.push(`/webinars/${w.id}`)}
            empty={
              <EmptyState
                title={query || status !== "all" ? "No webinars match" : "No webinars yet"}
                description={query || status !== "all" ? "Try a different status or clear the search." : "Create your first webinar to start tracking the funnel."}
                action={
                  query || status !== "all" ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setQuery("");
                        setStatus("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={() => setNewOpen(true)}>
                      <Plus /> New webinar
                    </Button>
                  )
                }
              />
            }
          />
        )}
      </Card>

      <NewWebinarDialog open={newOpen} onOpenChange={setNewOpen} onCreated={(id) => router.push(`/webinars/${id}`)} />
      <CompareDialog open={compareOpen} onOpenChange={setCompareOpen} webinars={chosen} />
    </>
  );
}
