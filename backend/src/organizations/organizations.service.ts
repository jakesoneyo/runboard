// API.md 3장 — 조직 CRUD. 생성만 "조직 컨텍스트가 아직 없는" 특수 경로다(아래 create() 주석 참고).
import { Injectable } from '@nestjs/common';
import { Role, type Prisma } from '@prisma/client';
import {
  getRequestContext,
  updateRequestContext,
} from '../common/context/request-context';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantTransactionService } from '../prisma/tenant-transaction.service';
import type { CreateOrganizationDto } from './dto/create-organization.schema';
import type { UpdateOrganizationDto } from './dto/update-organization.schema';
import { slugify } from './lib/slugify';

@Injectable()
export class OrganizationsService {
  constructor(
    // Organization은 테넌트 모델이 아니라(organizationId 컬럼이 없다) 원본 클라이언트로 다뤄도 안전하다.
    private readonly prisma: PrismaService,
    private readonly tx: TenantTransactionService,
    private readonly audit: AuditService,
  ) {}

  /** 내가 속한 조직 목록 — Membership은 테넌트 모델이지만 organizationId 필터가 아니라 userId 필터가 필요해
   * 여기서는 확장을 타지 않는 원본 클라이언트로 직접 조회한다(OrgContextGuard와 동일한 성격의 예외). */
  async listMine(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: {
        organization: {
          include: { _count: { select: { memberships: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
      memberCount: m.organization._count.memberships,
    }));
  }

  /**
   * 조직 생성. 생성자가 즉시 ADMIN이 되는데, 이 순간에는 아직 "그 조직의 멤버"가 아니므로
   * OrgContextGuard가 세팅해줄 organizationId가 ALS에 없다 — 여기서만 직접 컨텍스트를 열어
   * Membership(테넌트 모델) 생성이 tenant.extension.ts를 정상 통과하게 만든다.
   * (같은 요청 안에서만 유효한 컨텍스트 확장이라 다른 요청으로 새지 않는다 — ALS는 요청마다 별도 store.)
   */
  async create(userId: string, dto: CreateOrganizationDto) {
    return this.tx.run(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: dto.name, slug: dto.slug ?? slugify(dto.name) },
      });
      updateRequestContext({
        organizationId: organization.id,
        role: Role.ADMIN,
      });
      // organizationId는 여기서 굳이 넣지 않는다 — tenant.extension.ts가 방금 세팅한 컨텍스트에서
      // 런타임에 주입한다(타입에는 필수로 보이지만 실제로는 확장이 채운다는 걸 캐스팅으로 명시).
      await tx.membership.create({
        data: {
          userId,
          role: Role.ADMIN,
        } as Prisma.MembershipUncheckedCreateInput,
      });
      await this.audit.record(tx, {
        action: 'ORG_CREATED',
        targetType: 'ORGANIZATION',
        targetId: organization.id,
      });
      return organization;
    });
  }

  /** OrgContextGuard가 이미 (userId, orgId) 멤버십을 검증했으므로 role은 ALS에서 그대로 읽는다. */
  async getOne(orgId: string) {
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
    });
    return { ...organization, myRole: getRequestContext()?.role };
  }

  async update(orgId: string, dto: UpdateOrganizationDto) {
    // AuditAction enum(DATA-MODEL.md)에 조직 이름 변경 이벤트가 정의돼 있지 않아 감사로그는 남기지 않는다.
    return this.prisma.organization.update({
      where: { id: orgId },
      data: { name: dto.name },
    });
  }
}
