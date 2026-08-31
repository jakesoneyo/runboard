import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptInvitation,
  createInvitation,
  fetchInvitations,
  revokeInvitation,
} from "./api";
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

/**
 * 초대 수락은 조직 컨텍스트 밖(엔드포인트가 `/invitations/accept`, orgId 없음)에서 일어나므로
 * orgScopedKey를 쓰지 않는다. 성공하면 새로 가입한 조직이 `["orgs"]` 목록에 나타나야
 * orgStore가 그 조직으로 전환할 수 있어 무효화한다(features/orgs/hooks.ts의 useOrganizations).
 */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => acceptInvitation(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orgs"] });
    },
  });
}
