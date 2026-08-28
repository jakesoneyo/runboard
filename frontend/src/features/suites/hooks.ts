import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSuite, deleteSuite, fetchSuiteTree, updateSuite } from "./api";
import { orgScopedKey } from "../../lib/query-keys";
import { useOrgStore } from "../../stores/org-store";
import type { SuiteFormInput } from "../../schemas/suite.schema";

function suitesKey(orgId: string | null) {
  return orgScopedKey(orgId, "suites", { tree: true });
}

export function useSuiteTree() {
  const orgId = useOrgStore((s) => s.currentOrgId);
  return useQuery({
    queryKey: suitesKey(orgId),
    queryFn: () => fetchSuiteTree(orgId as string),
    enabled: Boolean(orgId),
  });
}

export function useCreateSuite() {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SuiteFormInput) =>
      createSuite(orgId as string, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: suitesKey(orgId) });
    },
  });
}

export function useUpdateSuite() {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      suiteId,
      payload,
    }: {
      suiteId: string;
      payload: Partial<SuiteFormInput>;
    }) => updateSuite(orgId as string, suiteId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: suitesKey(orgId) });
    },
  });
}

export function useDeleteSuite() {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (suiteId: string) => deleteSuite(orgId as string, suiteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: suitesKey(orgId) });
      // 스위트가 지워지면 그 안 케이스도 cascade로 사라지므로 케이스 목록 캐시도 함께 무효화한다.
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(orgId, "cases"),
      });
    },
  });
}
