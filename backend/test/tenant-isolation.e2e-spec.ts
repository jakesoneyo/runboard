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

    // suites/cases/runs/bugs 목록 GET은 C3~C5에서 라우트가 생기면 이 describe 블록에 추가한다.
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
  });

  // T-7(소켓 룸 격리)은 RunsGateway가 도입되는 C4에서 함께 구현·검증한다(PLAN.md 청크 경계).
  it.todo(
    'T-7: 조직 B 멤버가 조직 A run:join 시도 시 거부 — C4(RunsGateway)에서 구현',
  );
});
