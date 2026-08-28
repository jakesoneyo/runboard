import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchAuditLogs, type ListAuditLogsParams } from "./api";
import { orgScopedKey } from "../../lib/query-keys";
import { useOrgStore } from "../../stores/org-store";

/** 커서 페이지네이션을 무한스크롤로 소비한다 — API.md 7장 `{items, nextCursor}` 응답 형태 그대로. */
export function useAuditLogs(filters: Omit<ListAuditLogsParams, "cursor">) {
  const orgId = useOrgStore((s) => s.currentOrgId);
  return useInfiniteQuery({
    queryKey: orgScopedKey(orgId, "audit-logs", filters),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      fetchAuditLogs(orgId as string, { ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(orgId),
  });
}
