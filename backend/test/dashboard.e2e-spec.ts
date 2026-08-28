// PLAN.md C5 — 대시보드 집계. 조직별 완전 분리 + DATA-MODEL.md 5장 "3~4쿼리 고정" 예산 증명.
import { Role } from '@prisma/client';
import { runWithRequestContext } from '../src/common/context/request-context';
import { DashboardService } from '../src/dashboard/dashboard.service';
import {
  addMember,
  authedAgent,
  registerAndLogin,
  seedOrganization,
  typedBody,
  type AuthedUser,
} from './support/fixtures';
import { attachQueryCounter } from './support/query-counter';
import {
  bootstrapTestApp,
  teardownTestApp,
  type TestApp,
} from './support/test-app';

interface CaseResponse {
  id: string;
}
interface RunResponse {
  id: string;
}
interface RunCaseResponse {
  id: string;
}
interface SummaryResponse {
  runs: { active: number; completed: number };
  cases: { total: number };
  resultDistribution: Record<string, number>;
  openBugs: Record<string, number>;
  recentRuns: { id: string }[];
}

describe('대시보드 (e2e)', () => {
  jest.setTimeout(120_000);

  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await bootstrapTestApp();
  });

  afterAll(() => teardownTestApp(ctx));

  const authed = (user: AuthedUser) => authedAgent(ctx.app, user.accessToken);

  /** 조직 하나에 완료 실행 1건(PASS 1, FAIL 1) + 진행 중 실행 1건 + 열린 버그 1건을 채운다. */
  async function seedDashboardData(orgId: string, admin: AuthedUser) {
    const suite = await ctx.prisma.testSuite.create({
      data: {
        organizationId: orgId,
        name: '대시보드 스위트',
        createdById: admin.userId,
      },
    });
    const createCase = async (title: string) => {
      const res = await authed(admin)
        .post(`/api/orgs/${orgId}/cases`)
        .send({
          suiteId: suite.id,
          title,
          steps: [{ order: 1, action: '확인' }],
          expectedResult: '통과',
        });
      return typedBody<CaseResponse>(res).id;
    };

    const caseA = await createCase('완료 실행 케이스 A');
    const caseB = await createCase('완료 실행 케이스 B');
    const completedRun = await authed(admin)
      .post(`/api/orgs/${orgId}/runs`)
      .send({ name: '완료된 실행', caseIds: [caseA, caseB] });
    const completedRunId = typedBody<RunResponse>(completedRun).id;
    await authed(admin)
      .patch(`/api/orgs/${orgId}/runs/${completedRunId}/status`)
      .send({ status: 'IN_PROGRESS' });
    const completedCases = typedBody<RunCaseResponse[]>(
      await authed(admin).get(
        `/api/orgs/${orgId}/runs/${completedRunId}/cases`,
      ),
    );
    await authed(admin)
      .patch(
        `/api/orgs/${orgId}/runs/${completedRunId}/cases/${completedCases[0].id}`,
      )
      .send({ result: 'PASS' });
    await authed(admin)
      .patch(
        `/api/orgs/${orgId}/runs/${completedRunId}/cases/${completedCases[1].id}`,
      )
      .send({ result: 'FAIL' });
    await authed(admin)
      .patch(`/api/orgs/${orgId}/runs/${completedRunId}/status`)
      .send({ status: 'COMPLETED' });

    const caseC = await createCase('진행 중 실행 케이스');
    const inProgressRun = await authed(admin)
      .post(`/api/orgs/${orgId}/runs`)
      .send({ name: '진행 중 실행', caseIds: [caseC] });
    await authed(admin)
      .patch(
        `/api/orgs/${orgId}/runs/${typedBody<RunResponse>(inProgressRun).id}/status`,
      )
      .send({ status: 'IN_PROGRESS' });

    await authed(admin)
      .post(`/api/orgs/${orgId}/bugs`)
      .send({
        title: '열린 버그',
        description: '설명',
        stepsToReproduce: [{ order: 1, action: '재현' }],
        severity: 'CRITICAL',
      });
  }

  describe('조직별 완전 분리', () => {
    let orgA: { id: string };
    let orgB: { id: string };
    let adminA: AuthedUser;
    let adminB: AuthedUser;

    beforeAll(async () => {
      orgA = await seedOrganization(ctx.prisma, 'Dashboard Org A');
      orgB = await seedOrganization(ctx.prisma, 'Dashboard Org B');
      adminA = await registerAndLogin(ctx.app, 'dash-admin-a@example.com');
      adminB = await registerAndLogin(ctx.app, 'dash-admin-b@example.com');
      await addMember(ctx.prisma, orgA.id, adminA.userId, Role.ADMIN);
      await addMember(ctx.prisma, orgB.id, adminB.userId, Role.ADMIN);

      // B에 A보다 데이터가 더 많아도(비대칭) A 수치에 절대 섞이지 않아야 한다.
      await seedDashboardData(orgA.id, adminA);
      await seedDashboardData(orgB.id, adminB);
      await seedDashboardData(orgB.id, adminB);
    });

    it('org A summary는 org A 데이터만 반영한다', async () => {
      const res = await authed(adminA).get(
        `/api/orgs/${orgA.id}/dashboard/summary`,
      );
      expect(res.status).toBe(200);
      const body = typedBody<SummaryResponse>(res);
      expect(body.runs.completed).toBe(1);
      expect(body.runs.active).toBe(1);
      expect(body.cases.total).toBe(3);
      expect(body.resultDistribution.PASS).toBe(1);
      expect(body.resultDistribution.FAIL).toBe(1);
      expect(body.openBugs.CRITICAL).toBe(1);
    });

    it('org B summary는 org B 데이터(2배)만 반영하고 org A와 섞이지 않는다', async () => {
      const res = await authed(adminB).get(
        `/api/orgs/${orgB.id}/dashboard/summary`,
      );
      expect(res.status).toBe(200);
      const body = typedBody<SummaryResponse>(res);
      expect(body.runs.completed).toBe(2);
      expect(body.runs.active).toBe(2);
      expect(body.cases.total).toBe(6);
      expect(body.resultDistribution.PASS).toBe(2);
      expect(body.resultDistribution.FAIL).toBe(2);
      expect(body.openBugs.CRITICAL).toBe(2);
    });

    it('pass-rate-trend도 조직별로 분리된다(완료 실행만, 카운터만 읽음)', async () => {
      const res = await authed(adminA).get(
        `/api/orgs/${orgA.id}/dashboard/pass-rate-trend`,
      );
      expect(res.status).toBe(200);
      const trend = typedBody<{ passRate: number; total: number }[]>(res);
      expect(trend).toHaveLength(1);
      expect(trend[0].total).toBe(2);
      expect(trend[0].passRate).toBeCloseTo(0.5);
    });
  });

  describe('쿼리 예산: summary는 항상 4개 쿼리 고정(N+1 없음)', () => {
    it('데이터가 있는 조직과 빈 조직 모두 쿼리 수가 4로 동일하다', async () => {
      const dashboardService = ctx.moduleRef.get(DashboardService);
      const counter = attachQueryCounter(ctx.prisma);

      const emptyOrg = await seedOrganization(ctx.prisma, 'Dashboard Empty');
      counter.reset();
      await runWithRequestContext(
        { organizationId: emptyOrg.id, role: Role.ADMIN },
        () => dashboardService.summary(),
      );
      expect(counter.count).toBe(4);

      const busyOrg = await seedOrganization(ctx.prisma, 'Dashboard Busy');
      const busyAdmin = await registerAndLogin(
        ctx.app,
        'dash-busy-admin@example.com',
      );
      await addMember(ctx.prisma, busyOrg.id, busyAdmin.userId, Role.ADMIN);
      await seedDashboardData(busyOrg.id, busyAdmin);

      counter.reset();
      await runWithRequestContext(
        { organizationId: busyOrg.id, role: Role.ADMIN },
        () => dashboardService.summary(),
      );
      expect(counter.count).toBe(4);
    });
  });
});
