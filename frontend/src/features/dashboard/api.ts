// API.md 7장 — 대시보드 집계 REST 클라이언트(조회 전용).
import { apiClient } from "../../lib/api-client";
import type { DashboardSummary, PassRateTrendPoint } from "../../types/api";

export async function fetchDashboardSummary(
  orgId: string
): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>(
    `/orgs/${orgId}/dashboard/summary`
  );
  return data;
}

export async function fetchPassRateTrend(
  orgId: string,
  limit = 10
): Promise<PassRateTrendPoint[]> {
  const { data } = await apiClient.get<PassRateTrendPoint[]>(
    `/orgs/${orgId}/dashboard/pass-rate-trend`,
    { params: { limit } }
  );
  return data;
}
