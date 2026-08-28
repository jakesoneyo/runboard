// PLAN.md C4 그룹 3(REST 부분) — 실행 생성 스냅샷, 결과 기록 카운터, 배정/역할 인가, 상태 전이,
// C3 회귀(스위트·케이스 삭제 후에도 RunCase 스냅샷 보존). 소켓 관련 시나리오는 runs-realtime.e2e-spec.ts.
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
interface RunResponse {
  id: string;
  status: string;
  totalCount: number;
  passedCount: number;
  failedCount: number;
  blockedCount: number;
  skippedCount: number;
  progress: number;
  passRate: number;
}
interface RunCaseResponse {
  id: string;
  title: string;
  steps: unknown;
  result: string;
  comment: string | null;
  position: number;
}
interface CaseResponse {
  id: string;
}

describe('실행(TestRun) (e2e)', () => {
  jest.setTimeout(120_000);

  let ctx: TestApp;
  let org: { id: string };
  let admin: AuthedUser;
  let qaLead: AuthedUser;
  let tester: AuthedUser;
  let otherTester: AuthedUser;
  let viewer: AuthedUser;
  let suiteId: string;

  beforeAll(async () => {
    ctx = await bootstrapTestApp();
    org = await seedOrganization(ctx.prisma, 'Runs Org');
    admin = await registerAndLogin(ctx.app, 'runs-admin@example.com');
    qaLead = await registerAndLogin(ctx.app, 'runs-qalead@example.com');
    tester = await registerAndLogin(ctx.app, 'runs-tester@example.com');
    otherTester = await registerAndLogin(
      ctx.app,
      'runs-other-tester@example.com',
    );
    viewer = await registerAndLogin(ctx.app, 'runs-viewer@example.com');
    await addMember(ctx.prisma, org.id, admin.userId, Role.ADMIN);
    await addMember(ctx.prisma, org.id, qaLead.userId, Role.QA_LEAD);
    await addMember(ctx.prisma, org.id, tester.userId, Role.TESTER);
    await addMember(ctx.prisma, org.id, otherTester.userId, Role.TESTER);
    await addMember(ctx.prisma, org.id, viewer.userId, Role.VIEWER);

    const suite = await ctx.prisma.testSuite.create({
      data: {
        organizationId: org.id,
        name: '실행용 스위트',
        createdById: admin.userId,
      },
    });
    suiteId = suite.id;
  });

  afterAll(() => teardownTestApp(ctx));

  const authed = (user: AuthedUser) => authedAgent(ctx.app, user.accessToken);
  const runsUrl = (suffix = '') => `/api/orgs/${org.id}/runs${suffix}`;

  const createCase = async (title: string) => {
    const res = await authed(qaLead)
      .post(`/api/orgs/${org.id}/cases`)
      .send({
        suiteId,
        title,
        steps: [{ order: 1, action: '초기 스텝', expected: '초기 기대값' }],
        expectedResult: '초기 예상 결과',
        priority: 'MEDIUM',
      });
    expect(res.status).toBe(201);
    return typedBody<CaseResponse>(res).id;
  };

  describe('T-19: 케이스 0건으로 실행 생성', () => {
    it('suiteIds/caseIds를 모두 비우면 400 VALIDATION_FAILED', async () => {
      const res = await authed(qaLead)
        .post(runsUrl())
        .send({ name: '빈 실행' });
      expect(res.status).toBe(400);
      expect(typedBody<ErrorBody>(res).code).toBe('VALIDATION_FAILED');
    });

    it('caseIds가 이 조직에 존재하지 않는 id뿐이면 400 RUN_NO_CASES', async () => {
      const res = await authed(qaLead)
        .post(runsUrl())
        .send({
          name: '존재하지 않는 케이스로 만든 실행',
          caseIds: ['00000000-0000-0000-0000-000000000000'],
        });
      expect(res.status).toBe(400);
      expect(typedBody<ErrorBody>(res).code).toBe('RUN_NO_CASES');
    });
  });

  describe('T-9/T-10: 배정 여부에 따른 결과 기록 권한', () => {
    let runId: string;
    let runCaseId: string;

    beforeAll(async () => {
      const caseId = await createCase('배정 테스트 케이스');
      const created = await authed(qaLead)
        .post(runsUrl())
        .send({
          name: '배정 테스트 실행',
          caseIds: [caseId],
          assigneeIds: [tester.userId],
        });
      expect(created.status).toBe(201);
      runId = typedBody<RunResponse>(created).id;

      const started = await authed(qaLead)
        .patch(runsUrl(`/${runId}/status`))
        .send({ status: 'IN_PROGRESS' });
      expect(started.status).toBe(200);

      const cases = await authed(qaLead).get(runsUrl(`/${runId}/cases`));
      runCaseId = typedBody<RunCaseResponse[]>(cases)[0].id;
    });

    it('미배정 TESTER는 403 RUN_NOT_ASSIGNED', async () => {
      const res = await authed(otherTester)
        .patch(runsUrl(`/${runId}/cases/${runCaseId}`))
        .send({ result: 'PASS' });
      expect(res.status).toBe(403);
      expect(typedBody<ErrorBody>(res).code).toBe('RUN_NOT_ASSIGNED');
    });

    it('VIEWER는 403 ORG_FORBIDDEN(역할 자체가 부족)', async () => {
      const res = await authed(viewer)
        .patch(runsUrl(`/${runId}/cases/${runCaseId}`))
        .send({ result: 'PASS' });
      expect(res.status).toBe(403);
      expect(typedBody<ErrorBody>(res).code).toBe('ORG_FORBIDDEN');
    });

    it('배정된 TESTER는 200', async () => {
      const res = await authed(tester)
        .patch(runsUrl(`/${runId}/cases/${runCaseId}`))
        .send({ result: 'FAIL', comment: '재현됨' });
      expect(res.status).toBe(200);
    });

    it('QA_LEAD는 배정 없이도 200', async () => {
      const res = await authed(qaLead)
        .patch(runsUrl(`/${runId}/cases/${runCaseId}`))
        .send({ result: 'PASS' });
      expect(res.status).toBe(200);
    });
  });

  describe('T-14: RunCase는 생성 시점 스냅샷 — 원본 케이스 수정이 반영되지 않는다', () => {
    it('원본 title/steps를 바꿔도 실행 케이스는 그대로다', async () => {
      const caseId = await createCase('스냅샷 원본 케이스');
      const created = await authed(qaLead)
        .post(runsUrl())
        .send({ name: '스냅샷 실행', caseIds: [caseId] });
      const runId = typedBody<RunResponse>(created).id;

      const before = await authed(qaLead).get(runsUrl(`/${runId}/cases`));
      const runCase = typedBody<RunCaseResponse[]>(before)[0];
      expect(runCase.title).toBe('스냅샷 원본 케이스');

      const newSteps = [{ order: 1, action: '완전히 다른 스텝' }];
      const updated = await authed(qaLead)
        .patch(`/api/orgs/${org.id}/cases/${caseId}`)
        .send({ title: '원본만 바뀐 제목', steps: newSteps });
      expect(updated.status).toBe(200);

      const after = await authed(qaLead).get(runsUrl(`/${runId}/cases`));
      const runCaseAfter = typedBody<RunCaseResponse[]>(after)[0];
      expect(runCaseAfter.title).toBe('스냅샷 원본 케이스');
      expect(runCaseAfter.steps).toEqual([
        { order: 1, action: '초기 스텝', expected: '초기 기대값' },
      ]);
    });
  });

  describe('C3 회귀: 스위트/케이스를 삭제해도 RunCase 스냅샷은 남는다', () => {
    it('케이스와 스위트를 삭제한 뒤에도 실행 케이스 목록에서 스냅샷을 조회할 수 있다', async () => {
      const deletableSuite = await ctx.prisma.testSuite.create({
        data: {
          organizationId: org.id,
          name: '삭제될 스위트',
          createdById: admin.userId,
        },
      });
      const caseRes = await authed(qaLead)
        .post(`/api/orgs/${org.id}/cases`)
        .send({
          suiteId: deletableSuite.id,
          title: '삭제될 케이스',
          steps: [{ order: 1, action: '확인' }],
          expectedResult: '통과',
        });
      const caseId = typedBody<CaseResponse>(caseRes).id;

      const created = await authed(qaLead)
        .post(runsUrl())
        .send({ name: '보존 확인용 실행', caseIds: [caseId] });
      const runId = typedBody<RunResponse>(created).id;

      const delCase = await authed(qaLead).delete(
        `/api/orgs/${org.id}/cases/${caseId}`,
      );
      expect(delCase.status).toBe(204);
      const delSuite = await authed(qaLead).delete(
        `/api/orgs/${org.id}/suites/${deletableSuite.id}`,
      );
      expect(delSuite.status).toBe(204);

      const cases = await authed(qaLead).get(runsUrl(`/${runId}/cases`));
      expect(cases.status).toBe(200);
      const snapshot = typedBody<RunCaseResponse[]>(cases);
      expect(snapshot).toHaveLength(1);
      expect(snapshot[0].title).toBe('삭제될 케이스');
    });
  });

  describe('결과 기록 카운터 원자 갱신(T-15 REST 부분) + 상태 전이 + 409', () => {
    let runId: string;
    let runCaseId: string;

    beforeAll(async () => {
      const caseId = await createCase('카운터 테스트 케이스');
      const created = await authed(qaLead)
        .post(runsUrl())
        .send({ name: '카운터 실행', caseIds: [caseId] });
      runId = typedBody<RunResponse>(created).id;
      const cases = await authed(qaLead).get(runsUrl(`/${runId}/cases`));
      runCaseId = typedBody<RunCaseResponse[]>(cases)[0].id;
    });

    it('PLANNED 상태에서 기록 시도는 409 RUN_NOT_IN_PROGRESS', async () => {
      const res = await authed(qaLead)
        .patch(runsUrl(`/${runId}/cases/${runCaseId}`))
        .send({ result: 'PASS' });
      expect(res.status).toBe(409);
      expect(typedBody<ErrorBody>(res).code).toBe('RUN_NOT_IN_PROGRESS');
    });

    it('IN_PROGRESS로 전이 후 FAIL→PASS 연속 기록해도 카운터 합계 = total', async () => {
      const start = await authed(qaLead)
        .patch(runsUrl(`/${runId}/status`))
        .send({ status: 'IN_PROGRESS' });
      expect(start.status).toBe(200);

      const fail = await authed(qaLead)
        .patch(runsUrl(`/${runId}/cases/${runCaseId}`))
        .send({ result: 'FAIL' });
      expect(fail.status).toBe(200);
      expect(
        typedBody<{ counters: RunResponse }>(fail).counters.failedCount,
      ).toBe(1);

      const pass = await authed(qaLead)
        .patch(runsUrl(`/${runId}/cases/${runCaseId}`))
        .send({ result: 'PASS' });
      expect(pass.status).toBe(200);
      const counters = typedBody<{ counters: RunResponse }>(pass).counters;
      expect(counters.failedCount).toBe(0);
      expect(counters.passedCount).toBe(1);
      const sum =
        counters.passedCount +
        counters.failedCount +
        counters.blockedCount +
        counters.skippedCount;
      expect(sum).toBeLessThanOrEqual(counters.totalCount);
      expect(sum).toBe(1); // 이 실행엔 케이스가 1개뿐 — 합계가 total과 일치
    });

    it('COMPLETED로 전이 후 기록 시도는 다시 409 RUN_NOT_IN_PROGRESS', async () => {
      const complete = await authed(qaLead)
        .patch(runsUrl(`/${runId}/status`))
        .send({ status: 'COMPLETED' });
      expect(complete.status).toBe(200);

      const res = await authed(qaLead)
        .patch(runsUrl(`/${runId}/cases/${runCaseId}`))
        .send({ result: 'PASS' });
      expect(res.status).toBe(409);
      expect(typedBody<ErrorBody>(res).code).toBe('RUN_NOT_IN_PROGRESS');
    });

    it('종료 상태에서 다른 상태로 되돌리는 전이는 409 RUN_INVALID_TRANSITION', async () => {
      const res = await authed(qaLead)
        .patch(runsUrl(`/${runId}/status`))
        .send({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(409);
      expect(typedBody<ErrorBody>(res).code).toBe('RUN_INVALID_TRANSITION');
    });
  });

  describe('배정자 전체 치환', () => {
    it('조직 밖 사용자를 포함하면 404', async () => {
      const caseId = await createCase('배정자 테스트 케이스');
      const created = await authed(qaLead)
        .post(runsUrl())
        .send({ name: '배정자 실행', caseIds: [caseId] });
      const runId = typedBody<RunResponse>(created).id;

      const outsider = await registerAndLogin(
        ctx.app,
        'runs-outsider@example.com',
      );
      const res = await authed(qaLead)
        .put(runsUrl(`/${runId}/assignees`))
        .send({ userIds: [outsider.userId] });
      expect(res.status).toBe(404);
    });

    it('조직 멤버로만 구성하면 200이고 배정자 목록이 치환된다', async () => {
      const caseId = await createCase('배정자 성공 케이스');
      const created = await authed(qaLead)
        .post(runsUrl())
        .send({ name: '배정자 성공 실행', caseIds: [caseId] });
      const runId = typedBody<RunResponse>(created).id;

      const res = await authed(qaLead)
        .put(runsUrl(`/${runId}/assignees`))
        .send({ userIds: [tester.userId, otherTester.userId] });
      expect(res.status).toBe(200);
      expect(
        typedBody<{ assignees: { userId: string }[] }>(res).assignees,
      ).toHaveLength(2);
    });
  });

  describe('버그 초안 프리필', () => {
    it('RunCase 스냅샷 기반으로 title/stepsToReproduce를 채워 돌려준다(저장 안 함)', async () => {
      const caseId = await createCase('버그 초안용 케이스');
      const created = await authed(qaLead)
        .post(runsUrl())
        .send({ name: '버그 초안 실행', caseIds: [caseId] });
      const runId = typedBody<RunResponse>(created).id;
      const cases = await authed(qaLead).get(runsUrl(`/${runId}/cases`));
      const runCaseId = typedBody<RunCaseResponse[]>(cases)[0].id;

      const res = await authed(tester).get(
        runsUrl(`/${runId}/cases/${runCaseId}/bug-draft`),
      );
      expect(res.status).toBe(200);
      const draft = typedBody<{
        title: string;
        stepsToReproduce: unknown[];
      }>(res);
      expect(draft.title).toContain('버그 초안용 케이스');
      expect(draft.stepsToReproduce).toHaveLength(1);

      const bugCount = await ctx.prisma.bugReport.count({
        where: { organizationId: org.id },
      });
      expect(bugCount).toBe(0); // 초안은 저장되지 않는다
    });
  });

  describe('RBAC: QA_LEAD 미만은 실행 생성/상태 변경/배정 불가', () => {
    it.each([
      ['VIEWER', () => viewer],
      ['TESTER', () => tester],
    ] as const)('%s가 실행을 생성하면 403', async (_label, getUser) => {
      const res = await authed(getUser())
        .post(runsUrl())
        .send({ name: '권한 없는 생성', suiteIds: [suiteId] });
      expect(res.status).toBe(403);
      expect(typedBody<ErrorBody>(res).code).toBe('ORG_FORBIDDEN');
    });
  });
});
