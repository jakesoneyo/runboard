// PLAN.md 그룹 1(T-1~T-7) — 테넌트 격리. HTTP 계층에서 실제로 존재하는 리소스(members/invitations/
// audit-logs)로 검증한다. suites/cases/runs/bugs HTTP 엔드포인트는 C3~C5에서 추가되므로, 그 모델들에 대한
// tenant.extension.ts 자체의 격리 메커니즘 증명은 tenant-extension.e2e-spec.ts에서 직접 다룬다.
import { Role } from '@prisma/client';
import request from 'supertest';
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
interface InvitationResponse {
  id: string;
}

describe('테넌트 격리 (e2e)', () => {
  jest.setTimeout(120_000);

  let ctx: TestApp;
  let orgA: { id: string };
  let orgB: { id: string };
  let adminA: AuthedUser;
  let adminB: AuthedUser;

  beforeAll(async () => {
    ctx = await bootstrapTestApp();
    orgA = await seedOrganization(ctx.prisma, 'Org A');
    orgB = await seedOrganization(ctx.prisma, 'Org B');
    adminA = await registerAndLogin(ctx.app, 'admin-a@example.com');
    adminB = await registerAndLogin(ctx.app, 'admin-b@example.com');
    await addMember(ctx.prisma, orgA.id, adminA.userId, Role.ADMIN);
    await addMember(ctx.prisma, orgB.id, adminB.userId, Role.ADMIN);
  });

  afterAll(() => teardownTestApp(ctx));

  const api = () => request(ctx.app.getHttpServer());
  const asA = () => authedAgent(ctx.app, adminA.accessToken);

  describe('T-1: 남의 orgId로 목록 조회는 전부 404', () => {
    it('members', async () => {
      const res = await asA().get(`/api/orgs/${orgB.id}/members`);
      expect(res.status).toBe(404);
      expect(typedBody<ErrorBody>(res).code).toBe('NOT_FOUND');
    });

    it('invitations', async () => {
      const res = await asA().get(`/api/orgs/${orgB.id}/invitations`);
      expect(res.status).toBe(404);
    });

    it('audit-logs', async () => {
      const res = await asA().get(`/api/orgs/${orgB.id}/audit-logs`);
      expect(res.status).toBe(404);
    });

    it('suites', async () => {
      const res = await asA().get(`/api/orgs/${orgB.id}/suites`);
      expect(res.status).toBe(404);
    });

    it('cases', async () => {
      const res = await asA().get(`/api/orgs/${orgB.id}/cases`);
      expect(res.status).toBe(404);
    });

    it('runs', async () => {
      const res = await asA().get(`/api/orgs/${orgB.id}/runs`);
      expect(res.status).toBe(404);
    });

    // bugs 목록 GET은 C5에서 라우트가 생기면 이 describe 블록에 추가한다.
  });

  describe('T-2: 내 조직 경로 + 남의 조직 리소스 id는 전부 404이고 변경도 없다', () => {
    it('org A 경로로 org B 멤버(adminB의 userId)를 역할 변경하면 404, B의 role은 그대로다', async () => {
      const res = await asA()
        .patch(`/api/orgs/${orgA.id}/members/${adminB.userId}`)
        .send({ role: Role.VIEWER });
      expect(res.status).toBe(404);

      const stillAdmin = await ctx.prisma.membership.findFirst({
        where: { userId: adminB.userId, organizationId: orgB.id },
      });
      expect(stillAdmin?.role).toBe(Role.ADMIN);
    });

    it('org A 경로로 org B의 초대 id를 폐기 시도하면 404, B의 초대는 그대로 PENDING', async () => {
      const created = await api()
        .post(`/api/orgs/${orgB.id}/invitations`)
        .set('Authorization', `Bearer ${adminB.accessToken}`)
        .send({ email: 'invitee@example.com', role: Role.TESTER });
      expect(created.status).toBe(201);
      const invitationId = typedBody<InvitationResponse>(created).id;

      const res = await asA().delete(
        `/api/orgs/${orgA.id}/invitations/${invitationId}`,
      );
      expect(res.status).toBe(404);

      const stillPending = await ctx.prisma.invitation.findUnique({
        where: { id: invitationId },
      });
      expect(stillPending?.status).toBe('PENDING');
    });

    it('org A 경로로 org B의 케이스 id를 수정 시도하면 404, B의 케이스는 그대로다', async () => {
      const suiteB = await ctx.prisma.testSuite.create({
        data: {
          organizationId: orgB.id,
          name: 'B 스위트',
          createdById: adminB.userId,
        },
      });
      const caseB = await ctx.prisma.testCase.create({
        data: {
          organizationId: orgB.id,
          suiteId: suiteB.id,
          title: 'B 케이스',
          steps: [{ order: 1, action: '확인' }],
          expectedResult: 'OK',
          createdById: adminB.userId,
        },
      });

      const res = await asA()
        .patch(`/api/orgs/${orgA.id}/cases/${caseB.id}`)
        .send({ title: '탈취 시도' });
      expect(res.status).toBe(404);

      const stillOriginal = await ctx.prisma.testCase.findUnique({
        where: { id: caseB.id },
      });
      expect(stillOriginal?.title).toBe('B 케이스');
    });
  });

  describe('T-3: 목록 응답에 다른 조직 레코드가 단 1건도 섞이지 않는다', () => {
    it('members 목록', async () => {
      const res = await asA().get(`/api/orgs/${orgA.id}/members`);
      expect(res.status).toBe(200);
      const emails = typedBody<{ email: string }[]>(res).map((m) => m.email);
      expect(emails).toContain(adminA.email);
      expect(emails).not.toContain(adminB.email);
    });

    it('invitations 목록', async () => {
      await api()
        .post(`/api/orgs/${orgA.id}/invitations`)
        .set('Authorization', `Bearer ${adminA.accessToken}`)
        .send({ email: 'a-invitee@example.com', role: Role.VIEWER });

      const res = await asA().get(`/api/orgs/${orgA.id}/invitations`);
      expect(res.status).toBe(200);
      const emails = typedBody<{ email: string }[]>(res).map((i) => i.email);
      expect(emails).toContain('a-invitee@example.com');
      expect(emails).not.toContain('invitee@example.com'); // org B에서 만든 초대
    });

    it('suites 목록', async () => {
      await api()
        .post(`/api/orgs/${orgA.id}/suites`)
        .set('Authorization', `Bearer ${adminA.accessToken}`)
        .send({ name: 'A 스위트' });
      await ctx.prisma.testSuite.create({
        data: {
          organizationId: orgB.id,
          name: 'B 스위트 목록용',
          createdById: adminB.userId,
        },
      });

      const res = await asA().get(`/api/orgs/${orgA.id}/suites?tree=false`);
      expect(res.status).toBe(200);
      const names = typedBody<{ name: string }[]>(res).map((s) => s.name);
      expect(names).toContain('A 스위트');
      expect(names).not.toContain('B 스위트 목록용');
    });

    it('cases 목록', async () => {
      const suiteA = await ctx.prisma.testSuite.create({
        data: {
          organizationId: orgA.id,
          name: 'A 케이스용 스위트',
          createdById: adminA.userId,
        },
      });
      const suiteB = await ctx.prisma.testSuite.create({
        data: {
          organizationId: orgB.id,
          name: 'B 케이스용 스위트',
          createdById: adminB.userId,
        },
      });
      await ctx.prisma.testCase.create({
        data: {
          organizationId: orgA.id,
          suiteId: suiteA.id,
          title: 'A 케이스',
          steps: [{ order: 1, action: '확인' }],
          expectedResult: 'OK',
          createdById: adminA.userId,
        },
      });
      await ctx.prisma.testCase.create({
        data: {
          organizationId: orgB.id,
          suiteId: suiteB.id,
          title: 'B 케이스',
          steps: [{ order: 1, action: '확인' }],
          expectedResult: 'OK',
          createdById: adminB.userId,
        },
      });

      const res = await asA().get(`/api/orgs/${orgA.id}/cases`);
      expect(res.status).toBe(200);
      const titles = typedBody<{ items: { title: string }[] }>(res).items.map(
        (c) => c.title,
      );
      expect(titles).toContain('A 케이스');
      expect(titles).not.toContain('B 케이스');
    });
  });

  // T-7(소켓 룸 격리)은 runs-realtime.e2e-spec.ts에서 RunsGateway로 직접 검증한다.
});
