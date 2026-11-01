"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import { MaskedPhone, PersonActions } from "@/components/person-bits";
import { usePersonDrawer } from "@/components/person-drawer";
import { FollowupBadge, RepeatBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/form";
import { ErrorState } from "@/components/ui/states";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatISTShort, formatMinutes } from "@/lib/format";
import { useRegistrants, useWebinars } from "@/lib/hooks";
import { SEGMENT_LABELS } from "@/lib/mock/config";
import { getRegistrantsAll, type RegistrantParams } from "@/lib/mock/queries";
import type { FollowupStatus, RegistrantRow, SegmentName } from "@/lib/types";

const STATUSES: { value: FollowupStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "sequence_running", label: "In sequence" },
  { value: "replied", label: "Replied" },
  { value: "booked", label: "Call booked" },
  { value: "purchased", label: "Purchased" },
  { value: "completed", label: "Sequence done" },
  { value: "opted_out", label: "Opted out" },
];

export function PeopleTable({
  fixedWebinarId,
  initialWebinarId,
  showWebinarFilter,
  exportName,
  pageSize = 15,
}: {
  fixedWebinarId?: number;
  initialWebinarId?: number;
  showWebinarFilter?: boolean;
  exportName: string;
  pageSize?: number;
}) {
  const { openPerson } = usePersonDrawer();
  const webinars = useWebinars();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [segment, setSegment] = useState<"" | SegmentName>("");
  const [status, setStatus] = useState<"" | FollowupStatus>("");
  const [attended, setAttended] = useState<"" | "yes" | "no">("");
  const [source, setSource] = useState("");
  const [webinar, setWebinar] = useState<string>(initialWebinarId ? String(initialWebinarId) : "");
  const [repeat, setRepeat] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, segment, status, attended, source, webinar, repeat, fixedWebinarId]);

  const params: RegistrantParams = useMemo(
    () => ({
      webinar_id: fixedWebinarId ?? (webinar ? Number(webinar) : undefined),
      segment: segment || undefined,
      followup_status: status || undefined,
      attended: attended === "" ? undefined : attended === "yes",
      source: source || undefined,
      search: debounced || undefined,
      repeat: repeat || undefined,
      page,
      page_size: pageSize,
    }),
    [fixedWebinarId, webinar, segment, status, attended, source, debounced, repeat, page, pageSize],
  );
  const { data, isPending, error, refetch, isPlaceholderData } = useRegistrants(params);

  const columns = useMemo<ColumnDef<RegistrantRow, unknown>[]>(
    () => [
      {
        id: "person",
        header: "Person",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="min-w-[180px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={(e) => { e.stopPropagation(); openPerson(row.original.registrant_id); }} className="text-left font-medium hover:text-accent hover:underline">
                {row.original.name}
              </button>
              <RepeatBadge count={row.original.prior_webinars_attended} />
            </div>
            <p className="mt-0.5 text-xs text-ink-3">{row.original.email}</p>
          </div>
        ),
      },
      ...(fixedWebinarId
        ? []
        : [
            {
              id: "webinar",
              header: "Webinar",
              enableSorting: false,
              cell: ({ row }) => (
                <div className="max-w-[210px]">
                  <p className="truncate text-[13px]">{row.original.webinar_title}</p>
                  <p className="text-xs text-ink-3">{formatISTShort(row.original.webinar_date)}</p>
                </div>
              ),
            } satisfies ColumnDef<RegistrantRow, unknown>,
          ]),
      { id: "source", header: "Source", enableSorting: false, accessorFn: (r) => r.source_label, cell: ({ row }) => <span className="whitespace-nowrap">{row.original.source_label}</span> },
      {
        id: "watched",
        header: "Watched",
        meta: { align: "right" },
        enableSorting: false,
        cell: ({ row }) => (row.original.attended ? formatMinutes(row.original.watch_minutes) : <span className="text-ink-3">Didn&apos;t join</span>),
      },
      { id: "segment", header: "Segment", enableSorting: false, cell: ({ row }) => (row.original.segment ? <span className="whitespace-nowrap text-[13px]">{SEGMENT_LABELS[row.original.segment]}</span> : <span className="text-ink-3">Not segmented</span>) },
      { id: "status", header: "Follow-up", enableSorting: false, cell: ({ row }) => <FollowupBadge status={row.original.followup_status} /> },
      { id: "phone", header: "Phone", enableSorting: false, cell: ({ row }) => <span onClick={(e) => e.stopPropagation()}><MaskedPhone phone={row.original.phone} className="text-[13px]" /></span> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <PersonActions name={row.original.name} phone={row.original.phone} email={row.original.email} />
          </div>
        ),
      },
    ],
    [fixedWebinarId, openPerson],
  );

  const exportCsv = () => {
    const all = getRegistrantsAll({ ...params, page: 1 });
    const csv = toCsv(
      ["Name", "Email", "Phone", "Webinar", "Webinar date", "Source", "Attended", "Minutes watched", "Segment", "Follow-up status", "Follow-up step", "Registered at"],
      all.map((r) => [r.name, r.email, r.phone, r.webinar_title, formatISTShort(r.webinar_date), r.source_label, r.attended ? "yes" : "no", r.watch_minutes, r.segment ?? "", r.followup_status ?? "", r.followup_step, r.registered_at]),
    );
    downloadCsv(`${exportName}.csv`, csv);
    toast.success(`Exported ${all.length.toLocaleString("en-IN")} people to ${exportName}.csv`);
  };

  const filtersActive = !!(search || segment || status || attended || source || (showWebinarFilter && webinar) || repeat);
  const clear = () => {
    setSearch("");
    setSegment("");
    setStatus("");
    setAttended("");
    setSource("");
    setWebinar("");
    setRepeat(false);
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-ink-3" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email or phone" className="pl-9" aria-label="Search people" />
        </div>
        {showWebinarFilter ? (
          <Select value={webinar} onChange={(e) => setWebinar(e.target.value)} className="w-auto max-w-[240px]" aria-label="Webinar">
            <option value="">All webinars</option>
            {[...(webinars.data ?? [])].reverse().map((w) => (
              <option key={w.id} value={w.id}>
                {formatISTShort(w.scheduled_at)} · {w.title.length > 34 ? `${w.title.slice(0, 33)}…` : w.title}
              </option>
            ))}
          </Select>
        ) : null}
        <Select value={segment} onChange={(e) => setSegment(e.target.value as typeof segment)} className="w-auto" aria-label="Segment">
          <option value="">Any segment</option>
          {(Object.keys(SEGMENT_LABELS) as SegmentName[]).map((s) => (
            <option key={s} value={s}>
              {SEGMENT_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-auto" aria-label="Follow-up status">
          <option value="">Any follow-up status</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <Select value={attended} onChange={(e) => setAttended(e.target.value as typeof attended)} className="w-auto" aria-label="Attendance">
          <option value="">Attended or not</option>
          <option value="yes">Attended</option>
          <option value="no">Didn&apos;t attend</option>
        </Select>
        <Select value={source} onChange={(e) => setSource(e.target.value)} className="w-auto" aria-label="Source">
          <option value="">Any source</option>
          <option value="paid">Paid ads</option>
          <option value="organic">Organic</option>
          <option value="instagram_bio">Instagram bio</option>
          <option value="youtube">YouTube</option>
          <option value="whatsapp_community">WhatsApp community</option>
          <option value="email_newsletter">Email newsletter</option>
        </Select>
        {showWebinarFilter ? (
          <label className="flex h-9 cursor-pointer items-center gap-2 text-[13px] text-ink-2">
            <Checkbox checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
            Repeat attendees only
          </label>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {filtersActive ? (
            <Button variant="ghost" size="sm" onClick={clear}>
              Clear
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!data || data.total === 0}>
            <Download /> Export CSV
          </Button>
        </div>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div className={isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <DataTable
            caption="People"
            columns={columns}
            data={data?.rows ?? []}
            isLoading={isPending}
            onRowClick={(r) => openPerson(r.registrant_id)}
            pagination={data ? { page, pageSize, total: data.total, onPage: setPage } : undefined}
          />
        </div>
      )}
    </div>
  );
}
