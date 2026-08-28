import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMembers, removeMember, updateMemberRole } from "./api";
import { orgScopedKey } from "../../lib/query-keys";
import { useOrgStore } from "../../stores/org-store";
import type { Role } from "../../types/api";

function membersKey(orgId: string | null) {
  return orgScopedKey(orgId, "members");
}

export function useMembers() {
  const orgId = useOrgStore((s) => s.currentOrgId);
  return useQuery({
    queryKey: membersKey(orgId),
    queryFn: () => fetchMembers(orgId as string),
    enabled: Boolean(orgId),
  });
}

export function useUpdateMemberRole() {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      updateMemberRole(orgId as string, userId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: membersKey(orgId) });
    },
  });
}

export function useRemoveMember() {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeMember(orgId as string, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: membersKey(orgId) });
    },
  });
}
