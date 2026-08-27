// API.md 4장 — 테스트케이스 CRUD. suiteId는 항상 tenant-scoped 클라이언트로 조회해 검증한다 —
// 다른 조직 스위트를 가리키면 findUnique가 조용히 null을 반환해(tenant.extension.ts) 404로 수렴한다.
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { diffFields } from '../audit/diff';
import { DomainException } from '../common/errors/domain-exception';
import {
  TENANT_PRISMA,
  TenantTransactionService,
  type TenantAuditTransaction,
  type TenantPrismaClient,
} from '../prisma/tenant-transaction.service';
import type {
  CreateCaseDto,
  ListCasesQueryDto,
  UpdateCaseDto,
} from './case.schema';

/** 목록 응답에서 제외할 필드 = steps(큰 Json, 상세 조회 전용) — DATA-MODEL.md 5장. */
const LIST_SELECT = {
  id: true,
  suiteId: true,
  title: true,
  preconditions: true,
  expectedResult: true,
  priority: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class CasesService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrismaClient,
    private readonly tx: TenantTransactionService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListCasesQueryDto) {
    const cases = await this.prisma.testCase.findMany({
      where: {
        suiteId: query.suiteId,
        priority: query.priority,
        title: query.q ? { contains: query.q, mode: 'insensitive' } : undefined,
      },
      orderBy: { updatedAt: 'desc' },
      take: query.take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: LIST_SELECT,
    });

    const hasMore = cases.length > query.take;
    const page = hasMore ? cases.slice(0, query.take) : cases;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async getOne(caseId: string) {
    const found = await this.prisma.testCase.findUnique({
      where: { id: caseId },
    });
    if (!found) {
      throw new DomainException(404, 'NOT_FOUND', '케이스를 찾을 수 없습니다.');
    }
    return found;
  }

  async create(userId: string, dto: CreateCaseDto) {
    return this.tx.run(async (tx) => {
      await this.assertSuiteExists(tx, dto.suiteId);
      const created = await tx.testCase.create({
        data: {
          suiteId: dto.suiteId,
          title: dto.title,
          preconditions: dto.preconditions,
          steps: dto.steps,
          expectedResult: dto.expectedResult,
          priority: dto.priority,
          createdById: userId,
          // steps는 Json 컬럼이라 literal 배열 타입과 Prisma의 InputJsonValue 유니온이 구조적으로
          // "충분히 겹치지" 않는다고 판단돼 unknown을 거쳐야 한다(organizationId는 다른 서비스와
          // 동일하게 tenant.extension.ts가 런타임에 주입 — organizations.service.ts 주석 참고).
        } as unknown as Prisma.TestCaseUncheckedCreateInput,
      });
      await this.audit.record(tx, {
        action: 'CASE_CREATED',
        targetType: 'TEST_CASE',
        targetId: created.id,
      });
      return created;
    });
  }

  async update(caseId: string, dto: UpdateCaseDto) {
    return this.tx.run(async (tx) => {
      const existing = await tx.testCase.findUnique({
        where: { id: caseId },
      });
      if (!existing) {
        throw new DomainException(
          404,
          'NOT_FOUND',
          '케이스를 찾을 수 없습니다.',
        );
      }
      if (dto.suiteId && dto.suiteId !== existing.suiteId) {
        await this.assertSuiteExists(tx, dto.suiteId);
      }

      const updated = await tx.testCase.update({
        where: { id: caseId },
        data: {
          suiteId: dto.suiteId,
          title: dto.title,
          preconditions: dto.preconditions,
          steps: dto.steps,
          expectedResult: dto.expectedResult,
          priority: dto.priority,
        },
      });
      await this.audit.record(tx, {
        action: 'CASE_UPDATED',
        targetType: 'TEST_CASE',
        targetId: updated.id,
        // 요청 body에 실제로 들어온 필드만 diff 대상 — 전체 덤프 금지(PLAN.md C3).
        metadata: diffFields(
          existing,
          updated,
          Object.keys(dto) as (keyof typeof existing)[],
        ),
      });
      return updated;
    });
  }

  async remove(caseId: string): Promise<void> {
    await this.tx.run(async (tx) => {
      const existing = await tx.testCase.findUnique({
        where: { id: caseId },
      });
      if (!existing) {
        throw new DomainException(
          404,
          'NOT_FOUND',
          '케이스를 찾을 수 없습니다.',
        );
      }
      await tx.testCase.delete({ where: { id: caseId } });
      await this.audit.record(tx, {
        action: 'CASE_DELETED',
        targetType: 'TEST_CASE',
        targetId: caseId,
      });
    });
  }

  private async assertSuiteExists(
    tx: TenantAuditTransaction,
    suiteId: string,
  ): Promise<void> {
    const suite = await tx.testSuite.findUnique({ where: { id: suiteId } });
    if (!suite) {
      throw new DomainException(404, 'NOT_FOUND', '스위트를 찾을 수 없습니다.');
    }
  }
}
