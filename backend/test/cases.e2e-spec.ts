// PLAN.md C3 — 테스트케이스 CRUD. steps 제외 목록, 변경 필드만 남는 감사로그, 크로스테넌트 차단.
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
interface CaseResponse {
  id: string;
  suiteId: string;
  title: string;
  priority: string;
  steps?: unknown;
}
interface CaseListResponse {
  items: CaseResponse[];
  nextCursor: string | null;
}
interface AuditLogListResponse {
  items: { action: string; metadata: Record<string, unknown> | null }[];
}

describe('테스트케이스 CRUD (e2e)', () => {
  jest.setTimeout(120_000);

  let ctx: TestApp;
  let org: { id: string };
  let suiteId: string;
  let admin: AuthedUser;
  let qaLead: AuthedUser;
  let tester: AuthedUser;
  let viewer: AuthedUser;

  beforeAll(async () => {
    ctx = await bootstrapTestApp();
    org = await seedOrganization(ctx.prisma, 'Cases Org');
    admin = await registerAndLogin(ctx.app, 'cases-admin@example.com');
    qaLead = await registerAndLogin(ctx.app, 'cases-qalead@example.com');
    tester = await registerAndLogin(ctx.app, 'cases-tester@example.com');
    viewer = await registerAndLogin(ctx.app, 'cases-viewer@example.com');
    await addMember(ctx.prisma, org.id, admin.userId, Role.ADMIN);
    await addMember(ctx.prisma, org.id, qaLead.userId, Role.QA_LEAD);
    await addMember(ctx.prisma, org.id, tester.userId, Role.TESTER);
    await addMember(ctx.prisma, org.id, viewer.userId, Role.VIEWER);

    const suite = await ctx.prisma.testSuite.create({
      data: {
        organizationId: org.id,
        name: '기본 스위트',
        createdById: admin.userId,
      },
    });
    suiteId = suite.id;
  });

  afterAll(() => teardownTestApp(ctx));

  const authed = (user: AuthedUser) => authedAgent(ctx.app, user.accessToken);
  const casesUrl = (suffix = '') => `/api/orgs/${org.id}/cases${suffix}`;

  const validCasePayload = (overrides: Record<string, unknown> = {}) => ({
    suiteId,
    title: '로그인 성공',
    preconditions: '유효한 계정 보유',
    steps: [
      { order: 1, action: '이메일/비밀번호 입력', expected: '입력값 반영' },
      { order: 2, action: '로그인 버튼 클릭', expected: '대시보드 진입' },
    ],
    expectedResult: '대시보드로 이동한다',
    priority: 'HIGH',
    ...overrides,
  });

  describe('RBAC: QA_LEAD 미만 쓰기 403', () => {
    it.each([
      ['VIEWER', () => viewer],
      ['TESTER', () => tester],
    ] as const)('%s가 케이스를 생성하면 403', async (_label, getUser) => {
      const res = await authed(getUser())
        .post(casesUrl())
        .send(validCasePayload());
      expect(res.status).toBe(403);
      expect(typedBody<ErrorBody>(res).code).toBe('ORG_FORBIDDEN');
    });
  });

  describe('생성/상세/목록', () => {
    let caseId: string;

    it('QA_LEAD는 케이스를 생성할 수 있다', async () => {
      const res = await authed(qaLead)
        .post(casesUrl())
        .send(validCasePayload());
      expect(res.status).toBe(201);
      caseId = typedBody<CaseResponse>(res).id;
    });

    it('목록 응답에는 steps가 없다', async () => {
      const res = await authed(viewer).get(casesUrl());
      expect(res.status).toBe(200);
      const { items } = typedBody<CaseListResponse>(res);
      const found = items.find((c) => c.id === caseId);
      expect(found).toBeDefined();
      expect(found).not.toHaveProperty('steps');
    });

    it('상세 응답에는 steps가 포함된다', async () => {
      const res = await authed(viewer).get(casesUrl(`/${caseId}`));
      expect(res.status).toBe(200);
      expect(typedBody<CaseResponse>(res).steps).toEqual(
        validCasePayload().steps,
      );
    });

    it('suiteId 필터로 목록을 좁힐 수 있다', async () => {
      const otherSuite = await ctx.prisma.testSuite.create({
        data: {
          organizationId: org.id,
          name: '다른 스위트',
          createdById: admin.userId,
        },
      });
      const res = await authed(viewer).get(
        casesUrl(`?suiteId=${otherSuite.id}`),
      );
      expect(res.status).toBe(200);
      expect(typedBody<CaseListResponse>(res).items).toHaveLength(0);
    });

    it('존재하지 않는 케이스 상세는 404', async () => {
      const res = await authed(viewer).get(
        casesUrl('/00000000-0000-0000-0000-000000000000'),
      );
      expect(res.status).toBe(404);
    });
  });

  describe('수정 시 감사로그는 변경된 필드만 담는다', () => {
    it('title만 바꾸면 metadata에 title 키만 남는다', async () => {
      const created = await authed(qaLead)
        .post(casesUrl())
        .send(validCasePayload({ title: '원래 제목' }));
      const caseId = typedBody<CaseResponse>(created).id;

      const updated = await authed(qaLead)
        .patch(casesUrl(`/${caseId}`))
        .send({ title: '바뀐 제목' });
      expect(updated.status).toBe(200);

      const auditRes = await authed(admin).get(
        `/api/orgs/${org.id}/audit-logs?action=CASE_UPDATED&targetId=${caseId}`,
      );
      const logs = typedBody<AuditLogListResponse>(auditRes).items;
      expect(logs).toHaveLength(1);
      expect(Object.keys(logs[0].metadata ?? {})).toEqual(['title']);
      expect(logs[0].metadata).toEqual({ title: ['원래 제목', '바뀐 제목'] });
    });

    it('priority와 steps를 함께 바꾸면 두 필드만 metadata에 남는다', async () => {
      const created = await authed(qaLead)
        .post(casesUrl())
        .send(validCasePayload({ title: '복수 필드 변경 케이스' }));
      const caseId = typedBody<CaseResponse>(created).id;

      const newSteps = [{ order: 1, action: '새 스텝' }];
      const updated = await authed(qaLead)
        .patch(casesUrl(`/${caseId}`))
        .send({ priority: 'CRITICAL', steps: newSteps });
      expect(updated.status).toBe(200);

      const auditRes = await authed(admin).get(
        `/api/orgs/${org.id}/audit-logs?action=CASE_UPDATED&targetId=${caseId}`,
      );
      const logs = typedBody<AuditLogListResponse>(auditRes).items;
      expect(logs).toHaveLength(1);
      expect(Object.keys(logs[0].metadata ?? {}).sort()).toEqual([
        'priority',
        'steps',
      ]);
    });

    it('바꾼다고 보낸 값이 기존과 동일하면 metadata는 빈 객체다(로그 자체는 남는다 — PATCH 행위 자체의 기록)', async () => {
      const payload = validCasePayload({ title: '동일 값 재전송 케이스' });
      const created = await authed(qaLead).post(casesUrl()).send(payload);
      const caseId = typedBody<CaseResponse>(created).id;

      const updated = await authed(qaLead)
        .patch(casesUrl(`/${caseId}`))
        .send({ title: payload.title }); // 같은 값 재전송
      expect(updated.status).toBe(200);

      const auditRes = await authed(admin).get(
        `/api/orgs/${org.id}/audit-logs?action=CASE_UPDATED&targetId=${caseId}`,
      );
      const logs = typedBody<AuditLogListResponse>(auditRes).items;
      expect(logs).toHaveLength(1);
      expect(logs[0].metadata).toEqual({});
    });
  });

  describe('삭제', () => {
    it('QA_LEAD가 삭제하면 204이고 이후 상세는 404', async () => {
      const created = await authed(qaLead)
        .post(casesUrl())
        .send(validCasePayload({ title: '삭제될 케이스' }));
      const caseId = typedBody<CaseResponse>(created).id;

      const del = await authed(qaLead).delete(casesUrl(`/${caseId}`));
      expect(del.status).toBe(204);

      const res = await authed(viewer).get(casesUrl(`/${caseId}`));
      expect(res.status).toBe(404);
    });
  });

  describe('크로스 테넌트 차단', () => {
    it('다른 조직의 suiteId로 케이스를 생성하면 404', async () => {
      const otherOrg = await seedOrganization(ctx.prisma, 'Cases Org B');
      const otherSuite = await ctx.prisma.testSuite.create({
        data: {
          organizationId: otherOrg.id,
          name: '남의 스위트',
          createdById: admin.userId,
        },
      });

      const res = await authed(qaLead)
        .post(casesUrl())
        .send(validCasePayload({ suiteId: otherSuite.id }));
      expect(res.status).toBe(404);
    });

    it('다른 조직 경로 + 이 조직 caseId로 접근하면 404', async () => {
      const created = await authed(qaLead)
        .post(casesUrl())
        .send(validCasePayload({ title: '남의 조직에서 접근 시도용' }));
      const caseId = typedBody<CaseResponse>(created).id;

      const otherOrg = await seedOrganization(ctx.prisma, 'Cases Org C');
      const otherAdmin = await registerAndLogin(
        ctx.app,
        'cases-other-admin@example.com',
      );
      await addMember(ctx.prisma, otherOrg.id, otherAdmin.userId, Role.ADMIN);

      const res = await authed(otherAdmin).get(
        `/api/orgs/${otherOrg.id}/cases/${caseId}`,
      );
      expect(res.status).toBe(404);
    });
  });
});
