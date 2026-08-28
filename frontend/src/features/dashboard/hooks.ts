import { useQuery } from "@tanstack/react-query";
import { fetchDashboardSummary, fetchPassRateTrend } from "./api";
import { fetchRuns } from "../runs/api";
import { runsListKey } from "../runs/keys";
import { orgScopedKey } from "../../lib/query-keys";
import { useOrgStore } from "../../stores/org-store";
import type { RunAssignee } from "../../types/api";

export function useDashboardSummary() {
  const orgId = useOrgStore((s) => s.currentOrgId);
  return useQuery({
    queryKey: orgScopedKey(orgId, "dashboard", "summary"),
    queryFn: () => fetchDashboardSummary(orgId as string),
    enabled: Boolean(orgId),
  });
}

export function usePassRateTrend(limit = 10) {
  const orgId = useOrgStore((s) => s.currentOrgId);
  return useQuery({
    queryKey: orgScopedKey(orgId, "dashboard", "pass-rate-trend", limit),
    queryFn: () => fetchPassRateTrend(orgId as string, limit),
    enabled: Boolean(orgId),
  });
}

/**
 * dashboard/summary.recentRuns에는 담당자 정보가 없다(C5가 쿼리 예산 4개 고정을 위해 뺀 필드 —
 * PLAN.md C7 지침). 대시보드 쿼리 자체는 건드리지 않고, 같은 정렬·개수(createdAt desc, take 5)의
 * 별도 목록 호출로 담당자만 id 기준으로 덧붙인다.
 */
export function useRecentRunAssignees() {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const query = useQuery({
    queryKey: runsListKey(orgId, { take: 5 }),
    queryFn: () => fetchRuns(orgId as string, { take: 5 }),
    enabled: Boolean(orgId),
  });
  const byRunId = new Map<string, RunAssignee[]>(
    query.data?.items.map((run) => [run.id, run.assignees]) ?? []
  );
  return byRunId;
}
