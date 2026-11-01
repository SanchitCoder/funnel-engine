"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Banknote } from "lucide-react";
import { useMemo, useState } from "react";
import { ChartCard } from "@/components/chart-card";
import { MonthlyRevenue } from "@/components/charts";
import { DataTable } from "@/components/data-table";
import { ManualPaymentDialog } from "@/components/manual-payment-dialog";
import { usePersonDrawer } from "@/components/person-drawer";
import { PageHeader } from "@/components/page-header";
import { Badge, FollowupBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatINR, formatINRCompact, formatISTPattern, formatISTShort } from "@/lib/format";
import { useCalls, useSales, useWebinars } from "@/lib/hooks";
import type { CallStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type SaleRow = NonNullable<ReturnType<typeof useSales>["data"]>["rows"][number];
type CallRow = NonNullable<ReturnType<typeof useCalls>["data"]>["rows"][number];

export default function SalesPage() {
  const webinars = useWebinars();
  const { openPerson } = usePersonDrawer();
  const [tab, setTab] = useState<"sales" | "calls">("sales");
  const [webinar, setWebinar] = useState("");
  const [provider, setProvider] = useState("");
  const [saleStatus, setSaleStatus] = useState("");
  const [callStatus, setCallStatus] = useState<"" | CallStatus>("");
  const [salesPage, setSalesPage] = useState(1);
  const [callsPage, setCallsPage] = useState(1);
  const [payOpen, setPayOpen] = useState(false);

  const wid = webinar ? Number(webinar) : undefined;
  const sales = useSales({ webinar_id: wid, provider: provider || undefined, status: saleStatus || undefined, page: salesPage });
  const calls = useCalls({ webinar_id: wid, status: callStatus || undefined, page: callsPage });

  const saleCols = useMemo<ColumnDef<SaleRow, unknown>[]>(
    () => [
      { id: "when", header: "Paid (IST)", accessorFn: (s) => s.paid_at, cell: ({ row }) => <span className="whitespace-nowrap">{formatISTPattern(row.original.paid_at, "d MMM, h:mm a")}</span> },
      {
        id: "person",
        header: "Person",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="min-w-[160px]">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-ink-3">{row.original.email}</p>
          </div>
        ),
      },
      { id: "webinar", header: "Webinar", enableSorting: false, cell: ({ row }) => <span className="block max-w-[220px] truncate">{row.original.webinar_title}</span> },
      { id: "tier", header: "Tier", accessorFn: (s) => s.tier, cell: ({ row }) => <Badge tone={row.original.tier === "VIP" ? "info" : "neutral"}>{row.original.tier}</Badge> },
      {
        id: "provider",
        header: "Provider",
        accessorFn: (s) => s.provider,
        cell: ({ row }) => (
          <span className="capitalize" title={row.original.note}>
            {row.original.provider}
          </span>
        ),
      },
      { id: "status", header: "Status", accessorFn: (s) => s.status, cell: ({ row }) => <Badge tone={row.original.status === "paid" ? "good" : "warn"}>{row.original.status}</Badge> },
      { id: "amount", header: "Amount", meta: { align: "right" }, accessorFn: (s) => s.amount_inr, cell: ({ row }) => <span className={cn("font-semibold", row.original.status !== "paid" && "text-ink-3 line-through")}>{formatINR(row.original.amount_inr)}</span> },
    ],
    [],
  );

  const callCols = useMemo<ColumnDef<CallRow, unknown>[]>(
    () => [
      { id: "booked", header: "Booked (IST)", accessorFn: (c) => c.booked_at, cell: ({ row }) => <span className="whitespace-nowrap">{formatISTPattern(row.original.booked_at, "d MMM, h:mm a")}</span> },
      {
        id: "person",
        header: "Person",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="min-w-[160px]">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-ink-3">{row.original.email}</p>
          </div>
        ),
      },
      { id: "webinar", header: "Webinar", enableSorting: false, cell: ({ row }) => <span className="block max-w-[220px] truncate">{row.original.webinar_title}</span> },
      { id: "when", header: "Call time", accessorFn: (c) => c.scheduled_for ?? "", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.scheduled_for ? formatISTPattern(row.original.scheduled_for, "EEE d MMM, h:mm a") : "—"}</span> },
      { id: "source", header: "Via", accessorFn: (c) => c.source, cell: ({ row }) => <span>{row.original.source.replace("_", ".")}</span> },
      {
        id: "status",
        header: "Call",
        accessorFn: (c) => c.status,
        cell: ({ row }) => (
          <Badge tone={row.original.status === "completed" ? "good" : row.original.status === "booked" ? "info" : "outline"}>{row.original.status === "booked" ? "Upcoming" : row.original.status === "completed" ? "Done" : "Canceled"}</Badge>
        ),
      },
      { id: "followup", header: "Follow-up", enableSorting: false, cell: ({ row }) => <FollowupBadge status={row.original.followup_status} /> },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        eyebrow="Sales & calls"
        title="Money in, calls booked"
        description="Every paid sale and every call, with the person behind it. Refunds are listed but never counted in revenue."
        actions={
          <Button variant="primary" onClick={() => setPayOpen(true)}>
            <Banknote /> Record manual payment
          </Button>
        }
      />

      <div className="space-y-6">
        {sales.isPending ? (
          <Skeleton className="h-72" />
        ) : sales.error ? (
          <Card>
            <ErrorState error={sales.error} onRetry={() => sales.refetch()} />
          </Card>
        ) : (
          <ChartCard
            title="Revenue by month"
            caption={(() => {
              const top = [...sales.data.months].sort((a, b) => b.revenue_inr - a.revenue_inr)[0];
              return top && top.revenue_inr > 0 ? `${top.label} is your best month so far at ${formatINRCompact(top.revenue_inr)} from ${top.sales} sales.` : "No paid sales yet.";
            })()}
            table={{ columns: ["Month", "Sales", "Revenue"], rows: sales.data.months.map((m) => [m.label, m.sales, formatINR(m.revenue_inr)]) }}
          >
            <MonthlyRevenue months={sales.data.months} />
          </ChartCard>
        )}

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList>
                <TabsTrigger value="sales">Sales{sales.data ? ` (${sales.data.total})` : ""}</TabsTrigger>
                <TabsTrigger value="calls">Calls{calls.data ? ` (${calls.data.total})` : ""}</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={webinar}
                onChange={(e) => {
                  setWebinar(e.target.value);
                  setSalesPage(1);
                  setCallsPage(1);
                }}
                className="w-auto max-w-[250px]"
                aria-label="Webinar"
              >
                <option value="">All webinars</option>
                {[...(webinars.data ?? [])].reverse().map((w) => (
                  <option key={w.id} value={w.id}>
                    {formatISTShort(w.scheduled_at)} · {w.title.length > 30 ? `${w.title.slice(0, 29)}…` : w.title}
                  </option>
                ))}
              </Select>
              {tab === "sales" ? (
                <>
                  <Select value={provider} onChange={(e) => { setProvider(e.target.value); setSalesPage(1); }} className="w-auto" aria-label="Provider">
                    <option value="">Any provider</option>
                    <option value="razorpay">Razorpay</option>
                    <option value="manual">Manual</option>
                  </Select>
                  <Select value={saleStatus} onChange={(e) => { setSaleStatus(e.target.value); setSalesPage(1); }} className="w-auto" aria-label="Status">
                    <option value="">Any status</option>
                    <option value="paid">Paid</option>
                    <option value="refunded">Refunded</option>
                  </Select>
                </>
              ) : (
                <Select value={callStatus} onChange={(e) => { setCallStatus(e.target.value as typeof callStatus); setCallsPage(1); }} className="w-auto" aria-label="Call status">
                  <option value="">Any status</option>
                  <option value="booked">Upcoming</option>
                  <option value="completed">Done</option>
                  <option value="canceled">Canceled</option>
                </Select>
              )}
            </div>
          </div>

          {tab === "sales" ? (
            sales.error ? (
              <ErrorState error={sales.error} onRetry={() => sales.refetch()} />
            ) : (
              <>
                {sales.data ? (
                  <p className="border-b border-line bg-surface-2/50 px-4 py-2 text-[13px] text-ink-2">
                    <span className="tnum font-semibold">{sales.data.totals.paid_count}</span> paid · <span className="tnum font-semibold">{formatINR(sales.data.totals.revenue_inr)}</span> collected
                    {sales.data.totals.refunded ? <span className="text-ink-3"> · {sales.data.totals.refunded} refunded</span> : null}
                  </p>
                ) : null}
                <DataTable
                  caption="Sales"
                  columns={saleCols}
                  data={sales.data?.rows ?? []}
                  isLoading={sales.isPending}
                  onRowClick={(s) => s.registrant_id && openPerson(s.registrant_id)}
                  pagination={sales.data ? { page: salesPage, pageSize: sales.data.page_size, total: sales.data.total, onPage: setSalesPage } : undefined}
                  empty={<EmptyState title="No sales match" description="Try clearing a filter, or record a manual payment." />}
                />
              </>
            )
          ) : calls.error ? (
            <ErrorState error={calls.error} onRetry={() => calls.refetch()} />
          ) : (
            <DataTable
              caption="Calls"
              columns={callCols}
              data={calls.data?.rows ?? []}
              isLoading={calls.isPending}
              onRowClick={(c) => openPerson(c.registrant_id)}
              pagination={calls.data ? { page: callsPage, pageSize: calls.data.page_size, total: calls.data.total, onPage: setCallsPage } : undefined}
              empty={<EmptyState title="No calls match" description="Calls booked through Cal.com, Calendly or by hand appear here." />}
            />
          )}
        </Card>
      </div>

      <ManualPaymentDialog open={payOpen} onOpenChange={setPayOpen} />
    </>
  );
}
