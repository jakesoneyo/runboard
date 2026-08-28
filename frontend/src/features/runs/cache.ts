/**
 * 실행 화면의 TanStack Query 캐시를 직접 패치하는 순수 함수 모음.
 *
 * 왜 REST 성공 콜백과 소켓 이벤트 핸들러가 이 함수들을 공유하는가: 결과를 기록한 당사자는 REST
 * 응답으로 즉시 반영되고, 같은 룸의 다른 사용자는 소켓 이벤트로 반영된다 — 두 경로가 최종적으로
 * 같은 모양의 데이터를 같은 방식으로 캐시에 반영해야 화면이 어긋나지 않는다(API.md 8장
 * "이벤트 수신 시 setQueryData로 패치, 전체 재조회 금지").
 */
import type { QueryClient } from "@tanstack/react-query";
import { runCasesKey, runDetailKey } from "./keys";
import type {
  RunCaseItem,
  RunCounters,
  RunStatus,
  RunSummary,
} from "../../types/api";

export function patchRunCaseResult(
  queryClient: QueryClient,
  orgId: string | null,
  runId: string,
  patch: Pick<
    RunCaseItem,
    "id" | "result" | "comment" | "recordedBy" | "recordedAt"
  >
): void {
  queryClient.setQueryData<RunCaseItem[]>(runCasesKey(orgId, runId), (prev) =>
    prev?.map((item) =>
      item.id === patch.id
        ? {
            ...item,
            result: patch.result,
            comment: patch.comment,
            recordedBy: patch.recordedBy,
            recordedAt: patch.recordedAt,
          }
        : item
    )
  );
}

export function patchRunCounters(
  queryClient: QueryClient,
  orgId: string | null,
  runId: string,
  counters: RunCounters
): void {
  queryClient.setQueryData<RunSummary>(runDetailKey(orgId, runId), (prev) =>
    prev ? { ...prev, ...counters } : prev
  );
}

export function patchRunStatus(
  queryClient: QueryClient,
  orgId: string | null,
  runId: string,
  status: RunStatus
): void {
  queryClient.setQueryData<RunSummary>(runDetailKey(orgId, runId), (prev) =>
    prev ? { ...prev, status } : prev
  );
}

export function patchRunAssignees(
  queryClient: QueryClient,
  orgId: string | null,
  runId: string,
  assignees: RunSummary["assignees"]
): void {
  queryClient.setQueryData<RunSummary>(runDetailKey(orgId, runId), (prev) =>
    prev ? { ...prev, assignees } : prev
  );
}
