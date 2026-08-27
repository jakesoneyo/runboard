// PLAN.md 그룹 2(T-8~T-13) — RBAC 권한 경계. C2에 실제로 존재하는 엔드포인트(orgs/members/invitations/
// audit-logs)로 검증한다. runs 관련(T-9, T-10)은 RunAssignmentGuard가 도입되는 C4에서 함께 구현한다.
import { Role } from '@prisma/client';
import {
  addMember,
  authedAgent,
  registerAndLogin,
  typedBody,
  type AuthedUser,
  seedOrganization,
} from './support/fixtures';
import {
  bootstrapTestApp,
  teardownTestApp,
  type TestApp,
} from './support/test-app';

interface ErrorBody {
  code: string;
}
interface OrgResponse {
  id: string;
}
interface AuditLogListResponse {
  items: unknown[];
}

describe('RBAC (e2e)', () => {
  jest.setTimeout(120_000);

  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await bootstrapTestApp();
  });

  afterAll(() => teardownTestApp(ctx));

  const authed = (user: AuthedUser) => authedAgent(ctx.app, user.accessToken);

  describe('T-8: Role × 주요 엔드포인트 매트릭스', () => {
    let org: { id: string };
    let admin: AuthedUser;
    let qaLead: AuthedUser;
    let tester: AuthedUser;
    let viewer: AuthedUser;

    beforeAll(async () => {
      org = await seedOrganization(ctx.prisma, 'Matrix Org');
      admin = await registerAndLogin(ctx.app, 'matrix-admin@example.com');
      qaLead = await registerAndLogin(ctx.app, 'matrix-qalead@example.com');
      tester = await registerAndLogin(ctx.app, 'matrix-tester@example.com');
      viewer = await registerAndLogin(ctx.app, 'matrix-viewer@example.com');
      await addMember(ctx.prisma, org.id, admin.userId, Role.ADMIN);
      await addMember(ctx.prisma, org.id, qaLead.userId, Role.QA_LEAD);
      await addMember(ctx.prisma, org.id, tester.userId, Role.TESTER);
      await addMember(ctx.prisma, org.id, viewer.userId, Role.VIEWER);
    });

    it.each([
      [
        'PATCH /orgs/:orgId',
        () => authed(viewer).patch(`/api/orgs/${org.id}`).send({ name: 'x' }),
      ],
      [
        'POST /orgs/:orgId/invitations',
        () =>
          authed(qaLead)
            .post(`/api/orgs/${org.id}/invitations`)
            .send({ email: 'x@example.com', role: Role.VIEWER }),
      ],
      [
        'GET /orgs/:orgId/invitations',
        () => authed(tester).get(`/api/orgs/${org.id}/invitations`),
      ],
      [
        'GET /orgs/:orgId/audit-logs',
        () => authed(viewer).get(`/api/orgs/${org.id}/audit-logs`),
      ],
    ] as const)('ADMIN 미만은 %s에서 403', async (_label, run) => {
      const res = await run();
      expect(res.status).toBe(403);
      expect(typedBody<ErrorBody>(res).code).toBe('ORG_FORBIDDEN');
    });

    it('ADMIN은 PATCH /orgs/:orgId 가 200', async () => {
      const res = await authed(admin)
        .patch(`/api/orgs/${org.id}`)
        .send({ name: 'Matrix Org Renamed' });
      expect(res.status).toBe(200);
    });

    it('ADMIN은 GET /orgs/:orgId/audit-logs 가 200 (T-13 대조군)', async () => {
      const res = await authed(admin).get(`/api/orgs/${org.id}/audit-logs`);
      expect(res.status).toBe(200);
      expect(typedBody<AuditLogListResponse>(res).items).toEqual(
        expect.any(Array),
      );
    });

    it('조직 멤버라면 누구나(VIEWER 포함) GET /orgs/:orgId/members 는 200', async () => {
      const res = await authed(viewer).get(`/api/orgs/${org.id}/members`);
      expect(res.status).toBe(200);
    });
  });

  // T-9/T-10(RUN_NOT_ASSIGNED, 배정 여부에 따른 기록 권한)은 실행(TestRun) 도메인이 생기는 C4에서 구현한다.
  it.todo('T-9: 미배정 TESTER의 결과 기록 403 RUN_NOT_ASSIGNED — C4에서 구현');
  it.todo('T-10: 배정된 TESTER/QA_LEAD의 결과 기록 200 — C4에서 구현');

  describe('T-11: 마지막 ADMIN 강등/제거 방지', () => {
    it('유일한 ADMIN을 강등하려 하면 409 MEMBER_LAST_ADMIN', async () => {
      const owner = await registerAndLogin(ctx.app, 'last-admin-1@example.com');
      const created = await authed(owner)
        .post('/api/orgs')
        .send({ name: '단독 조직' });
      expect(created.status).toBe(201);
      const orgId = typedBody<OrgResponse>(created).id;

      const res = await authed(owner)
        .patch(`/api/orgs/${orgId}/members/${owner.userId}`)
        .send({ role: Role.VIEWER });
      expect(res.status).toBe(409);
      expect(typedBody<ErrorBody>(res).code).toBe('MEMBER_LAST_ADMIN');
    });

    it('유일한 ADMIN을 제거하려 하면 409 MEMBER_LAST_ADMIN', async () => {
      const owner = await registerAndLogin(ctx.app, 'last-admin-2@example.com');
      const created = await authed(owner)
        .post('/api/orgs')
        .send({ name: '단독 조직 2' });
      const orgId = typedBody<OrgResponse>(created).id;

      const res = await authed(owner).delete(
        `/api/orgs/${orgId}/members/${owner.userId}`,
      );
      expect(res.status).toBe(409);
      expect(typedBody<ErrorBody>(res).code).toBe('MEMBER_LAST_ADMIN');
    });

    it('ADMIN이 2명이면 그중 1명을 강등해도 200(마지막이 아니므로)', async () => {
      const owner = await registerAndLogin(
        ctx.app,
        'two-admins-owner@example.com',
      );
      const created = await authed(owner)
        .post('/api/orgs')
        .send({ name: '복수 관리자 조직' });
      const orgId = typedBody<OrgResponse>(created).id;
      const secondAdmin = await registerAndLogin(
        ctx.app,
        'two-admins-second@example.com',
      );
      await addMember(ctx.prisma, orgId, secondAdmin.userId, Role.ADMIN);

      const res = await authed(owner)
        .patch(`/api/orgs/${orgId}/members/${secondAdmin.userId}`)
        .send({ role: Role.VIEWER });
      expect(res.status).toBe(200);
    });
  });

  describe('T-12: 역할 강등이 기존 access token에 즉시 반영된다', () => {
    it('ADMIN→VIEWER 강등 직후 같은 토큰으로 ADMIN 전용 작업을 시도하면 즉시 403', async () => {
      const owner = await registerAndLogin(ctx.app, 't12-owner@example.com');
      const created = await authed(owner)
        .post('/api/orgs')
        .send({ name: 'T12 조직' });
      const orgId = typedBody<OrgResponse>(created).id;

      const second = await registerAndLogin(ctx.app, 't12-second@example.com');
      await addMember(ctx.prisma, orgId, second.userId, Role.ADMIN);

      // 강등 전: ADMIN 권한으로 조직 정보 수정이 가능하다(같은 토큰을 이후에도 계속 재사용한다).
      const before = await authed(second)
        .patch(`/api/orgs/${orgId}`)
        .send({ name: '강등 전' });
      expect(before.status).toBe(200);

      // owner가 second를 VIEWER로 강등 — access token은 재발급되지 않는다(애초에 role을 담지 않으므로).
      const demote = await authed(owner)
        .patch(`/api/orgs/${orgId}/members/${second.userId}`)
        .send({ role: Role.VIEWER });
      expect(demote.status).toBe(200);

      // 강등 직후, 재로그인 없이 같은 access token으로 동일 작업을 시도하면 즉시 403이어야 한다.
      const after = await authed(second)
        .patch(`/api/orgs/${orgId}`)
        .send({ name: '강등 후' });
      expect(after.status).toBe(403);
      expect(typedBody<ErrorBody>(after).code).toBe('ORG_FORBIDDEN');
    });
  });

  describe('T-13: VIEWER의 감사로그 조회는 403', () => {
    it('VIEWER → GET /orgs/:orgId/audit-logs 는 403', async () => {
      const owner = await registerAndLogin(ctx.app, 't13-owner@example.com');
      const created = await authed(owner)
        .post('/api/orgs')
        .send({ name: 'T13 조직' });
      const orgId = typedBody<OrgResponse>(created).id;

      const viewer = await registerAndLogin(ctx.app, 't13-viewer@example.com');
      await addMember(ctx.prisma, orgId, viewer.userId, Role.VIEWER);

      const res = await authed(viewer).get(`/api/orgs/${orgId}/audit-logs`);
      expect(res.status).toBe(403);
      expect(typedBody<ErrorBody>(res).code).toBe('ORG_FORBIDDEN');
    });
  });
});
