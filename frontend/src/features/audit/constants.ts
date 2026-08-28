// backend/prisma/schema.prisma의 AuditAction enum과 값을 맞춘 필터 옵션 목록.
export const AUDIT_ACTIONS = [
  "ORG_CREATED",
  "MEMBER_INVITED",
  "MEMBER_JOINED",
  "MEMBER_ROLE_CHANGED",
  "MEMBER_REMOVED",
  "SUITE_CREATED",
  "SUITE_UPDATED",
  "SUITE_DELETED",
  "CASE_CREATED",
  "CASE_UPDATED",
  "CASE_DELETED",
  "RUN_CREATED",
  "RUN_STARTED",
  "RUN_COMPLETED",
  "RUN_ABORTED",
  "RUN_ASSIGNEES_CHANGED",
  "RUNCASE_RESULT_RECORDED",
  "BUG_CREATED",
  "BUG_STATUS_CHANGED",
  "BUG_UPDATED",
  "AUTH_LOGIN_SUCCEEDED",
  "AUTH_LOGIN_FAILED",
  "AUTH_REFRESH_REUSE_DETECTED",
] as const;

/** 목업(variant-c-bold)의 CREATE/UPDATE/DELETE/LOGIN 색 구분을 액션 접두어로 근사한다. */
export function auditVerbTone(
  action: string
): "create" | "update" | "delete" | "login" {
  if (action.startsWith("AUTH_LOGIN")) return "login";
  if (action.endsWith("_CREATED") || action === "MEMBER_JOINED")
    return "create";
  if (action.endsWith("_DELETED") || action.endsWith("_REMOVED"))
    return "delete";
  return "update";
}
