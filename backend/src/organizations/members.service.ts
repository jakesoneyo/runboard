// API.md 3장 — 멤버 목록/역할 변경/제거. 마지막 ADMIN 보호(T-11)가 이 서비스의 핵심 규칙이다.
import { Inject, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { diffFields } from '../audit/diff';
import { AuditService } from '../audit/audit.service';
import { DomainException } from '../common/errors/domain-exception';
import {
  TENANT_PRISMA,
  TenantTransactionService,
  type TenantAuditTransaction,
  type TenantPrismaClient,
} from '../prisma/tenant-transaction.service';
import type { UpdateMemberRoleDto } from './dto/update-member-role.schema';

@Injectable()
export class MembersService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrismaClient,
    private readonly tx: TenantTransactionService,
    private readonly audit: AuditService,
  ) {}

  /** orgId는 인자로 받지 않는다 — organizationId는 OrgContextGuard가 이미 ALS에 채워둔 값을 확장이 자동 주입한다. */
  async list() {
    const memberships = await this.prisma.membership.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      joinedAt: m.createdAt,
    }));
  }

  async updateRole(targetUserId: string, dto: UpdateMemberRoleDto) {
    return this.tx.run(async (tx) => {
      const membership = await tx.membership.findFirst({
        where: { userId: targetUserId },
      });
      if (!membership) {
        throw new DomainException(404, 'NOT_FOUND', '멤버를 찾을 수 없습니다.');
      }
      if (membership.role === Role.ADMIN && dto.role !== Role.ADMIN) {
        await this.assertNotLastAdmin(tx, membership.id);
      }

      const updated = await tx.membership.update({
        where: { id: membership.id },
        data: { role: dto.role },
      });
      await this.audit.record(tx, {
        action: 'MEMBER_ROLE_CHANGED',
        targetType: 'MEMBERSHIP',
        targetId: updated.id,
        metadata: diffFields(membership, updated, ['role']),
      });
      return updated;
    });
  }

  async remove(targetUserId: string) {
    return this.tx.run(async (tx) => {
      const membership = await tx.membership.findFirst({
        where: { userId: targetUserId },
      });
      if (!membership) {
        throw new DomainException(404, 'NOT_FOUND', '멤버를 찾을 수 없습니다.');
      }
      if (membership.role === Role.ADMIN) {
        await this.assertNotLastAdmin(tx, membership.id);
      }

      await tx.membership.delete({ where: { id: membership.id } });
      await this.audit.record(tx, {
        action: 'MEMBER_REMOVED',
        targetType: 'MEMBERSHIP',
        targetId: membership.id,
        metadata: { role: [membership.role, null] },
      });
    });
  }

  /** T-11: 마지막 ADMIN을 강등/제거하려는 시도를 막는다 — 대상 본인을 제외하고 ADMIN이 0명이 되면 409. */
  private async assertNotLastAdmin(
    tx: TenantAuditTransaction,
    excludeMembershipId: string,
  ): Promise<void> {
    const remainingAdmins = await tx.membership.count({
      where: { role: Role.ADMIN, id: { not: excludeMembershipId } },
    });
    if (remainingAdmins === 0) {
      throw new DomainException(
        409,
        'MEMBER_LAST_ADMIN',
        '조직에는 최소 1명의 ADMIN이 있어야 합니다.',
      );
    }
  }
}
