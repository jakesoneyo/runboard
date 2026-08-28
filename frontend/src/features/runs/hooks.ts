import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRun,
  fetchBugDraft,
  fetchRun,
  fetchRunCases,
  fetchRuns,
  recordResult,
  updateAssignees,
  updateRunStatus,
  type ListRunsParams,
} from "./api";
import { patchRunCaseResult, patchRunCounters } from "./cache";
import { runCasesKey, runDetailKey, runsListKey } from "./keys";
import { orgScopedKey } from "../../lib/query-keys";
import { useOrgStore } from "../../stores/org-store";
import type { RunCaseResult, RunStatus } from "../../types/api";
import type { RunFormInput } from "../../schemas/run.schema";

export function useRuns(params: ListRunsParams) {
  const orgId = useOrgStore((s) => s.currentOrgId);
  return useQuery({
    queryKey: runsListKey(orgId, params),
    queryFn: () => fetchRuns(orgId as string, params),
    enabled: Boolean(orgId),
  });
}

export function useRun(runId: string) {
  const orgId = useOrgStore((s) => s.currentOrgId);
  return useQuery({
    queryKey: runDetailKey(orgId, runId),
    queryFn: () => fetchRun(orgId as string, runId),
    enabled: Boolean(orgId) && Boolean(runId),
  });
}

/** 필터 없이 항상 전체 케이스를 받는다 — 실행 보드는 결과별로 나눠 보여줄 필요가 없다(API.md 5장). */
export function useRunCases(runId: string) {
  const orgId = useOrgStore((s) => s.currentOrgId);
  return useQuery({
    queryKey: runCasesKey(orgId, runId),
    queryFn: () => fetchRunCases(orgId as string, runId),
    enabled: Boolean(orgId) && Boolean(runId),
  });
}

export function useCreateRun() {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RunFormInput) => createRun(orgId as string, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(orgId, "runs"),
      });
    },
  });
}

/**
 * 결과 기록. onSuccess에서 즉시 캐시를 패치해 기록한 당사자 화면은 소켓 왕복을 기다리지 않고
 * 바로 갱신된다 — 같은 run 룸의 다른 사용자는 useRunSocket의 run:case.recorded/progress.updated
 * 핸들러가 같은 patch 함수로 반영한다(features/runs/cache.ts 상단 주석).
 */
export function useRecordResult(runId: string) {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      runCaseId,
      result,
      comment,
    }: {
      runCaseId: string;
      result: RunCaseResult;
      comment?: string;
    }) => recordResult(orgId as string, runId, runCaseId, { result, comment }),
    onSuccess: (data: {
      runCase: {
        id: string;
        result: RunCaseResult;
        comment: string | null;
        recordedById: string | null;
        recordedAt: string | null;
      };
      counters: Parameters<typeof patchRunCounters>[3];
    }) => {
      patchRunCaseResult(queryClient, orgId, runId, {
        id: data.runCase.id,
        result: data.runCase.result,
        comment: data.runCase.comment,
        recordedBy: data.runCase.recordedById
          ? { id: data.runCase.recordedById }
          : null,
        recordedAt: data.runCase.recordedAt,
      });
      patchRunCounters(queryClient, orgId, runId, data.counters);
    },
  });
}

export function useUpdateRunStatus(runId: string) {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      status: Extract<RunStatus, "IN_PROGRESS" | "COMPLETED" | "ABORTED">
    ) => updateRunStatus(orgId as string, runId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(orgId, "runs"),
      });
    },
  });
}

export function useUpdateAssignees(runId: string) {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) =>
      updateAssignees(orgId as string, runId, userIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: runDetailKey(orgId, runId),
      });
    },
  });
}

/** bug-draft는 저장하지 않는 프리필용 GET이라 FAIL 버튼을 누른 시점에만 필요해서 enabled로 지연시킨다. */
export function useBugDraft(runId: string, runCaseId: string | null) {
  const orgId = useOrgStore((s) => s.currentOrgId);
  return useQuery({
    queryKey: orgScopedKey(
      orgId,
      "runs",
      runId,
      "cases",
      runCaseId,
      "bug-draft"
    ),
    queryFn: () => fetchBugDraft(orgId as string, runId, runCaseId as string),
    enabled: Boolean(orgId) && Boolean(runCaseId),
    staleTime: Infinity,
  });
}
