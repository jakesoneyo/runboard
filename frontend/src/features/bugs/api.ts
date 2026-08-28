// API.md 6장 — 버그 리포트 REST 클라이언트.
import { apiClient } from "../../lib/api-client";
import type {
  BugDetail,
  BugSeverity,
  BugStatus,
  BugSummary,
  Paginated,
} from "../../types/api";
import type { BugFormInput } from "../../schemas/bug.schema";

export interface ListBugsParams {
  status?: BugStatus;
  severity?: BugSeverity;
  testRunId?: string;
  cursor?: string;
  take?: number;
}

export async function fetchBugs(
  orgId: string,
  params: ListBugsParams
): Promise<Paginated<BugSummary>> {
  const { data } = await apiClient.get<Paginated<BugSummary>>(
    `/orgs/${orgId}/bugs`,
    { params }
  );
  return data;
}

export async function fetchBug(
  orgId: string,
  bugId: string
): Promise<BugDetail> {
  const { data } = await apiClient.get<BugDetail>(
    `/orgs/${orgId}/bugs/${bugId}`
  );
  return data;
}

export async function createBug(orgId: string, payload: BugFormInput) {
  const { data } = await apiClient.post(`/orgs/${orgId}/bugs`, payload);
  return data;
}

export interface UpdateBugPayload {
  title?: string;
  description?: string;
  severity?: BugSeverity;
  status?: BugStatus;
  assigneeId?: string | null;
}

export async function updateBug(
  orgId: string,
  bugId: string,
  payload: UpdateBugPayload
) {
  const { data } = await apiClient.patch(
    `/orgs/${orgId}/bugs/${bugId}`,
    payload
  );
  return data;
}
