"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  empty,
  onRowClick,
  initialSort,
  pagination,
  className,
  rowClassName,
  caption,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  isLoading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  initialSort?: SortingState;
  pagination?: Pagination;
  className?: string;
  rowClassName?: (row: T) => string | undefined;
  caption?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSort ?? []);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const cols = columns.length;
  const from = pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const to = pagination ? Math.min(pagination.total, pagination.page * pagination.pageSize) : 0;
  const lastPage = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;

  return (
    <div className={cn("overflow-hidden", className)}>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-line bg-surface-2/60">
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort();
                  const sorted = h.column.getIsSorted();
                  const align = (h.column.columnDef.meta as { align?: "right" } | undefined)?.align;
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      className={cn("px-3 py-2.5 text-xs font-semibold text-ink-3", align === "right" ? "text-right" : "text-left")}
                    >
                      {h.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className={cn("inline-flex items-center gap-1 rounded hover:text-ink", align === "right" && "flex-row-reverse")}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? <ArrowUp className="size-3" aria-hidden /> : sorted === "desc" ? <ArrowDown className="size-3" aria-hidden /> : <ChevronsUpDown className="size-3 opacity-40" aria-hidden />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {Array.from({ length: cols }, (_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full max-w-[140px]" />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onRowClick(row.original);
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      "border-b border-line transition-colors last:border-0",
                      onRowClick && "cursor-pointer hover:bg-surface-2 focus-visible:bg-surface-2",
                      rowClassName?.(row.original),
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const align = (cell.column.columnDef.meta as { align?: "right" } | undefined)?.align;
                      return (
                        <td key={cell.id} className={cn("px-3 py-3 align-middle", align === "right" && "text-right tnum")}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!isLoading && data.length === 0 ? (empty ?? <EmptyState title="Nothing here yet" description="No rows match these filters." />) : null}
      {pagination && pagination.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs text-ink-3">
          <span className="tnum">
            Showing {from}–{to} of {pagination.total.toLocaleString("en-IN")}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" disabled={pagination.page <= 1} onClick={() => pagination.onPage(pagination.page - 1)} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span className="tnum px-2">
              Page {pagination.page} of {lastPage}
            </span>
            <Button variant="secondary" size="sm" disabled={pagination.page >= lastPage} onClick={() => pagination.onPage(pagination.page + 1)} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
