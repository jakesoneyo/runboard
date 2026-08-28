// PLAN.md C5 — 버그 리포트 CRUD. 타 조직 testRunCaseId로 생성 시 404, TESTER는 생성 가능하지만
// 상태 변경(PATCH)은 403(QA_LEAD+ 필요), RESOLVED 전이 시 resolvedAt 세팅.
import { Role } from '@prisma/client';
import {
  addMember,
  authedAgent,
  registerAndLogin,
  seedOrganization,
  typedBody,
  type AuthedUser,
} from './support/fixtures';
import {
  bootstrapTestApp,
  teardownTestApp,
  type TestApp,
} from './support/test-app';

interface ErrorBody {
  code: string;
}
interface BugResponse {
  id: string;
  title: string;
  status: string;
  severity: string;
  resolvedAt: string | null;
}
interface CaseResponse {
  id: string;
}
interface RunResponse {
  id: string;
}
interface RunCaseResponse {
  id: string;
}

describe('버그 리포트 (e2e)', () => {
  jest.setTimeout(120_000);

  let ctx: TestApp;
  let org: { id: string };
  let otherOrg: { id: string };
  let admin: AuthedUser;
  let qaLead: AuthedUser;
  let tester: AuthedUser;
  let viewer: AuthedUser;
  let suiteId: string;

  beforeAll(async () => {
    ctx = await bootstrapTestApp();
    org = await seedOrganization(ctx.prisma, 'Bugs Org');
    otherOrg = await seedOrganization(ctx.prisma, 'Bugs Org (Other)');
    admin = await registerAndLogin(ctx.app, 'bugs-admin@example.com');
    qaLead = await registerAndLogin(ctx.app, 'bugs-qalead@example.com');
    tester = await registerAndLogin(ctx.app, 'bugs-tester@example.com');
    viewer = await registerAndLogin(ctx.app, 'bugs-viewer@example.com');
    await addMember(ctx.prisma, org.id, admin.userId, Role.ADMIN);
    await addMember(ctx.prisma, org.id, qaLead.userId, Role.QA_LEAD);
    await addMember(ctx.prisma, org.id, tester.userId, Role.TESTER);
    await addMember(ctx.prisma, org.id, viewer.userId, Role.VIEWER);

    const suite = await ctx.prisma.testSuite.create({
      data: {
        organizationId: org.id,
        name: '버그용 스위트',
        createdById: admin.userId,
      },
    });
    suiteId = suite.id;
  });

  afterAll(() => teardownTestApp(ctx));

  const authed = (user: AuthedUser) => authedAgent(ctx.app, user.accessToken);
  const bugsUrl = (suffix = '') => `/api/orgs/${org.id}/bugs${suffix}`;

  /** IN_PROGRESS 실행 하나 + RunCase 하나를 만들어 testRunCaseId로 쓸 수 있게 반환한다. */
  async function createRunCase(): Promise<string> {
    const caseRes = await authed(qaLead)
      .post(`/api/orgs/${org.id}/cases`)
      .send({
        suiteId,
        title: '버그 대상 케이스',
        steps: [{ order: 1, action: '확인' }],
        expectedResult: '통과',
      });
    const caseId = typedBody<CaseResponse>(caseRes).id;
    const runRes = await authed(qaLead)
      .post(`/api/orgs/${org.id}/runs`)
      .send({ name: '버그 대상 실행', caseIds: [caseId] });
    const runId = typedBody<RunResponse>(runRes).id;
    const casesRes = await authed(qaLead).get(
      `/api/orgs/${org.id}/runs/${runId}/cases`,
    );
    return typedBody<RunCaseResponse[]>(casesRes)[0].id;
  }

  describe('생성', () => {
    it('직접 생성(testRunCaseId 없이)도 TESTER면 201', async () => {
      const res = await authed(tester)
        .post(bugsUrl())
        .send({
          title: '직접 생성 버그',
          description: '설명',
          stepsToReproduce: [{ order: 1, action: '재현' }],
          severity: 'MINOR',
        });
      expect(res.status).toBe(201);
      expect(typedBody<BugResponse>(res).title).toBe('직접 생성 버그');
    });

    it('VIEWER는 403 ORG_FORBIDDEN', async () => {
      const res = await authed(viewer)
        .post(bugsUrl())
        .send({
          title: 'VIEWER 생성 시도',
          description: '설명',
          stepsToReproduce: [{ order: 1, action: '재현' }],
          severity: 'MINOR',
        });
      expect(res.status).toBe(403);
      expect(typedBody<ErrorBody>(res).code).toBe('ORG_FORBIDDEN');
    });

    it('RunCase 기반 생성: testRunCaseId가 이 조직 소속이면 201', async () => {
      const runCaseId = await createRunCase();
      const res = await authed(tester)
        .post(bugsUrl())
        .send({
          title: 'RunCase 기반 버그',
          description: '설명',
          stepsToReproduce: [{ order: 1, action: '재현' }],
          severity: 'CRITICAL',
          testRunCaseId: runCaseId,
        });
      expect(res.status).toBe(201);
    });

    it('타 조직 testRunCaseId로 생성 시도 시 404', async () => {
      // otherOrg 소속 실행 케이스를 원본 클라이언트로 직접 만든다(서비스가 크로스 조직 참조를 거부하는지 검증).
      const foreignRun = await ctx.prisma.testRun.create({
        data: {
          organizationId: otherOrg.id,
          name: '다른 조직 실행',
          createdById: admin.userId,
        },
      });
      const foreignRunCase = await ctx.prisma.testRunCase.create({
        data: {
          organizationId: otherOrg.id,
          testRunId: foreignRun.id,
          title: '다른 조직 케이스',
          steps: [],
          expectedResult: '기대값',
          priority: 'MEDIUM',
        },
      });

      const res = await authed(tester)
        .post(bugsUrl())
        .send({
          title: '크로스 조직 시도',
          description: '설명',
          stepsToReproduce: [{ order: 1, action: '재현' }],
          severity: 'MAJOR',
          testRunCaseId: foreignRunCase.id,
        });
      expect(res.status).toBe(404);
      expect(typedBody<ErrorBody>(res).code).toBe('NOT_FOUND');

      const bugCount = await ctx.prisma.bugReport.count({
        where: { organizationId: org.id, title: '크로스 조직 시도' },
      });
      expect(bugCount).toBe(0);
    });
  });

  describe('상태 변경/수정', () => {
    let bugId: string;

    beforeAll(async () => {
      const res = await authed(tester)
        .post(bugsUrl())
        .send({
          title: '상태 변경 대상 버그',
          description: '설명',
          stepsToReproduce: [{ order: 1, action: '재현' }],
          severity: 'MAJOR',
        });
      bugId = typedBody<BugResponse>(res).id;
    });

    it('TESTER가 상태를 바꾸려 하면 403 ORG_FORBIDDEN(생성 권한과 별개)', async () => {
      const res = await authed(tester)
        .patch(bugsUrl(`/${bugId}`))
        .send({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(403);
      expect(typedBody<ErrorBody>(res).code).toBe('ORG_FORBIDDEN');
    });

    it('QA_LEAD는 상태를 RESOLVED로 바꿀 수 있고 resolvedAt이 세팅된다', async () => {
      const res = await authed(qaLead)
        .patch(bugsUrl(`/${bugId}`))
        .send({ status: 'RESOLVED' });
      expect(res.status).toBe(200);
      const body = typedBody<BugResponse>(res);
      expect(body.status).toBe('RESOLVED');
      expect(body.resolvedAt).not.toBeNull();
    });

    it('BUG_STATUS_CHANGED 감사로그가 남는다', async () => {
      const res = await authed(admin).get(
        `/api/orgs/${org.id}/audit-logs?action=BUG_STATUS_CHANGED&targetId=${bugId}`,
      );
      expect(res.status).toBe(200);
      expect(typedBody<{ items: unknown[] }>(res).items.length).toBeGreaterThan(
        0,
      );
    });
  });

  describe('상세 조회', () => {
    it('연결된 RunCase 요약을 포함한다', async () => {
      const runCaseId = await createRunCase();
      const created = await authed(tester)
        .post(bugsUrl())
        .send({
          title: '상세 조회용 버그',
          description: '설명',
          stepsToReproduce: [{ order: 1, action: '재현' }],
          severity: 'MINOR',
          testRunCaseId: runCaseId,
        });
      const bugId = typedBody<BugResponse>(created).id;

      const res = await authed(admin).get(bugsUrl(`/${bugId}`));
      expect(res.status).toBe(200);
      expect(
        typedBody<{ runCase: { id: string } | null }>(res).runCase?.id,
      ).toBe(runCaseId);
    });

    it('존재하지 않는 버그는 404', async () => {
      const res = await authed(admin).get(
        bugsUrl('/00000000-0000-0000-0000-000000000000'),
      );
      expect(res.status).toBe(404);
    });
  });
});
