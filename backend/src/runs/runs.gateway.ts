// ARCHITECTURE.md 5장 — socket.io 게이트웨이. 쓰기는 전부 REST고, 여기는 인증된 핸드셰이크 +
// 룸 조인 인가 + 프레즌스만 담당한다(RunEventsService가 도메인 이벤트 브로드캐스트를 맡는다).
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Namespace, Socket } from 'socket.io';
import type { AccessTokenPayload } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { RunPresenceService } from './run-presence.service';
import { RunSocketRegistry } from './run-socket.registry';
import { RunsService } from './runs.service';

interface SocketData {
  userId: string;
  email: string;
  name: string;
}

type AckResponse =
  { ok: true; participants?: unknown } | { ok: false; code: string };

/**
 * 네임스페이스 `/realtime`. transports를 websocket 하나로 고정하는 이유는 ARCHITECTURE.md 5장
 * (Render 프록시에서 polling → websocket 업그레이드가 끊기는 이슈 회피).
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: process.env.CORS_ORIGINS?.split(',') ?? true },
  transports: ['websocket'],
})
export class RunsGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer() private readonly server!: Namespace;

  constructor(
    private readonly jwt: JwtService,
    // 원본(비확장) PrismaService만 쓴다 — 소켓 핸드셰이크는 HTTP 미들웨어 체인을 타지 않아
    // AsyncLocalStorage 조직 컨텍스트가 없다(RunsService.assertReadable/isOrgMember도 동일한 이유).
    private readonly prisma: PrismaService,
    private readonly runs: RunsService,
    private readonly presence: RunPresenceService,
    private readonly registry: RunSocketRegistry,
  ) {}

  afterInit(namespace: Namespace): void {
    this.registry.register(namespace);
    // API.md 8장: 핸드셰이크에서만 인증한다 — 이후 이벤트는 이미 인증된 socket.data를 신뢰한다.
    namespace.use((socket: Socket, next: (err?: Error) => void) => {
      this.authenticate(socket)
        .then(() => next())
        .catch(() => next(new Error('인증에 실패했습니다.')));
    });
  }

  handleDisconnect(socket: Socket): void {
    for (const runId of this.presence.leaveAll(socket.id)) {
      this.broadcastPresence(runId);
    }
  }

  @SubscribeMessage('org:join')
  async onOrgJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { orgId?: string },
  ): Promise<AckResponse> {
    if (!body?.orgId) return { ok: false, code: 'VALIDATION_FAILED' };
    const { userId } = this.dataOf(socket);
    const isMember = await this.runs.isOrgMember(body.orgId, userId);
    if (!isMember) return { ok: false, code: 'NOT_FOUND' };
    await socket.join(`org:${body.orgId}`);
    return { ok: true };
  }

  @SubscribeMessage('org:leave')
  onOrgLeave(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { orgId?: string },
  ): AckResponse {
    if (body?.orgId) void socket.leave(`org:${body.orgId}`);
    return { ok: true };
  }

  /**
   * T-7: 남의 조직 runId로는 조인 자체가 거부된다 — REST와 같은 인가 로직(RunsService.assertReadable)을
   * 재사용해 "룸 이름만 알면 훔쳐볼 수 있다"는 사고를 막는다(ARCHITECTURE.md 5장).
   */
  @SubscribeMessage('run:join')
  async onRunJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { orgId?: string; runId?: string },
  ): Promise<AckResponse> {
    if (!body?.orgId || !body.runId) {
      return { ok: false, code: 'VALIDATION_FAILED' };
    }
    const { userId, name } = this.dataOf(socket);
    const allowed = await this.runs.assertReadable(
      body.orgId,
      body.runId,
      userId,
    );
    if (!allowed) return { ok: false, code: 'NOT_FOUND' };

    await socket.join(`run:${body.runId}`);
    this.presence.join(body.runId, socket.id, { userId, name });
    this.broadcastPresence(body.runId);
    return { ok: true, participants: this.presence.list(body.runId) };
  }

  @SubscribeMessage('run:leave')
  onRunLeave(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { orgId?: string; runId?: string },
  ): AckResponse {
    if (!body?.runId) return { ok: false, code: 'VALIDATION_FAILED' };
    void socket.leave(`run:${body.runId}`);
    this.presence.leave(body.runId, socket.id);
    this.broadcastPresence(body.runId);
    return { ok: true };
  }

  private broadcastPresence(runId: string): void {
    this.server.to(`run:${runId}`).emit('run:presence.updated', {
      runId,
      participants: this.presence.list(runId),
    });
  }

  private dataOf(socket: Socket): SocketData {
    return socket.data as SocketData;
  }

  /** REST의 JwtStrategy와 같은 시크릿·같은 payload 모양을 검증한다 — 별도 인증 로직을 만들지 않는다. */
  private async authenticate(socket: Socket): Promise<void> {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) throw new Error('인증 토큰이 없습니다.');
    const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: process.env.JWT_SECRET,
    });
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new Error('사용자를 찾을 수 없습니다.');
    socket.data = {
      userId: user.id,
      email: user.email,
      name: user.name,
    } satisfies SocketData;
  }
}
