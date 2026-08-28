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

// ───────── C7: 실행 · 버그 · 대시보드 · 감사로그 ─────────

export type RunStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "ABORTED";
export type RunCaseResult = "PENDING" | "PASS" | "FAIL" | "BLOCKED" | "SKIPPED";
export type BugSeverity = "MINOR" | "MAJOR" | "CRITICAL";
export type BugStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "WONTFIX";

/** run-counters.ts와 동일한 필드 모양 — progress/passRate는 서버가 카운터로 계산해 내려준다. */
export interface RunCounters {
  totalCount: number;
  passedCount: number;
  failedCount: number;
  blockedCount: number;
  skippedCount: number;
  progress: number;
  passRate: number;
}

export interface RunAssignee {
  userId: string;
  name: string;
}

/** GET /orgs/:orgId/runs 항목 및 GET .../runs/:runId 상세(형태 동일). */
export interface RunSummary extends RunCounters {
  id: string;
  name: string;
  description: string | null;
  status: RunStatus;
  assignees: RunAssignee[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

/** GET /orgs/:orgId/runs/:runId/cases 항목. */
export interface RunCaseItem {
  id: string;
  position: number;
  title: string;
  steps: CaseStep[];
  expectedResult: string;
  priority: CasePriority;
  result: RunCaseResult;
  comment: string | null;
  recordedBy: { id: string; name?: string } | null;
  recordedAt: string | null;
}

/** GET .../runs/:runId/cases/:runCaseId/bug-draft 응답(저장 안 함, 프리필용). */
export interface BugDraft {
  title: string;
  description: string;
  stepsToReproduce: CaseStep[];
}

export interface RunCaseSummary {
  id: string;
  testRunId: string;
  title: string;
  result: RunCaseResult;
}

export interface BugSummary {
  id: string;
  title: string;
  description: string;
  stepsToReproduce: CaseStep[];
  severity: BugSeverity;
  status: BugStatus;
  assigneeId: string | null;
  testRunCaseId: string | null;
  reportedById: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BugDetail extends BugSummary {
  runCase: RunCaseSummary | null;
}

/** GET /orgs/:orgId/dashboard/summary 응답(API.md 7장). */
export interface DashboardSummary {
  runs: { active: number; completed: number };
  cases: { total: number };
  resultDistribution: Record<RunCaseResult, number>;
  openBugs: Record<BugSeverity, number>;
  recentRuns: Array<
    Pick<RunSummary, "id" | "name" | "status" | "createdAt"> &
      RunCounters & {
        startedAt: string | null;
        completedAt: string | null;
      }
  >;
}

/** GET /orgs/:orgId/dashboard/pass-rate-trend 항목. */
export interface PassRateTrendPoint {
  runId: string;
  name: string;
  completedAt: string | null;
  passRate: number;
  total: number;
}

/** GET /orgs/:orgId/audit-logs 항목. */
export interface AuditLogItem {
  id: string;
  action: string;
  actor: { id: string; email: string } | null;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, [unknown, unknown]> | null;
  ip: string | null;
  createdAt: string;
}

/** run:presence.updated 페이로드의 참여자 항목. */
export interface RunParticipant {
  userId: string;
  name: string;
}
