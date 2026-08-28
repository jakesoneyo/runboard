/**
 * 백엔드 API.md·UBIQUITOUS_LANGUAGE.md와 필드 형태를 맞춘 프론트 전용 타입 모음.
 * 모노레포가 아니므로 backend/src를 import하지 않고, 이 파일에 형태만 복제해 둔다.
 */

/** 조직 안에서의 권한 등급. ADMIN > QA_LEAD > TESTER > VIEWER(lib/roles.ts 참고). */
export type Role = "ADMIN" | "QA_LEAD" | "TESTER" | "VIEWER";

export type CasePriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface User {
  id: string;
  email: string;
  name: string;
}

/** POST /auth/login 응답의 memberships[] 항목. */
export interface LoginMembership {
  organizationId: string;
  name: string;
  slug: string;
  role: Role;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  memberships: LoginMembership[];
}

/** GET /orgs 목록 항목. */
export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  role: Role;
  memberCount: number;
}

export interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  myRole: Role;
}

export interface Member {
  userId: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
}

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  status: InvitationStatus;
  expiresAt: string;
}

export interface CreatedInvitation {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  inviteUrl: string;
}

/** GET /orgs/:orgId/suites?tree=true 노드. */
export interface SuiteTreeNode {
  id: string;
  name: string;
  position: number;
  caseCount: number;
  children: SuiteTreeNode[];
}

export interface CaseStep {
  order: number;
  action: string;
  expected?: string;
}

/** 목록 응답 — steps는 제외된다(API.md 4장). */
export interface CaseSummary {
  id: string;
  suiteId: string;
  title: string;
  preconditions: string | null;
  expectedResult: string;
  priority: CasePriority;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseDetail extends CaseSummary {
  steps: CaseStep[];
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

/** API.md 1장 공통 에러 포맷. */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details: unknown;
}
