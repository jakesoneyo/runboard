import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createInvitation, fetchInvitations, revokeInvitation } from "./api";
import { orgScopedKey } from "../../lib/query-keys";
import { useOrgStore } from "../../stores/org-store";
import type { Role } from "../../types/api";

function invitationsKey(orgId: string | null) {
  return orgScopedKey(orgId, "invitations");
}

/**
 * ADMIN이 아니면 백엔드가 이 목록 조회 자체를 403으로 막는다(API.md 3장) — enabled로
 * 무조건 막지는 않고, 호출부(MembersPage)에서 ADMIN일 때만 이 훅을 사용하도록 게이팅한다.
 */
export function useInvitations() {
  const orgId = useOrgStore((s) => s.currentOrgId);
  return useQuery({
    queryKey: invitationsKey(orgId),
    queryFn: () => fetchInvitations(orgId as string),
    enabled: Boolean(orgId),
  });
}

export function useCreateInvitation() {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { email: string; role: Role }) =>
      createInvitation(orgId as string, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invitationsKey(orgId) });
    },
  });
}

export function useRevokeInvitation() {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      revokeInvitation(orgId as string, invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invitationsKey(orgId) });
    },
  });
}
