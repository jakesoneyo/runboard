// 실행 관련 쿼리 키를 한 곳에 모은다 — hooks.ts(REST 성공 시 패치)와 use-run-socket.ts(소켓 이벤트
// 패치)가 서로 다른 키 문자열을 실수로 만들어 캐시가 어긋나는 사고를 막는다.
import { orgScopedKey } from "../../lib/query-keys";
import type { ListRunsParams } from "./api";

export function runsListKey(orgId: string | null, params: ListRunsParams) {
  return orgScopedKey(orgId, "runs", params);
}

export function runDetailKey(orgId: string | null, runId: string) {
  return orgScopedKey(orgId, "runs", runId, "detail");
}

export function runCasesKey(orgId: string | null, runId: string) {
  return orgScopedKey(orgId, "runs", runId, "cases");
}
