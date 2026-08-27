-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'QA_LEAD', 'TESTER', 'VIEWER');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CasePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ABORTED');

-- CreateEnum
CREATE TYPE "RunCaseResult" AS ENUM ('PENDING', 'PASS', 'FAIL', 'BLOCKED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "BugSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BugStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'WONTFIX');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('ORG_CREATED', 'MEMBER_INVITED', 'MEMBER_JOINED', 'MEMBER_ROLE_CHANGED', 'MEMBER_REMOVED', 'SUITE_CREATED', 'SUITE_UPDATED', 'SUITE_DELETED', 'CASE_CREATED', 'CASE_UPDATED', 'CASE_DELETED', 'RUN_CREATED', 'RUN_STARTED', 'RUN_COMPLETED', 'RUN_ABORTED', 'RUN_ASSIGNEES_CHANGED', 'RUNCASE_RESULT_RECORDED', 'BUG_CREATED', 'BUG_STATUS_CHANGED', 'BUG_UPDATED', 'AUTH_LOGIN_SUCCEEDED', 'AUTH_LOGIN_FAILED', 'AUTH_REFRESH_REUSE_DETECTED');

-- CreateEnum
CREATE TYPE "AuditTargetType" AS ENUM ('ORGANIZATION', 'MEMBERSHIP', 'INVITATION', 'TEST_SUITE', 'TEST_CASE', 'TEST_RUN', 'TEST_RUN_CASE', 'BUG_REPORT', 'USER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedById" UUID NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_suites" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "parentId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_suites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "suiteId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "preconditions" TEXT,
    "steps" JSONB NOT NULL,
    "expectedResult" TEXT NOT NULL,
    "priority" "CasePriority" NOT NULL DEFAULT 'MEDIUM',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_runs" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RunStatus" NOT NULL DEFAULT 'PLANNED',
    "createdById" UUID NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "passedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "blockedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_run_cases" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "testRunId" UUID NOT NULL,
    "sourceCaseId" UUID,
    "title" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "expectedResult" TEXT NOT NULL,
    "priority" "CasePriority" NOT NULL,
    "result" "RunCaseResult" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "recordedById" UUID,
    "recordedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_run_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_run_assignees" (
    "organizationId" UUID NOT NULL,
    "testRunId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_run_assignees_pkey" PRIMARY KEY ("testRunId","userId")
);

-- CreateTable
CREATE TABLE "bug_reports" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "testRunCaseId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "stepsToReproduce" JSONB NOT NULL,
    "severity" "BugSeverity" NOT NULL DEFAULT 'MAJOR',
    "status" "BugStatus" NOT NULL DEFAULT 'OPEN',
    "reportedById" UUID NOT NULL,
    "assigneeId" UUID,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "actorId" UUID,
    "actorEmail" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetType" "AuditTargetType" NOT NULL,
    "targetId" UUID,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_expiresAt_idx" ON "refresh_tokens"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "memberships_organizationId_role_idx" ON "memberships"("organizationId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_organizationId_key" ON "memberships"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "invitations_organizationId_status_createdAt_idx" ON "invitations"("organizationId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "invitations_email_status_idx" ON "invitations"("email", "status");

-- CreateIndex
CREATE INDEX "test_suites_organizationId_parentId_position_idx" ON "test_suites"("organizationId", "parentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "test_suites_id_organizationId_key" ON "test_suites"("id", "organizationId");

-- CreateIndex
CREATE INDEX "test_cases_organizationId_suiteId_priority_idx" ON "test_cases"("organizationId", "suiteId", "priority");

-- CreateIndex
CREATE INDEX "test_cases_organizationId_updatedAt_idx" ON "test_cases"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "test_cases_id_organizationId_key" ON "test_cases"("id", "organizationId");

-- CreateIndex
CREATE INDEX "test_runs_organizationId_createdAt_idx" ON "test_runs"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "test_runs_organizationId_status_idx" ON "test_runs"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "test_runs_id_organizationId_key" ON "test_runs"("id", "organizationId");

-- CreateIndex
CREATE INDEX "test_run_cases_testRunId_position_idx" ON "test_run_cases"("testRunId", "position");

-- CreateIndex
CREATE INDEX "test_run_cases_testRunId_result_idx" ON "test_run_cases"("testRunId", "result");

-- CreateIndex
CREATE INDEX "test_run_cases_organizationId_recordedAt_idx" ON "test_run_cases"("organizationId", "recordedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "test_run_cases_id_organizationId_key" ON "test_run_cases"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "test_run_cases_testRunId_sourceCaseId_key" ON "test_run_cases"("testRunId", "sourceCaseId");

-- CreateIndex
CREATE INDEX "test_run_assignees_userId_idx" ON "test_run_assignees"("userId");

-- CreateIndex
CREATE INDEX "bug_reports_organizationId_status_createdAt_idx" ON "bug_reports"("organizationId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "bug_reports_organizationId_severity_status_idx" ON "bug_reports"("organizationId", "severity", "status");

-- CreateIndex
CREATE INDEX "bug_reports_testRunCaseId_idx" ON "bug_reports"("testRunCaseId");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_targetType_targetId_idx" ON "audit_logs"("organizationId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_actorId_createdAt_idx" ON "audit_logs"("organizationId", "actorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_action_createdAt_idx" ON "audit_logs"("organizationId", "action", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suites" ADD CONSTRAINT "test_suites_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suites" ADD CONSTRAINT "test_suites_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "test_suites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_suiteId_organizationId_fkey" FOREIGN KEY ("suiteId", "organizationId") REFERENCES "test_suites"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_cases" ADD CONSTRAINT "test_run_cases_testRunId_organizationId_fkey" FOREIGN KEY ("testRunId", "organizationId") REFERENCES "test_runs"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_assignees" ADD CONSTRAINT "test_run_assignees_testRunId_organizationId_fkey" FOREIGN KEY ("testRunId", "organizationId") REFERENCES "test_runs"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_assignees" ADD CONSTRAINT "test_run_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_testRunCaseId_fkey" FOREIGN KEY ("testRunCaseId") REFERENCES "test_run_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
