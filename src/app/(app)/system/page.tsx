"use client";

import { CheckCircle2, Database, FlaskConical, HeartPulse, Play, ScrollText, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatISTPattern } from "@/lib/format";
import { useCleanup, useLogs, useRunTest, useSetup } from "@/lib/hooks";
import { getAttribution, getCalls, getLogs, getPerson, getRegistrants, getRetention, getSales, getSegments, getTrends, getWebinarDetail, listWebinars } from "@/lib/mock/queries";
import type { TestScenario } from "@/lib/mock/db";
import { cn } from "@/lib/utils";

export default function SystemPage() {
  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Backend controls"
        description="Set up the database, run a fake funnel to prove the numbers add up, and check what the engine has been logging."
        actions={
          <Badge tone="info" className="px-3 py-1 text-[13px]">
            <Database aria-hidden /> Data mode: sample
          </Badge>
        }
      />
      <div className="space-y-6">
        <ModeNote />
        <div className="grid gap-6 xl:grid-cols-2">
          <Initialise />
          <TestRunner />
        </div>
        <Health />
        <Logs />
      </div>
    </>
  );
}

function ModeNote() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-accent/25 bg-accent-soft px-5 py-4 text-[13.5px]">
      <Database className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
      <p className="text-ink-2">
        <strong className="font-semibold text-ink">You are looking at sample data.</strong> Ankit Verma&apos;s ten webinars are generated in your browser, and everything you do here (creating webinars, importing attendance, closing, logging calls) changes that in-memory copy until you reload. Nothing is sent anywhere.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ initialise

function Initialise() {
  const setup = useSetup();
  const [confirm, setConfirm] = useState(false);
  const created = setup.data?.created;
  return (
    <Card>
      <CardHeader eyebrow="Step 1" title="Initialise backend" description="Creates the tables, indexes, views and functions the workflow needs. Safe to run again; it only adds what is missing." />
      <CardBody className="space-y-4">
        <Button variant="primary" onClick={() => setConfirm(true)}>
          <Database /> Initialise backend
        </Button>
        {created ? (
          <div className="rounded-xl border border-good/30 bg-good/10 p-4 text-[13px]">
            <p className="mb-2 flex items-center gap-2 font-semibold text-good-text">
              <CheckCircle2 className="size-4" aria-hidden /> {setup.data?.message}
            </p>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["tables", "views", "functions", "indexes"] as const).map((k) => (
                <div key={k}>
                  <dt className="eyebrow mb-1">{k}</dt>
                  <dd className="tnum text-xl font-semibold">{created[k].length}</dd>
                </div>
              ))}
            </dl>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-ink-2">Show tables</summary>
              <p className="mt-2 font-mono text-xs leading-relaxed text-ink-2">{created.tables.join(", ")}</p>
            </details>
          </div>
        ) : null}
        {setup.error ? <ErrorState title="Setup failed" error={setup.error} className="py-4" /> : null}
      </CardBody>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Initialise the backend?"
        description="This creates or updates database tables, indexes, views and functions. Existing data is not deleted."
        confirmLabel="Initialise"
        pending={setup.isPending}
        onConfirm={async () => {
          await setup.mutateAsync();
          setConfirm(false);
        }}
      />
    </Card>
  );
}

// ------------------------------------------------------------------ test runner

const SCENARIOS: { value: TestScenario; label: string; hint: string }[] = [
  { value: "full_funnel", label: "Full funnel", hint: "40% no-shows, 3 calls, 2 sales" },
  { value: "poor_attendance", label: "Poor attendance", hint: "70% no-shows, 1 call, no sales" },
  { value: "strong_pitch", label: "Strong pitch", hint: "20% no-shows, 5 calls, 4 sales" },
];

function TestRunner() {
  const run = useRunTest();
  const cleanup = useCleanup();
  const [scenario, setScenario] = useState<TestScenario>("full_funnel");
  const [size, setSize] = useState(12);
  const [confirm, setConfirm] = useState(false);
  const result = run.data?.result;
  return (
    <Card>
      <CardHeader eyebrow="Step 2" title="Test runner" description="Pushes a fake webinar through every real step, then compares the backend's numbers with the ones it should get." />
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
          <Field label="Scenario" hint={SCENARIOS.find((s) => s.value === scenario)?.hint}>
            {(id, d) => (
              <Select id={id} aria-describedby={d} value={scenario} onChange={(e) => setScenario(e.target.value as TestScenario)}>
                {SCENARIOS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="People">
            {(id) => <Input id={id} type="number" min={6} max={40} value={size} onChange={(e) => setSize(Math.max(6, Math.min(40, Number(e.target.value) || 12)))} />}
          </Field>
          <Button variant="primary" onClick={() => run.mutate({ scenario, size })} loading={run.isPending}>
            <Play /> Run
          </Button>
        </div>

        {run.error ? <ErrorState title="Test failed to run" error={run.error} className="py-4" /> : null}
        {result ? (
          <div className="space-y-3" aria-live="polite">
            <p className={cn("flex items-center gap-2 text-[13.5px] font-semibold", result.all_checks_passed ? "text-good-text" : "text-critical-text")}>
              {result.all_checks_passed ? <CheckCircle2 className="size-4" aria-hidden /> : <XCircle className="size-4" aria-hidden />}
              {run.data?.message}
            </p>
            <div className="scroll-thin max-h-56 overflow-auto rounded-lg border border-line">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface-2 text-left text-ink-3">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Check</th>
                    <th className="px-3 py-2 text-right font-semibold">Expected</th>
                    <th className="px-3 py-2 text-right font-semibold">Got</th>
                    <th className="px-3 py-2 font-semibold"><span className="sr-only">Result</span></th>
                  </tr>
                </thead>
                <tbody>
                  {result.checks.map((c) => (
                    <tr key={c.name} className="border-t border-line">
                      <td className="px-3 py-1.5">{c.name}</td>
                      <td className="tnum px-3 py-1.5 text-right">{String(c.expected)}</td>
                      <td className="tnum px-3 py-1.5 text-right">{String(c.actual)}</td>
                      <td className="px-3 py-1.5">{c.pass ? <CheckCircle2 className="size-3.5 text-good-text" aria-label="Passed" /> : <XCircle className="size-3.5 text-critical-text" aria-label="Failed" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer font-medium text-ink-2">Backend response</summary>
              <pre className="scroll-thin mt-2 max-h-48 overflow-auto rounded-lg bg-surface-2 p-3 font-mono text-[11px] leading-relaxed">{JSON.stringify({ status: run.data?.status, records_affected: run.data?.records_affected, ids: run.data?.ids, steps: result.steps.length }, null, 2)}</pre>
            </details>
          </div>
        ) : null}

        <div className="border-t border-line pt-4">
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            <Trash2 /> Clean up test data
          </Button>
          {cleanup.data ? (
            <p className="mt-2 text-[13px] text-ink-2">
              {cleanup.data.message}: {cleanup.data.deleted.webinars_deleted} webinar(s), {cleanup.data.deleted.ad_spend_deleted} ad-spend rows and {cleanup.data.deleted.events_deleted} events removed.
            </p>
          ) : null}
        </div>
      </CardBody>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete all test data?"
        description="Removes every webinar flagged as a test, along with its registrants, ad spend and events. Your real webinars are not touched."
        confirmLabel="Delete test data"
        tone="danger"
        pending={cleanup.isPending}
        onConfirm={async () => {
          await cleanup.mutateAsync();
          setConfirm(false);
        }}
      />
    </Card>
  );
}

// ------------------------------------------------------------------ health

interface Check {
  name: string;
  path: string;
  run: () => unknown;
}

function Health() {
  const [results, setResults] = useState<{ name: string; path: string; ok: boolean; ms: number; detail: string }[] | null>(null);
  const [running, setRunning] = useState(false);

  const checks: Check[] = [
    { name: "Webinar list", path: "GET /webinar/list", run: () => listWebinars() },
    { name: "Webinar metrics", path: "GET /webinar/metrics", run: () => getWebinarDetail(1) },
    { name: "Retention", path: "GET /webinar/retention", run: () => getRetention(4) },
    { name: "Segments", path: "GET /webinar/segments", run: () => getSegments(8) },
    { name: "Registrants", path: "GET /webinar/registrants", run: () => getRegistrants({ page: 1, page_size: 10 }) },
    { name: "Person journey", path: "GET /webinar/person", run: () => getPerson(1) },
    { name: "Trends", path: "GET /webinar/trends", run: () => getTrends() },
    { name: "Attribution", path: "GET /webinar/attribution", run: () => getAttribution("ad") },
    { name: "Sales", path: "GET /webinar/sales", run: () => getSales({}) },
    { name: "Calls", path: "GET /webinar/calls", run: () => getCalls({}) },
    { name: "Event log", path: "GET /webinar/logs?type=event", run: () => getLogs("event") },
    { name: "Error log", path: "GET /webinar/logs?type=error", run: () => getLogs("error") },
  ];

  const go = async () => {
    setRunning(true);
    setResults(null);
    const out: NonNullable<typeof results> = [];
    for (const c of checks) {
      await new Promise((r) => setTimeout(r, 90));
      const t0 = performance.now();
      try {
        const v = c.run();
        const ms = Math.round(performance.now() - t0);
        const ok = v !== null && v !== undefined;
        const n = Array.isArray(v) ? v.length : typeof v === "object" && v && "rows" in v && Array.isArray((v as { rows: unknown[] }).rows) ? (v as { rows: unknown[] }).rows.length : null;
        out.push({ name: c.name, path: c.path, ok, ms, detail: ok ? (n !== null ? `${n} rows` : "shape OK") : "empty response" });
      } catch (e) {
        out.push({ name: c.name, path: c.path, ok: false, ms: Math.round(performance.now() - t0), detail: e instanceof Error ? e.message : "threw" });
      }
      setResults([...out]);
    }
    setRunning(false);
  };

  const passed = results?.filter((r) => r.ok).length ?? 0;
  return (
    <Card>
      <CardHeader
        eyebrow="Step 3"
        title="Endpoint health check"
        description="Calls every read endpoint and checks the response has the shape the screens expect. In sample mode this exercises the built-in sample backend."
        actions={
          <Button variant="secondary" onClick={go} loading={running}>
            <HeartPulse /> Run check
          </Button>
        }
      />
      <CardBody>
        {!results ? (
          <EmptyState icon={HeartPulse} title="Not run yet" description="Run the check to see a pass or fail for each endpoint." className="py-8" />
        ) : (
          <div aria-live="polite">
            <p className="mb-3 text-[13px] font-semibold">
              {passed} of {checks.length} passed
              {running ? " so far…" : ""}
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {results.map((r) => (
                <li key={r.path} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5", r.ok ? "border-line" : "border-critical/40 bg-critical/10")}>
                  {r.ok ? <CheckCircle2 className="size-4 shrink-0 text-good-text" aria-label="Pass" /> : <XCircle className="size-4 shrink-0 text-critical-text" aria-label="Fail" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium">{r.name}</p>
                    <p className="truncate font-mono text-[11px] text-ink-3">{r.path}</p>
                  </div>
                  <div className="text-right text-xs text-ink-3">
                    <div className="tnum">{r.ms} ms</div>
                    <div>{r.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ------------------------------------------------------------------ logs

function Logs() {
  const [type, setType] = useState<"event" | "error">("event");
  const [page, setPage] = useState(1);
  const { data, isPending, error, refetch } = useLogs(type, page);
  return (
    <Card>
      <CardHeader
        eyebrow="Step 4"
        title={
          <span className="inline-flex items-center gap-2">
            <ScrollText className="size-4" aria-hidden /> Logs
          </span>
        }
        description="Events are what the engine did. Errors are what went wrong, with the node that failed."
        actions={
          <Tabs
            value={type}
            onValueChange={(v) => {
              setType(v as typeof type);
              setPage(1);
            }}
          >
            <TabsList>
              <TabsTrigger value="event">Events</TabsTrigger>
              <TabsTrigger value="error">Errors</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      <div className="pt-3">
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : type === "event" ? (
          <DataTable
            caption="Event log"
            isLoading={isPending}
            data={(data?.type === "event" ? data.rows : []) as EventRow[]}
            columns={[
              { id: "at", header: "When (IST)", cell: ({ row }) => <span className="whitespace-nowrap">{formatISTPattern(row.original.created_at, "d MMM, h:mm:ss a")}</span>, enableSorting: false },
              { id: "branch", header: "Branch", cell: ({ row }) => <Badge tone="outline">{row.original.branch}</Badge>, enableSorting: false },
              { id: "type", header: "Event", cell: ({ row }) => <span className="font-mono text-xs">{row.original.event_type}</span>, enableSorting: false },
              { id: "payload", header: "Details", cell: ({ row }) => <span className="block max-w-[420px] truncate font-mono text-[11px] text-ink-3">{JSON.stringify(row.original.payload)}</span>, enableSorting: false },
            ]}
            pagination={data ? { page, pageSize: data.page_size, total: data.total, onPage: setPage } : undefined}
            empty={<EmptyState title="No events" />}
          />
        ) : (
          <DataTable
            caption="Error log"
            isLoading={isPending}
            data={(data?.type === "error" ? data.rows : []) as ErrorRow[]}
            columns={[
              { id: "at", header: "When (IST)", cell: ({ row }) => <span className="whitespace-nowrap">{formatISTPattern(row.original.created_at, "d MMM, h:mm a")}</span>, enableSorting: false },
              { id: "node", header: "Failed node", cell: ({ row }) => <span className="font-medium">{row.original.node}</span>, enableSorting: false },
              { id: "err", header: "Error", cell: ({ row }) => <span className="block max-w-[460px] text-ink-2">{row.original.error}</span>, enableSorting: false },
              { id: "exec", header: "Execution", cell: ({ row }) => <span className="font-mono text-xs text-ink-3">#{row.original.execution_id}</span>, enableSorting: false },
            ]}
            pagination={data ? { page, pageSize: data.page_size, total: data.total, onPage: setPage } : undefined}
            empty={<EmptyState icon={FlaskConical} title="No errors logged" description="Nothing has failed. That is the goal." />}
          />
        )}
      </div>
    </Card>
  );
}

type EventRow = import("@/lib/types").EventLogRow;
type ErrorRow = import("@/lib/types").ErrorLogRow;
