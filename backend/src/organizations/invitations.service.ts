// API.md 3장 — 초대 생성/조회/폐기/수락. 메일 발송은 비범위(링크 복사, ARCHITECTURE.md).
import { Inject, Injectable } from '@nestjs/common';
import { InviteStatus, type Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { updateRequestContext } from '../common/context/request-context';
import { DomainException } from '../common/errors/domain-exception';
import { PrismaService } from '../prisma/prisma.service';
import {
  TENANT_PRISMA,
  TenantTransactionService,
  type TenantPrismaClient,
} from '../prisma/tenant-transaction.service';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import type { CreateInvitationDto } from './dto/create-invitation.schema';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일 — refresh token과 동일한 관용적 유효기간

@Injectable()
export class InvitationsService {
  constructor(
    // accept()의 토큰 조회는 조직을 아직 모르는 상태에서 일어나 원본 클라이언트가 필요하다
    // (OrgContextGuard가 Membership을 조회할 때와 동일한 성격의 "정당한 예외" — tenant.extension.ts 주석 참고).
    private readonly prisma: PrismaService,
    @Inject(TENANT_PRISMA) private readonly tenantPrisma: TenantPrismaClient,
    private readonly tx: TenantTransactionService,
    private readonly audit: AuditService,
  ) {}

  async create(invitedById: string, dto: CreateInvitationDto) {
    const rawToken = randomBytes(32).toString('base64url');
    return this.tx.run(async (tx) => {
      // organizationId는 tenant.extension.ts가 ALS 컨텍스트(OrgContextGuard가 세팅)에서 런타임에 주입한다.
      const invitation = await tx.invitation.create({
        data: {
          email: dto.email,
          role: dto.role,
          tokenHash: this.hashToken(rawToken),
          expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
          invitedById,
        } as Prisma.InvitationUncheckedCreateInput,
      });
      await this.audit.record(tx, {
        action: 'MEMBER_INVITED',
        targetType: 'INVITATION',
        targetId: invitation.id,
        metadata: { email: dto.email, role: dto.role },
      });
      return {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        inviteUrl: this.buildInviteUrl(rawToken),
      };
    });
  }

  async list() {
    const invitations = await this.tenantPrisma.invitation.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
      },
    });
    return invitations;
  }

  async revoke(invitationId: string) {
    const invitation = await this.tenantPrisma.invitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation || invitation.status !== InviteStatus.PENDING) {
      throw new DomainException(404, 'NOT_FOUND', '초대를 찾을 수 없습니다.');
    }
    await this.tenantPrisma.invitation.update({
      where: { id: invitationId },
      data: { status: InviteStatus.REVOKED },
    });
  }

  /**
   * 초대 수락. 토큰만으로 조직을 알아내야 해서 원본 클라이언트로 조회한 뒤,
   * OrgContextGuard가 하듯 컨텍스트를 직접 열어(organizations.service.ts create()와 동일한 패턴)
   * Membership 생성 + Invitation 갱신을 tenant.extension.ts 보호 아래에서 수행한다.
   */
  async accept(user: AuthenticatedUser, token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    // 존재하지 않는 토큰과 "남의 이메일로 발급된" 토큰을 구분해서 알려주지 않는다(존재 은닉).
    if (!invitation || invitation.email !== user.email) {
      throw new DomainException(404, 'NOT_FOUND', '초대를 찾을 수 없습니다.');
    }
    if (
      invitation.status !== InviteStatus.PENDING ||
      invitation.expiresAt < new Date()
    ) {
      throw new DomainException(
        409,
        'CONFLICT',
        '이미 처리되었거나 만료된 초대입니다.',
      );
    }

    updateRequestContext({
      organizationId: invitation.organizationId,
      role: invitation.role,
    });
    return this.tx.run(async (tx) => {
      const existing = await tx.membership.findFirst({
        where: { userId: user.id },
      });
      if (existing) {
        throw new DomainException(409, 'CONFLICT', '이미 소속된 조직입니다.');
      }
      // 여기서도 organizationId는 accept() 시작부에서 연 컨텍스트로부터 확장이 주입한다.
      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          role: invitation.role,
        } as Prisma.MembershipUncheckedCreateInput,
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: InviteStatus.ACCEPTED, acceptedAt: new Date() },
      });
      await this.audit.record(tx, {
        action: 'MEMBER_JOINED',
        targetType: 'MEMBERSHIP',
        targetId: membership.id,
      });
      return {
        organizationId: invitation.organizationId,
        role: membership.role,
      };
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildInviteUrl(rawToken: string): string {
    const base = process.env.FRONTEND_URL?.replace(/\/$/, '') ?? '';
    return `${base}/invitations/accept?token=${rawToken}`;
  }
}
