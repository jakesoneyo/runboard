import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBug,
  fetchBug,
  fetchBugs,
  updateBug,
  type ListBugsParams,
  type UpdateBugPayload,
} from "./api";
import { orgScopedKey } from "../../lib/query-keys";
import { useOrgStore } from "../../stores/org-store";
import type { BugFormInput } from "../../schemas/bug.schema";

function bugsListKey(orgId: string | null, params: ListBugsParams) {
  return orgScopedKey(orgId, "bugs", params);
}

export function useBugs(params: ListBugsParams) {
  const orgId = useOrgStore((s) => s.currentOrgId);
  return useQuery({
    queryKey: bugsListKey(orgId, params),
    queryFn: () => fetchBugs(orgId as string, params),
    enabled: Boolean(orgId),
  });
}

export function useBug(bugId: string | null) {
  const orgId = useOrgStore((s) => s.currentOrgId);
  return useQuery({
    queryKey: orgScopedKey(orgId, "bugs", bugId),
    queryFn: () => fetchBug(orgId as string, bugId as string),
    enabled: Boolean(orgId) && Boolean(bugId),
  });
}

function invalidateBugs(
  queryClient: ReturnType<typeof useQueryClient>,
  orgId: string | null
) {
  void queryClient.invalidateQueries({ queryKey: orgScopedKey(orgId, "bugs") });
}

export function useCreateBug() {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BugFormInput) => createBug(orgId as string, payload),
    onSuccess: () => invalidateBugs(queryClient, orgId),
  });
}

export function useUpdateBug() {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      bugId,
      payload,
    }: {
      bugId: string;
      payload: UpdateBugPayload;
    }) => updateBug(orgId as string, bugId, payload),
    onSuccess: () => invalidateBugs(queryClient, orgId),
  });
}
