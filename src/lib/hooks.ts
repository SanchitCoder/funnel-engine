"use client";

// TanStack Query hooks over the sample backend. Reads are stale-while-revalidate,
// and live webinars refetch every 30 seconds. Every mutation toasts the backend's message
// and invalidates the data it touched.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  cleanupTestData,
  closeWebinar,
  createWebinar,
  importAttendanceRow,
  logCall,
  recordManualPayment,
  registerPerson,
  runTestScenario,
  setupBackend,
  type AttendanceInput,
  type CallInput,
  type CreateWebinarInput,
  type ManualPaymentInput,
  type RegisterInput,
  type TestScenario,
} from "./mock/db";
import {
  getAttribution,
  getCalls,
  getLogs,
  getPerson,
  getPublicWebinar,
  getRegistrants,
  getRegistrationPace,
  getRetention,
  getSales,
  getSegments,
  getTrends,
  getWebinarDetail,
  listWebinars,
  searchAll,
  type RegistrantParams,
} from "./mock/queries";
import type { CallStatus } from "./types";

const LIVE_REFRESH = 30_000;

function latency(ms = 160): Promise<void> {
  return new Promise((r) => setTimeout(r, ms + Math.random() * 140));
}

async function read<T>(fn: () => T, ms?: number): Promise<T> {
  await latency(ms);
  return fn();
}

// ------------------------------------------------------------------ reads

export function useWebinars() {
  return useQuery({
    queryKey: ["api", "webinars"],
    queryFn: () => read(listWebinars),
    staleTime: 20_000,
    refetchInterval: (q) => (q.state.data?.some((w) => w.status === "live") ? LIVE_REFRESH : false),
  });
}

export function useWebinarDetail(id: number | undefined) {
  return useQuery({
    queryKey: ["api", "webinar", id],
    enabled: id !== undefined && !Number.isNaN(id),
    queryFn: () => read(() => getWebinarDetail(id as number)),
    staleTime: 15_000,
    refetchInterval: (q) => (q.state.data?.webinar.status === "live" ? LIVE_REFRESH : false),
  });
}

export function useRetention(id: number | undefined) {
  return useQuery({
    queryKey: ["api", "retention", id],
    enabled: id !== undefined && !Number.isNaN(id),
    queryFn: () => read(() => getRetention(id as number), 260),
    staleTime: 15_000,
    refetchInterval: (q) => (q.state.data?.status === "live" ? LIVE_REFRESH : false),
  });
}

export function useSegments(id: number | undefined) {
  return useQuery({
    queryKey: ["api", "segments", id],
    enabled: id !== undefined && !Number.isNaN(id),
    queryFn: () => read(() => getSegments(id as number)),
    staleTime: 30_000,
  });
}

export function useRegistrants(params: RegistrantParams) {
  return useQuery({
    queryKey: ["api", "registrants", params],
    queryFn: () => read(() => getRegistrants(params)),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useRegistrationPace(id: number | undefined) {
  return useQuery({
    queryKey: ["api", "pace", id],
    enabled: id !== undefined,
    queryFn: () => read(() => getRegistrationPace(id as number)),
    staleTime: 60_000,
  });
}

export function usePerson(registrantId: number | null) {
  return useQuery({
    queryKey: ["api", "person", registrantId],
    enabled: registrantId !== null,
    queryFn: () => read(() => getPerson(registrantId as number), 220),
    staleTime: 30_000,
  });
}

export function useTrends() {
  return useQuery({ queryKey: ["api", "trends"], queryFn: () => read(getTrends, 260), staleTime: 60_000 });
}

export function useAttribution(level: "campaign" | "adset" | "ad") {
  return useQuery({
    queryKey: ["api", "attribution", level],
    queryFn: () => read(() => getAttribution(level), 260),
    staleTime: 60_000,
  });
}

export function useSales(params: { webinar_id?: number; provider?: string; status?: string; page?: number }) {
  return useQuery({
    queryKey: ["api", "sales", params],
    queryFn: () => read(() => getSales(params)),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useCalls(params: { webinar_id?: number; status?: CallStatus; page?: number }) {
  return useQuery({
    queryKey: ["api", "calls", params],
    queryFn: () => read(() => getCalls(params)),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useLogs(type: "event" | "error", page: number) {
  return useQuery({
    queryKey: ["api", "logs", type, page],
    queryFn: () => read(() => getLogs(type, page)),
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  });
}

export function usePublicWebinar(id: number) {
  return useQuery({
    queryKey: ["api", "public", id],
    queryFn: () => read(() => getPublicWebinar(id), 220),
    staleTime: 60_000,
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ["api", "search", q],
    queryFn: () => read(() => searchAll(q), 40),
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  });
}

// ------------------------------------------------------------------ writes

interface WithMessage {
  message?: string;
  matched?: boolean;
  duplicate?: boolean;
}

function useApiMutation<I, O extends WithMessage>(fn: (input: I) => O, opts: { toast?: boolean; delay?: number } = {}) {
  const qc = useQueryClient();
  return useMutation<O, Error, I>({
    mutationFn: async (input) => {
      await latency(opts.delay ?? 380);
      return fn(input);
    },
    onSuccess: (out) => {
      if (opts.toast !== false) {
        // "no match" and "duplicate" are valid 200 responses, but worth a different tone
        if (out.matched === false || out.duplicate === true) toast.warning(out.message ?? "Nothing changed");
        else toast.success(out.message ?? "Done");
      }
      void qc.invalidateQueries({ queryKey: ["api"] });
    },
    onError: (err) => {
      if (opts.toast !== false) toast.error(err.message || "Something went wrong");
    },
  });
}

export const useCreateWebinar = () => useApiMutation((i: CreateWebinarInput) => createWebinar(i));
export const useRegister = (opts?: { toast?: boolean }) => useApiMutation((i: RegisterInput) => registerPerson(i), opts);
export const useCloseWebinar = () => useApiMutation((id: number) => closeWebinar(id), { delay: 900 });
export const useLogCall = () => useApiMutation((i: CallInput) => logCall(i));
export const useManualPayment = () => useApiMutation((i: ManualPaymentInput) => recordManualPayment(i));
export const useSetup = () => useApiMutation(() => setupBackend(), { delay: 1100 });
export const useRunTest = () => useApiMutation((i: { scenario: TestScenario; size: number }) => runTestScenario(i.scenario, i.size), { delay: 1400 });
export const useCleanup = () => useApiMutation(() => cleanupTestData(), { delay: 600 });

/** One CSV row at a time; the dialog reports per-row results itself, so no toast per row. */
export function useAttendanceImport() {
  const qc = useQueryClient();
  return {
    importBatch: async (rows: AttendanceInput[]) => {
      await latency(220);
      return rows.map((row) => {
        try {
          const out = importAttendanceRow(row);
          return { row, ok: true as const, matched: out.matched, message: out.message };
        } catch (e) {
          return { row, ok: false as const, matched: false, message: e instanceof Error ? e.message : "Failed" };
        }
      });
    },
    done: () => qc.invalidateQueries({ queryKey: ["api"] }),
  };
}
