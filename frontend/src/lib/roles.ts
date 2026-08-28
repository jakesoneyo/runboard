import type { Role } from "../types/api";

/**
 * 백엔드 roles.guard.ts의 ROLE_RANK와 등급 순서를 맞춘다 — UI에서 버튼을 숨기는 판단 기준이
 * 서버 인가 판단과 어긋나면 "숨겼는데 서버는 허용" 또는 그 반대의 혼란이 생기기 때문.
 * 단, 이 값은 화면 편의용 게이팅일 뿐 실제 방어선은 항상 서버 403이다(숨김 우회 대비).
 */
export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  TESTER: 1,
  QA_LEAD: 2,
  ADMIN: 3,
};

export function roleAtLeast(
  role: Role | null | undefined,
  minimum: Role
): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
