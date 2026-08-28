import { Navigate, Outlet } from "react-router-dom";
import { useCurrentOrg } from "../features/orgs/hooks";
import { roleAtLeast } from "../lib/roles";
import type { Role } from "../types/api";

/**
 * 클라이언트 라우트 가드 — 서버는 항상 403으로 최종 막지만, ADMIN 전용 화면(감사로그)에
 * 다른 역할이 들어와 빈 403 에러 화면만 보는 대신 대시보드로 조용히 돌려보낸다.
 */
export function RequireOrgRole({ minimum }: { minimum: Role }) {
  const { current, isLoading } = useCurrentOrg();

  if (isLoading) return null;
  if (!roleAtLeast(current?.role, minimum)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
