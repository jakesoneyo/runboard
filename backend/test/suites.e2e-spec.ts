// PLAN.md C3 — 스위트 트리 CRUD. 깊이/순환 규칙(suite-tree-rules.spec.ts)은 이미 단위테스트로
// 검증했으니 여기서는 HTTP 계층 + RBAC + cascade + N+1 부재를 실제 DB로 증명한다.
import { Role } from '@prisma/client';
import { runWithRequestContext } from '../src/common/context/request-context';
import { SuitesService } from '../src/suites/suites.service';
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

interface ErrorBody {
  code: string;
}
interface SuiteResponse {
  id: string;
  parentId: string | null;
}
interface SuiteTreeNode {
  id: string;
  name: string;
  position: number;
  caseCount: number;
  children: SuiteTreeNode[];
}

describe('스위트 트리 (e2e)', () => {
  jest.setTimeout(120_000);

  let ctx: TestApp;
  let org: { id: string };
  let admin: AuthedUser;
  let qaLead: AuthedUser;
  let tester: AuthedUser;
  let viewer: AuthedUser;

  beforeAll(async () => {
    ctx = await bootstrapTestApp();
    org = await seedOrganization(ctx.prisma, 'Suites Org');
    admin = await registerAndLogin(ctx.app, 'suites-admin@example.com');
    qaLead = await registerAndLogin(ctx.app, 'suites-qalead@example.com');
    tester = await registerAndLogin(ctx.app, 'suites-tester@example.com');
    viewer = await registerAndLogin(ctx.app, 'suites-viewer@example.com');
    await addMember(ctx.prisma, org.id, admin.userId, Role.ADMIN);
    await addMember(ctx.prisma, org.id, qaLead.userId, Role.QA_LEAD);
    await addMember(ctx.prisma, org.id, tester.userId, Role.TESTER);
    await addMember(ctx.prisma, org.id, viewer.userId, Role.VIEWER);
  });

  afterAll(() => teardownTestApp(ctx));

  const authed = (user: AuthedUser) => authedAgent(ctx.app, user.accessToken);
  const suitesUrl = (suffix = '') => `/api/orgs/${org.id}/suites${suffix}`;

  describe('RBAC: QA_LEAD 미만 쓰기 403', () => {
    it.each([
      ['VIEWER', () => viewer],
      ['TESTER', () => tester],
    ] as const)('%s가 스위트를 생성하면 403', async (_label, getUser) => {
      const res = await authed(getUser())
        .post(suitesUrl())
        .send({ name: '권한 없는 생성 시도' });
      expect(res.status).toBe(403);
      expect(typedBody<ErrorBody>(res).code).toBe('ORG_FORBIDDEN');
    });

    it('QA_LEAD는 스위트를 생성할 수 있다(201)', async () => {
      const res = await authed(qaLead)
        .post(suitesUrl())
        .send({ name: 'QA_LEAD 생성' });
      expect(res.status).toBe(201);
    });
  });

  describe('트리 깊이 제한(최대 3단계)', () => {
    it('4단계째 스위트 생성은 400', async () => {
      const root = await authed(qaLead)
        .post(suitesUrl())
        .send({ name: 'Depth Root' });
      const child = await authed(qaLead)
        .post(suitesUrl())
        .send({
          name: 'Depth Child',
          parentId: typedBody<SuiteResponse>(root).id,
        });
      const grandchild = await authed(qaLead)
        .post(suitesUrl())
        .send({
          name: 'Depth Grandchild',
          parentId: typedBody<SuiteResponse>(child).id,
        });
      expect(grandchild.status).toBe(201); // 3단계까지는 허용

      const tooDeep = await authed(qaLead)
        .post(suitesUrl())
        .send({
          name: 'Depth Level4',
          parentId: typedBody<SuiteResponse>(grandchild).id,
        });
      expect(tooDeep.status).toBe(400);
    });
  });

  describe('순환 참조 거부', () => {
    it('부모를 자기 하위 스위트로 지정하면 400', async () => {
      const parent = await authed(qaLead)
        .post(suitesUrl())
        .send({ name: 'Cycle Parent' });
      const parentId = typedBody<SuiteResponse>(parent).id;
      const child = await authed(qaLead)
        .post(suitesUrl())
        .send({ name: 'Cycle Child', parentId });
      const childId = typedBody<SuiteResponse>(child).id;

      const res = await authed(qaLead)
        .patch(suitesUrl(`/${parentId}`))
        .send({ parentId: childId });
      expect(res.status).toBe(400);
    });

    it('자기 자신을 부모로 지정하면 400', async () => {
      const suite = await authed(qaLead)
        .post(suitesUrl())
        .send({ name: 'Self Parent' });
      const suiteId = typedBody<SuiteResponse>(suite).id;

      const res = await authed(qaLead)
        .patch(suitesUrl(`/${suiteId}`))
        .send({ parentId: suiteId });
      expect(res.status).toBe(400);
    });
  });

  describe('스위트 삭제 시 하위 cascade', () => {
    it('부모 삭제 시 자식 스위트와 그 안의 케이스도 함께 사라진다(RunCase 스냅샷 보존은 C4 범위)', async () => {
      const parent = await authed(qaLead)
        .post(suitesUrl())
        .send({ name: 'Cascade Parent' });
      const parentId = typedBody<SuiteResponse>(parent).id;
      const child = await authed(qaLead)
        .post(suitesUrl())
        .send({ name: 'Cascade Child', parentId });
      const childId = typedBody<SuiteResponse>(child).id;

      const createdCase = await authed(qaLead)
        .post(`/api/orgs/${org.id}/cases`)
        .send({
          suiteId: childId,
          title: 'Cascade Case',
          steps: [{ order: 1, action: '클릭' }],
          expectedResult: '통과',
          priority: 'MEDIUM',
        });
      expect(createdCase.status).toBe(201);
      const caseId = typedBody<{ id: string }>(createdCase).id;

      const del = await authed(qaLead).delete(suitesUrl(`/${parentId}`));
      expect(del.status).toBe(204);

      const childGone = await ctx.prisma.testSuite.findUnique({
        where: { id: childId },
      });
      expect(childGone).toBeNull();
      const caseGone = await ctx.prisma.testCase.findUnique({
        where: { id: caseId },
      });
      expect(caseGone).toBeNull();
    });
  });

  describe('트리 조립', () => {
    it('GET ?tree=true는 중첩 트리를 반환하고 position 순으로 정렬한다', async () => {
      const treeOrg = await seedOrganization(ctx.prisma, 'Tree Assembly Org');
      const owner = await registerAndLogin(ctx.app, 'tree-owner@example.com');
      await addMember(ctx.prisma, treeOrg.id, owner.userId, Role.ADMIN);
      const base = `/api/orgs/${treeOrg.id}/suites`;
      const asOwner = authedAgent(ctx.app, owner.accessToken);

      const second = await asOwner.post(base).send({ name: 'B', position: 1 });
      const first = await asOwner.post(base).send({ name: 'A', position: 0 });
      const child = await asOwner.post(base).send({
        name: 'A-1',
        parentId: typedBody<SuiteResponse>(first).id,
      });
      await asOwner.post(`/api/orgs/${treeOrg.id}/cases`).send({
        suiteId: typedBody<SuiteResponse>(child).id,
        title: 'Case in A-1',
        steps: [{ order: 1, action: '확인' }],
        expectedResult: 'OK',
      });

      const res = await asOwner.get(`${base}?tree=true`);
      expect(res.status).toBe(200);
      const tree = typedBody<SuiteTreeNode[]>(res);
      expect(tree.map((n) => n.name)).toEqual(['A', 'B']); // position 0, 1 순
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].name).toBe('A-1');
      expect(tree[0].children[0].caseCount).toBe(1);
      void second;
    });
  });

  describe('N+1 없음: 스위트 개수와 무관하게 쿼리 수가 일정하다', () => {
    it('스위트 2개일 때와 6개일 때 목록 조회 쿼리 수가 같다', async () => {
      const counter = attachQueryCounter(ctx.prisma);
      const suitesService = ctx.moduleRef.get(SuitesService);

      const smallOrg = await seedOrganization(ctx.prisma, 'N+1 Small');
      await ctx.prisma.testSuite.createMany({
        data: Array.from({ length: 2 }, (_, i) => ({
          organizationId: smallOrg.id,
          name: `Small ${i}`,
          createdById: admin.userId,
        })),
      });

      const bigOrg = await seedOrganization(ctx.prisma, 'N+1 Big');
      await ctx.prisma.testSuite.createMany({
        data: Array.from({ length: 6 }, (_, i) => ({
          organizationId: bigOrg.id,
          name: `Big ${i}`,
          createdById: admin.userId,
        })),
      });

      counter.reset();
      await runWithRequestContext(
        { organizationId: smallOrg.id, role: Role.ADMIN },
        () => suitesService.list(true),
      );
      const smallCount = counter.count;

      counter.reset();
      await runWithRequestContext(
        { organizationId: bigOrg.id, role: Role.ADMIN },
        () => suitesService.list(true),
      );
      const bigCount = counter.count;

      expect(smallCount).toBeGreaterThan(0);
      expect(bigCount).toBe(smallCount); // 스위트 수가 3배로 늘어도 쿼리 수는 그대로 — N+1 없음
    });
  });
});
