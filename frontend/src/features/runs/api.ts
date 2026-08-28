// API.md 5장 — 실행(TestRun) REST 클라이언트. 결과 기록/상태 변경/배정은 전부 REST를 통하고,
// 실시간 반영은 features/runs/use-run-socket.ts가 캐시를 직접 패치한다(ARCHITECTURE.md 5장).
import { apiClient } from "../../lib/api-client";
import type {
  BugDraft,
  Paginated,
  RunCaseItem,
  RunCaseResult,
  RunStatus,
  RunSummary,
} from "../../types/api";
import type { RunFormInput } from "../../schemas/run.schema";

export interface ListRunsParams {
  status?: RunStatus;
  assignedToMe?: boolean;
  cursor?: string;
  take?: number;
}

export async function fetchRuns(
  orgId: string,
  params: ListRunsParams
): Promise<Paginated<RunSummary>> {
  const { data } = await apiClient.get<Paginated<RunSummary>>(
    `/orgs/${orgId}/runs`,
    { params }
  );
  return data;
}

export async function fetchRun(
  orgId: string,
  runId: string
): Promise<RunSummary> {
  const { data } = await apiClient.get<RunSummary>(
    `/orgs/${orgId}/runs/${runId}`
  );
  return data;
}

export async function createRun(orgId: string, payload: RunFormInput) {
  const { data } = await apiClient.post(`/orgs/${orgId}/runs`, payload);
  return data;
}

export async function fetchRunCases(
  orgId: string,
  runId: string,
  result?: RunCaseResult
): Promise<RunCaseItem[]> {
  const { data } = await apiClient.get<RunCaseItem[]>(
    `/orgs/${orgId}/runs/${runId}/cases`,
    { params: result ? { result } : undefined }
  );
  return data;
}

export async function recordResult(
  orgId: string,
  runId: string,
  runCaseId: string,
  payload: { result: RunCaseResult; comment?: string }
) {
  const { data } = await apiClient.patch(
    `/orgs/${orgId}/runs/${runId}/cases/${runCaseId}`,
    payload
  );
  return data;
}

export async function updateRunStatus(
  orgId: string,
  runId: string,
  status: Extract<RunStatus, "IN_PROGRESS" | "COMPLETED" | "ABORTED">
) {
  const { data } = await apiClient.patch(
    `/orgs/${orgId}/runs/${runId}/status`,
    { status }
  );
  return data;
}

export async function updateAssignees(
  orgId: string,
  runId: string,
  userIds: string[]
) {
  const { data } = await apiClient.put(
    `/orgs/${orgId}/runs/${runId}/assignees`,
    { userIds }
  );
  return data;
}

export async function fetchBugDraft(
  orgId: string,
  runId: string,
  runCaseId: string
): Promise<BugDraft> {
  const { data } = await apiClient.get<BugDraft>(
    `/orgs/${orgId}/runs/${runId}/cases/${runCaseId}/bug-draft`
  );
  return data;
}
