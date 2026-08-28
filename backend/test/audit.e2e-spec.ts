// PLAN.md 그룹 4(T-22/T-23) — 감사로그 조회. T-20(케이스 diff)/T-21(트랜잭션 롤백)/T-24~T-26(인증)은
// cases.e2e-spec.ts·runs-realtime.e2e-spec.ts·auth.e2e-spec.ts에서 이미 커버된 회귀 대상이다.
import { Role } from '@prisma/client';
import {
  addMember,
  authedAgent,
  registerAndLogin,
  typedBody,
  type AuthedUser,
} from './support/fixtures';
import {
  bootstrapTestApp,
  teardownTestApp,
  type TestApp,
} from './support/test-app';

interface CaseResponse {
  id: string;
}
interface AuditLogItem {
  id: string;
  action: string;
  actor: { id: string; email: string } | null;
  createdAt: string;
}
interface AuditLogListResponse {
  items: AuditLogItem[];
  nextCursor: string | null;
}

describe('감사로그 조회 (e2e)', () => {
  jest.setTimeout(120_000);

  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await bootstrapTestApp();
  });

  afterAll(() => teardownTestApp(ctx));

  const authed = (user: AuthedUser) => authedAgent(ctx.app, user.accessToken);

  describe('T-22: 멤버 제거 후에도 actorEmail 스냅샷으로 행위자를 식별할 수 있다', () => {
    it('제거된 멤버가 남긴 감사로그는 actorEmail을 그대로 보존한다', async () => {
      const owner = await registerAndLogin(ctx.app, 't22-owner@example.com');
      const created = await authed(owner)
        .post('/api/orgs')
        .send({ name: 'T22 조직' });
      const orgId = typedBody<{ id: string }>(created).id;

      const leadEmail = 't22-lead@example.com';
      const lead = await registerAndLogin(ctx.app, leadEmail);
      await addMember(ctx.prisma, orgId, lead.userId, Role.QA_LEAD);

      const suite = await ctx.prisma.testSuite.create({
        data: {
          organizationId: orgId,
          name: 'T22 스위트',
          createdById: owner.userId,
        },
      });
      const caseRes = await authed(lead)
        .post(`/api/orgs/${orgId}/cases`)
        .send({
          suiteId: suite.id,
          title: 'T22 케이스',
          steps: [{ order: 1, action: '확인' }],
          expectedResult: '통과',
        });
      const caseId = typedBody<CaseResponse>(caseRes).id;

      const removed = await authed(owner).delete(
        `/api/orgs/${orgId}/members/${lead.userId}`,
      );
      expect(removed.status).toBe(204);

      const remainingMembership = await ctx.prisma.membership.findFirst({
        where: { organizationId: orgId, userId: lead.userId },
      });
      expect(remainingMembership).toBeNull(); // 정말로 제거됐는지 먼저 확인

      const logs = await authed(owner).get(
        `/api/orgs/${orgId}/audit-logs?action=CASE_CREATED&targetId=${caseId}`,
      );
      expect(logs.status).toBe(200);
      const items = typedBody<AuditLogListResponse>(logs).items;
      expect(items).toHaveLength(1);
      expect(items[0].actor?.email).toBe(leadEmail);
    });
  });

  describe('T-23: 필터 + 커서 페이지네이션', () => {
    let orgId: string;
    let owner: AuthedUser;
    const totalCases = 5;

    beforeAll(async () => {
      owner = await registerAndLogin(ctx.app, 't23-owner@example.com');
      const created = await authed(owner)
        .post('/api/orgs')
        .send({ name: 'T23 조직' });
      orgId = typedBody<{ id: string }>(created).id;

      const suite = await ctx.prisma.testSuite.create({
        data: {
          organizationId: orgId,
          name: 'T23 스위트',
          createdById: owner.userId,
        },
      });
      for (let i = 0; i < totalCases; i += 1) {
        await authed(owner)
          .post(`/api/orgs/${orgId}/cases`)
          .send({
            suiteId: suite.id,
            title: `T23 케이스 ${i}`,
            steps: [{ order: 1, action: '확인' }],
            expectedResult: '통과',
          });
      }
    });

    it('action 필터로 CASE_CREATED만 좁혀서 조회한다', async () => {
      const res = await authed(owner).get(
        `/api/orgs/${orgId}/audit-logs?action=CASE_CREATED`,
      );
      expect(res.status).toBe(200);
      const items = typedBody<AuditLogListResponse>(res).items;
      expect(items).toHaveLength(totalCases);
      expect(items.every((i) => i.action === 'CASE_CREATED')).toBe(true);
    });

    it('actorId + 기간(from/to) 필터를 함께 적용해도 정확한 결과를 돌려준다', async () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      const future = new Date(Date.now() + 60_000).toISOString();
      const res = await authed(owner).get(
        `/api/orgs/${orgId}/audit-logs?actorId=${owner.userId}&from=${past}&to=${future}`,
      );
      expect(res.status).toBe(200);
      const items = typedBody<AuditLogListResponse>(res).items;
      expect(items.length).toBeGreaterThanOrEqual(totalCases);
      expect(items.every((i) => i.actor?.id === owner.userId)).toBe(true);

      const outOfRange = await authed(owner).get(
        `/api/orgs/${orgId}/audit-logs?from=${future}`,
      );
      expect(typedBody<AuditLogListResponse>(outOfRange).items).toHaveLength(0);
    });

    it('take=2로 커서 페이지네이션하면 중복·누락 없이 CASE_CREATED 전건을 순회한다', async () => {
      const seen = new Set<string>();
      let cursor: string | null = null;
      let guard = 0;
      do {
        const res = await authed(owner).get(
          `/api/orgs/${orgId}/audit-logs?action=CASE_CREATED&take=2` +
            (cursor ? `&cursor=${cursor}` : ''),
        );
        expect(res.status).toBe(200);
        const page = typedBody<AuditLogListResponse>(res);
        expect(page.items.length).toBeLessThanOrEqual(2);
        for (const item of page.items) {
          expect(seen.has(item.id)).toBe(false); // 중복 없음
          seen.add(item.id);
        }
        cursor = page.nextCursor;
        guard += 1;
      } while (cursor && guard < 10);

      expect(seen.size).toBe(totalCases); // 누락 없음
    });
  });
});
