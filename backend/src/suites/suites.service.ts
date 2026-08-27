// API.md 4장 — 스위트 트리 CRUD. organizationId는 인자로 받지 않는다(다른 도메인 서비스와 동일 패턴 —
// tenant.extension.ts가 OrgContextGuard가 ALS에 세팅해둔 값을 모든 쿼리에 자동 주입한다).
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
import type { CreateSuiteDto } from './dto/create-suite.schema';
import type { UpdateSuiteDto } from './dto/update-suite.schema';
import {
  assembleSuiteTree,
  type SuiteFlatNode,
} from './lib/assemble-suite-tree';
import {
  createsCycle,
  exceedsMaxDepth,
  type SuiteEdge,
} from './lib/suite-tree-rules';

@Injectable()
export class SuitesService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrismaClient,
    private readonly tx: TenantTransactionService,
    private readonly audit: AuditService,
  ) {}

  /**
   * 스위트 목록. `_count`로 케이스 수를 같은 쿼리에 실어 오므로 조직에 스위트가 몇 개든
   * DB 왕복은 findMany 1회뿐이다(자식별 개별 조회 없음 — PLAN.md C3 "N+1 금지").
   * tree=false는 트리 조립 없이 평면 목록만 돌려준다(같은 쿼리 결과를 재사용).
   */
  async list(
    tree: boolean,
  ): Promise<SuiteFlatNode[] | ReturnType<typeof assembleSuiteTree>> {
    const nodes = await this.loadFlatNodes(this.prisma);
    return tree ? assembleSuiteTree(nodes) : nodes;
  }

  async create(userId: string, dto: CreateSuiteDto) {
    return this.tx.run(async (tx) => {
      if (dto.parentId) {
        await this.assertParentIsUsable(tx, dto.parentId);
      }
      const suite = await tx.testSuite.create({
        data: {
          name: dto.name,
          description: dto.description,
          parentId: dto.parentId ?? null,
          position: dto.position ?? 0,
          createdById: userId,
        } as Prisma.TestSuiteUncheckedCreateInput,
      });
      await this.audit.record(tx, {
        action: 'SUITE_CREATED',
        targetType: 'TEST_SUITE',
        targetId: suite.id,
      });
      return suite;
    });
  }

  async update(suiteId: string, dto: UpdateSuiteDto) {
    return this.tx.run(async (tx) => {
      const existing = await tx.testSuite.findUnique({
        where: { id: suiteId },
      });
      if (!existing) {
        throw new DomainException(
          404,
          'NOT_FOUND',
          '스위트를 찾을 수 없습니다.',
        );
      }

      // parentId가 실제로 바뀌는 요청일 때만 트리 규칙(깊이·순환)을 검사한다.
      if (dto.parentId !== undefined && dto.parentId !== existing.parentId) {
        if (dto.parentId) {
          await this.assertParentIsUsable(tx, dto.parentId, suiteId);
        }
        // null로 보내 최상위로 옮기는 경우는 깊이가 오히려 줄어들 뿐이라 검증할 게 없다.
      }

      const updated = await tx.testSuite.update({
        where: { id: suiteId },
        data: {
          name: dto.name,
          description: dto.description,
          parentId: dto.parentId,
          position: dto.position,
        },
      });
      await this.audit.record(tx, {
        action: 'SUITE_UPDATED',
        targetType: 'TEST_SUITE',
        targetId: updated.id,
        // 요청에 실제로 포함된 필드만 diff 대상으로 삼는다 — 그래야 "변경된 필드만" 기록된다.
        metadata: diffFields(
          existing,
          updated,
          Object.keys(dto) as (keyof typeof existing)[],
        ),
      });
      return updated;
    });
  }

  /** DB 복합 FK(cascade)가 하위 스위트·케이스를 함께 지운다 — 여기서 재귀 삭제를 손으로 구현하지 않는다. */
  async remove(suiteId: string): Promise<void> {
    await this.tx.run(async (tx) => {
      const existing = await tx.testSuite.findUnique({
        where: { id: suiteId },
      });
      if (!existing) {
        throw new DomainException(
          404,
          'NOT_FOUND',
          '스위트를 찾을 수 없습니다.',
        );
      }
      await tx.testSuite.delete({ where: { id: suiteId } });
      await this.audit.record(tx, {
        action: 'SUITE_DELETED',
        targetType: 'TEST_SUITE',
        targetId: suiteId,
      });
    });
  }

  private async loadFlatNodes(
    client: Pick<TenantPrismaClient, 'testSuite'>,
  ): Promise<SuiteFlatNode[]> {
    const suites = await client.testSuite.findMany({
      orderBy: { position: 'asc' },
      select: {
        id: true,
        name: true,
        position: true,
        parentId: true,
        _count: { select: { cases: true } },
      },
    });
    return suites.map((s) => ({
      id: s.id,
      name: s.name,
      position: s.position,
      parentId: s.parentId,
      caseCount: s._count.cases,
    }));
  }

  private async loadEdges(tx: TenantAuditTransaction): Promise<SuiteEdge[]> {
    return tx.testSuite.findMany({ select: { id: true, parentId: true } });
  }

  /**
   * parentId가 (1) 이 조직에 실제로 존재하고 (2) 순환을 만들지 않으며 (3) 최대 깊이(3단계)를
   * 넘지 않는지 검사한다. excludeSuiteId는 update에서 "자기 자신 밑으로 이동" 같은 케이스를 잡는다.
   */
  private async assertParentIsUsable(
    tx: TenantAuditTransaction,
    parentId: string,
    excludeSuiteId?: string,
  ): Promise<void> {
    const edges = await this.loadEdges(tx);
    const parentExists = edges.some((e) => e.id === parentId);
    if (!parentExists) {
      throw new DomainException(
        404,
        'NOT_FOUND',
        '상위 스위트를 찾을 수 없습니다.',
      );
    }
    if (excludeSuiteId && createsCycle(edges, excludeSuiteId, parentId)) {
      throw new DomainException(
        400,
        'VALIDATION_FAILED',
        '자기 자신 또는 하위 스위트를 상위로 지정할 수 없습니다.',
      );
    }
    if (exceedsMaxDepth(edges, parentId)) {
      throw new DomainException(
        400,
        'VALIDATION_FAILED',
        '스위트는 최대 3단계까지만 만들 수 있습니다.',
      );
    }
  }
}
