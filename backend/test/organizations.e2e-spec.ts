// API.md 3장 — 조직/멤버/초대 API의 정상 동작(happy path) + 감사로그 연결을 검증한다.
// 테넌트 격리/RBAC 경계는 tenant-isolation·tenant-extension·rbac 스펙이 따로 다룬다.
import { Role } from '@prisma/client';
import {
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

interface OrgResponse {
  id: string;
  myRole?: Role;
}
interface InvitationResponse {
  inviteUrl: string;
}
interface AcceptResponse {
  organizationId: string;
  role: Role;
}
interface MemberRow {
  email: string;
  role: Role;
}
interface AuditLogListResponse {
  items: { action: string }[];
}

describe('조직 · 멤버 · 초대 (e2e)', () => {
  jest.setTimeout(120_000);

  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await bootstrapTestApp();
  });

  afterAll(() => teardownTestApp(ctx));

  const authed = (user: AuthedUser) => authedAgent(ctx.app, user.accessToken);

  it('조직 생성 → 생성자는 ADMIN, /orgs 목록에 나타나고 감사로그에 ORG_CREATED가 남는다', async () => {
    const owner = await registerAndLogin(ctx.app, 'org-owner@example.com');

    const created = await authed(owner)
      .post('/api/orgs')
      .send({ name: '해피패스 조직' });
    expect(created.status).toBe(201);
    const orgId = typedBody<OrgResponse>(created).id;

    const mine = await authed(owner).get('/api/orgs');
    expect(mine.status).toBe(200);
    expect(mine.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: orgId,
          role: Role.ADMIN,
          memberCount: 1,
        }),
      ]),
    );

    const detail = await authed(owner).get(`/api/orgs/${orgId}`);
    expect(detail.status).toBe(200);
    expect(typedBody<OrgResponse>(detail).myRole).toBe(Role.ADMIN);

    const logs = await authed(owner).get(`/api/orgs/${orgId}/audit-logs`);
    expect(logs.status).toBe(200);
    expect(typedBody<AuditLogListResponse>(logs).items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'ORG_CREATED' }),
      ]),
    );
  });

  it('초대 생성 → 다른 계정이 수락하면 지정된 역할로 멤버가 되고 감사로그가 남는다', async () => {
    const owner = await registerAndLogin(ctx.app, 'invite-owner@example.com');
    const created = await authed(owner)
      .post('/api/orgs')
      .send({ name: '초대 테스트 조직' });
    const orgId = typedBody<OrgResponse>(created).id;

    const invite = await authed(owner)
      .post(`/api/orgs/${orgId}/invitations`)
      .send({ email: 'invitee@example.com', role: Role.TESTER });
    expect(invite.status).toBe(201);
    const token = new URL(
      typedBody<InvitationResponse>(invite).inviteUrl,
      'http://localhost',
    ).searchParams.get('token');
    expect(token).toBeTruthy();

    const invitee = await registerAndLogin(ctx.app, 'invitee@example.com');
    const accept = await authed(invitee)
      .post('/api/invitations/accept')
      .send({ token });
    expect(accept.status).toBe(201); // @HttpCode 없는 POST는 Nest 기본값 201
    const acceptBody = typedBody<AcceptResponse>(accept);
    expect(acceptBody.organizationId).toBe(orgId);
    expect(acceptBody.role).toBe(Role.TESTER);

    const members = await authed(owner).get(`/api/orgs/${orgId}/members`);
    const memberEmails = typedBody<MemberRow[]>(members).map((m) => m.email);
    expect(memberEmails).toContain('invitee@example.com');

    const logs = await authed(owner).get(`/api/orgs/${orgId}/audit-logs`);
    const actions = typedBody<AuditLogListResponse>(logs).items.map(
      (l) => l.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining(['MEMBER_INVITED', 'MEMBER_JOINED']),
    );
  });

  it('멤버 역할 변경/제거가 감사로그(MEMBER_ROLE_CHANGED/MEMBER_REMOVED)로 남는다', async () => {
    const owner = await registerAndLogin(
      ctx.app,
      'lifecycle-owner@example.com',
    );
    const created = await authed(owner)
      .post('/api/orgs')
      .send({ name: '역할 변경 조직' });
    const orgId = typedBody<OrgResponse>(created).id;

    const invite = await authed(owner)
      .post(`/api/orgs/${orgId}/invitations`)
      .send({ email: 'lifecycle-member@example.com', role: Role.VIEWER });
    const token = new URL(
      typedBody<InvitationResponse>(invite).inviteUrl,
      'http://localhost',
    ).searchParams.get('token');
    const member = await registerAndLogin(
      ctx.app,
      'lifecycle-member@example.com',
    );
    await authed(member).post('/api/invitations/accept').send({ token });

    const roleChange = await authed(owner)
      .patch(`/api/orgs/${orgId}/members/${member.userId}`)
      .send({ role: Role.TESTER });
    expect(roleChange.status).toBe(200);
    expect(typedBody<MemberRow>(roleChange).role).toBe(Role.TESTER);

    const removed = await authed(owner).delete(
      `/api/orgs/${orgId}/members/${member.userId}`,
    );
    expect(removed.status).toBe(204);

    const logs = await authed(owner).get(`/api/orgs/${orgId}/audit-logs`);
    const actions = typedBody<AuditLogListResponse>(logs).items.map(
      (l) => l.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining(['MEMBER_ROLE_CHANGED', 'MEMBER_REMOVED']),
    );
  });
});
