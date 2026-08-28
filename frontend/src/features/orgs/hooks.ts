import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { createOrganization, fetchMyOrganizations } from "./api";
import { useAuthStore } from "../../stores/auth-store";
import { useOrgStore } from "../../stores/org-store";

/** ['orgs']는 조직을 넘나드는 목록 자체라 orgScopedKey 대상이 아니다(orgId가 아직 정해지기 전 단계). */
export function useOrganizations() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["orgs"],
    queryFn: fetchMyOrganizations,
    enabled: Boolean(accessToken),
  });
}

/**
 * "현재 조직"을 orgStore와 동기화한다. 저장된 currentOrgId가 더 이상 내 소속이 아니거나
 * 아직 선택된 적이 없으면 목록의 첫 조직으로 자동 보정한다(조직 없음 상태도 그대로 노출).
 */
export function useCurrentOrg() {
  const { data: orgs = [], isLoading, isFetched } = useOrganizations();
  const currentOrgId = useOrgStore((s) => s.currentOrgId);
  const setCurrentOrgId = useOrgStore((s) => s.setCurrentOrgId);

  const current =
    orgs.find((o) => o.id === currentOrgId) ??
    (orgs.length > 0 ? orgs[0] : null);

  useEffect(() => {
    if (isFetched && current?.id !== currentOrgId) {
      setCurrentOrgId(current?.id ?? null);
    }
  }, [isFetched, current, currentOrgId, setCurrentOrgId]);

  return { orgs, current, isLoading };
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrganization,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orgs"] });
    },
  });
}
