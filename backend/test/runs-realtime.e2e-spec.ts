// PLAN.md C4 그룹 3(소켓 부분) — T-7(룸 격리), T-16(트랜잭션 롤백 시 이벤트 미발행),
// T-17(REST 기록이 다른 클라이언트에 실시간 도착), T-18(재연결 후 룸 재조인 + 프레즌스).
import { Role } from '@prisma/client';
import type { Socket } from 'socket.io-client';
import { AuditService } from '../src/audit/audit.service';
import {
  addMember,
  authedAgent,
  registerAndLogin,
  seedOrganization,
  typedBody,
  type AuthedUser,
} from './support/fixtures';
import {
  assertNoEvent,
  connectSocket,
  emitWithAck,
  waitForConnect,
  waitForEvent,
} from './support/socket-client';
import {
  bootstrapTestApp,
  teardownTestApp,
  type TestApp,
} from './support/test-app';

interface RunResponse {
  id: string;
}
interface RunCaseResponse {
  id: string;
}
interface CaseResponse {
  id: string;
}
interface JoinAck {
  ok: boolean;
  code?: string;
  participants?: { userId: string; name: string }[];
}

describe('RunsGateway 실시간 (e2e)', () => {
  jest.setTimeout(120_000);

  let ctx: TestApp;
  let orgA: { id: string };
  let orgB: { id: string };
  let admin: AuthedUser;
  let qaLead: AuthedUser;
  let adminB: AuthedUser;
  let suiteId: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    ctx = await bootstrapTestApp();
    orgA = await seedOrganization(ctx.prisma, 'Realtime Org A');
    orgB = await seedOrganization(ctx.prisma, 'Realtime Org B');
    admin = await registerAndLogin(ctx.app, 'realtime-admin@example.com');
    qaLead = await registerAndLogin(ctx.app, 'realtime-qalead@example.com');
    adminB = await registerAndLogin(ctx.app, 'realtime-admin-b@example.com');
    await addMember(ctx.prisma, orgA.id, admin.userId, Role.ADMIN);
    await addMember(ctx.prisma, orgA.id, qaLead.userId, Role.QA_LEAD);
    await addMember(ctx.prisma, orgB.id, adminB.userId, Role.ADMIN);

    const suite = await ctx.prisma.testSuite.create({
      data: {
        organizationId: orgA.id,
        name: '실시간 테스트 스위트',
        createdById: admin.userId,
      },
    });
    suiteId = suite.id;
  });

  afterAll(async () => {
    for (const s of sockets) s.disconnect();
    await teardownTestApp(ctx);
  });

  const authed = (user: AuthedUser) => authedAgent(ctx.app, user.accessToken);

  /** 실행 하나를 IN_PROGRESS까지 만들어 반환한다(결과 기록 테스트 공용 준비 단계). */
  async function createInProgressRun(name: string) {
    const caseRes = await authed(qaLead)
      .post(`/api/orgs/${orgA.id}/cases`)
      .send({
        suiteId,
        title: `${name} 케이스`,
        steps: [{ order: 1, action: '확인' }],
        expectedResult: '통과',
      });
    const caseId = typedBody<CaseResponse>(caseRes).id;

    const runRes = await authed(qaLead)
      .post(`/api/orgs/${orgA.id}/runs`)
      .send({ name, caseIds: [caseId] });
    const runId = typedBody<RunResponse>(runRes).id;

    await authed(qaLead)
      .patch(`/api/orgs/${orgA.id}/runs/${runId}/status`)
      .send({ status: 'IN_PROGRESS' });

    const casesRes = await authed(qaLead).get(
      `/api/orgs/${orgA.id}/runs/${runId}/cases`,
    );
    const runCaseId = typedBody<RunCaseResponse[]>(casesRes)[0].id;
    return { runId, runCaseId };
  }

  function client(user: AuthedUser): Socket {
    const socket = connectSocket(ctx.url, user.accessToken);
    sockets.push(socket);
    return socket;
  }

  describe('T-7: 다른 조직의 runId로 run:join 시도는 거부된다', () => {
    it('조직 B 멤버가 조직 A의 run에 join하면 ok:false NOT_FOUND', async () => {
      const { runId } = await createInProgressRun('T7 실행');
      const socket = client(adminB);
      await waitForConnect(socket);

      const ack = await emitWithAck<JoinAck>(socket, 'run:join', {
        orgId: orgA.id,
        runId,
      });
      expect(ack.ok).toBe(false);
      expect(ack.code).toBe('NOT_FOUND');
    });

    it('실제로 조인되지 않으므로 이후 이벤트도 받지 못한다', async () => {
      const { runId, runCaseId } = await createInProgressRun('T7 이벤트 실행');
      const intruder = client(adminB);
      await waitForConnect(intruder);
      await emitWithAck(intruder, 'run:join', { orgId: orgA.id, runId });

      const legitimate = client(qaLead);
      await waitForConnect(legitimate);
      const ack = await emitWithAck<JoinAck>(legitimate, 'run:join', {
        orgId: orgA.id,
        runId,
      });
      expect(ack.ok).toBe(true);

      const recordPromise = authed(qaLead)
        .patch(`/api/orgs/${orgA.id}/runs/${runId}/cases/${runCaseId}`)
        .send({ result: 'PASS' });

      await Promise.all([
        recordPromise,
        assertNoEvent(intruder, 'run:case.recorded', 1000),
      ]);
    });
  });

  describe('T-17: REST로 기록하면 같은 run 룸의 다른 클라이언트가 실시간으로 받는다', () => {
    it('run:case.recorded + run:progress.updated 수신', async () => {
      const { runId, runCaseId } = await createInProgressRun('T17 실행');

      const viewerSocket = client(admin);
      await waitForConnect(viewerSocket);
      const joinAck = await emitWithAck<JoinAck>(viewerSocket, 'run:join', {
        orgId: orgA.id,
        runId,
      });
      expect(joinAck.ok).toBe(true);

      const recordedPromise = waitForEvent<{
        runCaseId: string;
        result: string;
      }>(viewerSocket, 'run:case.recorded');
      const progressPromise = waitForEvent<{ passedCount: number }>(
        viewerSocket,
        'run:progress.updated',
      );

      const res = await authed(qaLead)
        .patch(`/api/orgs/${orgA.id}/runs/${runId}/cases/${runCaseId}`)
        .send({ result: 'PASS', comment: '실시간 확인' });
      expect(res.status).toBe(200);

      const recorded = await recordedPromise;
      expect(recorded.runCaseId).toBe(runCaseId);
      expect(recorded.result).toBe('PASS');

      const progress = await progressPromise;
      expect(progress.passedCount).toBe(1);
    });
  });

  describe('T-16: 트랜잭션이 실패하면 DB도 이벤트도 남지 않는다', () => {
    it('AuditService.record가 실패하면 결과 기록도 롤백되고 소켓 이벤트도 발행되지 않는다', async () => {
      const { runId, runCaseId } = await createInProgressRun('T16 실행');

      const watcherSocket = client(qaLead);
      await waitForConnect(watcherSocket);
      const joinAck = await emitWithAck<JoinAck>(watcherSocket, 'run:join', {
        orgId: orgA.id,
        runId,
      });
      expect(joinAck.ok).toBe(true);

      const auditService = ctx.moduleRef.get(AuditService);
      const spy = jest
        .spyOn(auditService, 'record')
        .mockRejectedValueOnce(new Error('의도적으로 주입한 감사로그 실패'));

      const [res] = await Promise.all([
        authed(qaLead)
          .patch(`/api/orgs/${orgA.id}/runs/${runId}/cases/${runCaseId}`)
          .send({ result: 'FAIL' }),
        assertNoEvent(watcherSocket, 'run:case.recorded', 1000),
      ]);
      expect(res.status).toBe(500); // AuditService.record 실패는 도메인 예외가 아니라 그대로 전파된다

      const runCase = await ctx.prisma.testRunCase.findUnique({
        where: { id: runCaseId },
      });
      expect(runCase?.result).toBe('PENDING'); // 카운터 갱신도 함께 롤백됐다
      const run = await ctx.prisma.testRun.findUnique({ where: { id: runId } });
      expect(run?.failedCount).toBe(0);

      spy.mockRestore();
    });
  });

  describe('T-18: 재연결 후 룸을 다시 조인하면 프레즌스가 갱신되고 중복이 없다', () => {
    it('연결 끊김 → 재연결 → 재조인 시 참여자 목록에 같은 사용자가 한 번만 남는다', async () => {
      const { runId } = await createInProgressRun('T18 실행');

      const first = client(admin);
      await waitForConnect(first);
      const firstAck = await emitWithAck<JoinAck>(first, 'run:join', {
        orgId: orgA.id,
        runId,
      });
      expect(firstAck.participants).toHaveLength(1);

      first.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 300)); // 서버가 disconnect를 처리할 시간

      const second = client(admin);
      await waitForConnect(second);
      // 조인 요청 전에 리스너를 먼저 걸어둔다 — 같은 소켓 위에서 브로드캐스트(presence.updated)가
      // ack보다 먼저 나가므로(runs.gateway.ts: join → 브로드캐스트 → ack 반환 순서) 순서가 보장된다.
      const presenceUpdated = waitForEvent<{
        participants: { userId: string }[];
      }>(second, 'run:presence.updated');
      const secondAck = await emitWithAck<JoinAck>(second, 'run:join', {
        orgId: orgA.id,
        runId,
      });
      expect(secondAck.ok).toBe(true);
      // 재연결 전 소켓은 disconnect 처리로 이미 프레즌스에서 빠졌으므로 중복 없이 1명이어야 한다.
      expect(secondAck.participants).toHaveLength(1);
      expect(secondAck.participants?.[0].userId).toBe(admin.userId);

      const presencePayload = await presenceUpdated;
      expect(presencePayload.participants).toHaveLength(1);
    });
  });
});
