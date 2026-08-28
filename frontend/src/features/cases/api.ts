import { apiClient } from "../../lib/api-client";
import type {
  CaseDetail,
  CasePriority,
  CaseSummary,
  Paginated,
} from "../../types/api";
import type { CaseFormInput } from "../../schemas/case.schema";

export interface ListCasesParams {
  suiteId?: string;
  priority?: CasePriority;
  q?: string;
  cursor?: string;
  take?: number;
}

export async function fetchCases(
  orgId: string,
  params: ListCasesParams
): Promise<Paginated<CaseSummary>> {
  const { data } = await apiClient.get<Paginated<CaseSummary>>(
    `/orgs/${orgId}/cases`,
    { params }
  );
  return data;
}

export async function fetchCase(
  orgId: string,
  caseId: string
): Promise<CaseDetail> {
  const { data } = await apiClient.get<CaseDetail>(
    `/orgs/${orgId}/cases/${caseId}`
  );
  return data;
}

export async function createCase(orgId: string, payload: CaseFormInput) {
  const { data } = await apiClient.post(`/orgs/${orgId}/cases`, payload);
  return data;
}

export async function updateCase(
  orgId: string,
  caseId: string,
  payload: Partial<CaseFormInput>
) {
  const { data } = await apiClient.patch(
    `/orgs/${orgId}/cases/${caseId}`,
    payload
  );
  return data;
}

export async function deleteCase(orgId: string, caseId: string) {
  await apiClient.delete(`/orgs/${orgId}/cases/${caseId}`);
}
