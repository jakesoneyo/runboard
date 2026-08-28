// API.md 7장 — 감사로그 조회 REST 클라이언트(ADMIN 전용, 조회 전용 — 생성/수정 API 없음).
import { apiClient } from "../../lib/api-client";
import type { AuditLogItem, Paginated } from "../../types/api";

export interface ListAuditLogsParams {
  action?: string;
  actorId?: string;
  targetType?: string;
  from?: string;
  to?: string;
  cursor?: string;
  take?: number;
}

export async function fetchAuditLogs(
  orgId: string,
  params: ListAuditLogsParams
): Promise<Paginated<AuditLogItem>> {
  const { data } = await apiClient.get<Paginated<AuditLogItem>>(
    `/orgs/${orgId}/audit-logs`,
    { params }
  );
  return data;
}
