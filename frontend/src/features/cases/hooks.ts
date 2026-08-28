import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCase,
  deleteCase,
  fetchCase,
  fetchCases,
  updateCase,
  type ListCasesParams,
} from "./api";
import { orgScopedKey } from "../../lib/query-keys";
import { useOrgStore } from "../../stores/org-store";
import type { CaseFormInput } from "../../schemas/case.schema";

function casesListKey(orgId: string | null, params: ListCasesParams) {
  return orgScopedKey(orgId, "cases", params);
}

function caseDetailKey(orgId: string | null, caseId: string) {
  return orgScopedKey(orgId, "cases", caseId);
}

export function useCases(params: ListCasesParams) {
  const orgId = useOrgStore((s) => s.currentOrgId);
  return useQuery({
    queryKey: casesListKey(orgId, params),
    queryFn: () => fetchCases(orgId as string, params),
    enabled: Boolean(orgId),
  });
}

export function useCase(caseId: string | null) {
  const orgId = useOrgStore((s) => s.currentOrgId);
  return useQuery({
    queryKey: caseDetailKey(orgId, caseId as string),
    queryFn: () => fetchCase(orgId as string, caseId as string),
    enabled: Boolean(orgId) && Boolean(caseId),
  });
}

/**
 * 목록 페이지네이션 파라미터는 다양하므로 caseId 없이 'cases'로 시작하는 쿼리를 전부 무효화한다.
 * 스위트 트리(caseCount)도 함께 무효화한다 — 생성/삭제는 물론 수정으로 케이스가 다른 스위트로
 * 옮겨갈 때도 두 스위트의 caseCount가 바뀌는데, 트리는 별도 쿼리라 자동으로 갱신되지 않는다.
 */
function invalidateCases(
  queryClient: ReturnType<typeof useQueryClient>,
  orgId: string | null
) {
  void queryClient.invalidateQueries({
    queryKey: orgScopedKey(orgId, "cases"),
  });
  void queryClient.invalidateQueries({
    queryKey: orgScopedKey(orgId, "suites"),
  });
}

export function useCreateCase() {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CaseFormInput) =>
      createCase(orgId as string, payload),
    onSuccess: () => invalidateCases(queryClient, orgId),
  });
}

export function useUpdateCase() {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      caseId,
      payload,
    }: {
      caseId: string;
      payload: Partial<CaseFormInput>;
    }) => updateCase(orgId as string, caseId, payload),
    onSuccess: () => invalidateCases(queryClient, orgId),
  });
}

export function useDeleteCase() {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (caseId: string) => deleteCase(orgId as string, caseId),
    onSuccess: () => invalidateCases(queryClient, orgId),
  });
}
