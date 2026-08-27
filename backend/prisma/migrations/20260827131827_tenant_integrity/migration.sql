-- DATA-MODEL.md 6장: Prisma DSL이 표현하지 못하는 테넌트 무결성 제약을 SQL로 직접 보강한다.
-- 단일 컬럼 FK는 같은 마이그레이션에서 복합 FK로 교체(DROP 후 ADD) — 앱/가드가 뚫려도 DB가 조직 경계를 거부하게 만드는 최후의 그물.

-- 스위트 자기참조: 단일 FK를 복합 FK로 교체 — 부모가 같은 조직인지 DB가 보장
ALTER TABLE "test_suites" DROP CONSTRAINT "test_suites_parentId_fkey";
ALTER TABLE "test_suites"
  ADD CONSTRAINT "test_suites_parent_same_org_fkey"
  FOREIGN KEY ("parentId", "organizationId")
  REFERENCES "test_suites"("id", "organizationId") ON DELETE CASCADE;

-- 버그 → 실행 케이스: 단일 FK를 복합 FK로 교체 — 다른 조직의 실행 케이스 참조 차단
ALTER TABLE "bug_reports" DROP CONSTRAINT "bug_reports_testRunCaseId_fkey";
ALTER TABLE "bug_reports"
  ADD CONSTRAINT "bug_reports_runcase_same_org_fkey"
  FOREIGN KEY ("testRunCaseId", "organizationId")
  REFERENCES "test_run_cases"("id", "organizationId") ON DELETE SET NULL;

-- 결과가 기록된 RunCase는 기록자·기록시각이 반드시 함께 있어야 한다
ALTER TABLE "test_run_cases"
  ADD CONSTRAINT "test_run_cases_recorded_consistency"
  CHECK ((result = 'PENDING') OR ("recordedById" IS NOT NULL AND "recordedAt" IS NOT NULL));
