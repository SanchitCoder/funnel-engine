"use client";

import { BarChart3, Table2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface TableView {
  columns: string[];
  rows: (string | number)[][];
}

/**
 * Every chart gets a one-line caption that says what to take away, plus a
 * "view as table" toggle so the numbers are never trapped inside colour.
 */
export function ChartCard({
  title,
  caption,
  children,
  table,
  actions,
  className,
  legend,
}: {
  title: string;
  caption: ReactNode;
  children: ReactNode;
  table: TableView;
  actions?: ReactNode;
  className?: string;
  legend?: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  const panelId = useId();
  return (
    <Card className={className}>
      <CardHeader
        title={title}
        description={caption}
        actions={
          <>
            {actions}
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={asTable}
              aria-controls={panelId}
              onClick={() => setAsTable((v) => !v)}
              className="text-ink-3"
            >
              {asTable ? <BarChart3 /> : <Table2 />}
              <span className="hidden sm:inline">{asTable ? "View as chart" : "View as table"}</span>
            </Button>
          </>
        }
      />
      <div id={panelId} className="px-3 pb-4 pt-3 sm:px-5">
        {legend && !asTable ? <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-ink-2">{legend}</div> : null}
        {asTable ? (
          <div className="scroll-thin max-h-80 overflow-auto rounded-lg border border-line">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-surface-2 text-left">
                <tr>
                  {table.columns.map((c, i) => (
                    <th key={c} scope="col" className={cn("px-3 py-2 text-xs font-semibold text-ink-2", i > 0 && "text-right")}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, ri) => (
                  <tr key={ri} className="border-t border-line">
                    {row.map((cell, ci) => (
                      <td key={ci} className={cn("tnum px-3 py-1.5", ci > 0 && "text-right")}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

export function LegendDot({ color, label, shape = "dot" }: { color: string; label: string; shape?: "dot" | "line" | "dash" }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {shape === "dot" ? (
        <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />
      ) : shape === "line" ? (
        <span className="h-0.5 w-4 rounded-full" style={{ background: color }} aria-hidden />
      ) : (
        <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: color }} aria-hidden />
      )}
      {label}
    </span>
  );
}
