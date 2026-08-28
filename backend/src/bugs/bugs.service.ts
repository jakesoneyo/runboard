// API.md 6장 — 버그 리포트 CRUD. testRunCaseId는 tenant-scoped 클라이언트로 조회해 존재를
// 검증한다 — 다른 조직 소속이면 findUnique가 조용히 null을 반환해(tenant.extension.ts) 404로
// 수렴한다(cases.service.ts의 assertSuiteExists와 같은 패턴).
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { diffFields } from '../audit/diff';
import { DomainException } from '../common/errors/domain-exception';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import {
  TENANT_PRISMA,
  TenantTransactionService,
  type TenantPrismaClient,
} from '../prisma/tenant-transaction.service';
import { RunEventsService } from '../runs/run-events.service';
import type { CreateBugDto } from './dto/create-bug.schema';
import type { ListBugsQueryDto } from './dto/list-bugs-query.schema';
import type { UpdateBugDto } from './dto/update-bug.schema';

const RUN_CASE_SUMMARY_SELECT = {
  id: true,
  testRunId: true,
  title: true,
  result: true,
} as const;

@Injectable()
export class BugsService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrismaClient,
    // WS 페이로드에 이름을 싣기 위한 조회 전용(access token엔 name이 없다 — runs.service.ts와 동일한 이유).
    private readonly rawPrisma: PrismaService,
    private readonly tx: TenantTransactionService,
    private readonly audit: AuditService,
    private readonly events: RunEventsService,
  ) {}

  async list(query: ListBugsQueryDto) {
    const bugs = await this.prisma.bugReport.findMany({
      where: {
        status: query.status,
        severity: query.severity,
        // BugReport에는 testRunId 컬럼이 없다(0..1 RunCase 파생) — 연결된 RunCase를 통해 필터한다.
        runCase: query.testRunId ? { testRunId: query.testRunId } : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: query.take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = bugs.length > query.take;
    const page = hasMore ? bugs.slice(0, query.take) : bugs;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async getOne(bugId: string) {
    const bug = await this.prisma.bugReport.findUnique({
      where: { id: bugId },
      include: { runCase: { select: RUN_CASE_SUMMARY_SELECT } },
    });
    if (!bug) {
      throw new DomainException(404, 'NOT_FOUND', '버그를 찾을 수 없습니다.');
    }
    return bug;
  }

  /** API.md 6장: 생성은 TESTER+. FAIL RunCase에서 파생되거나(testRunCaseId) 직접 생성 둘 다 허용. */
  async create(userId: string, dto: CreateBugDto) {
    const organizationId = this.requireOrganizationId();
    const created = await this.tx.run(async (tx) => {
      let runId: string | null = null;
      if (dto.testRunCaseId) {
        const runCase = await tx.testRunCase.findUnique({
          where: { id: dto.testRunCaseId },
          select: { id: true, testRunId: true },
        });
        if (!runCase) {
          throw new DomainException(
            404,
            'NOT_FOUND',
            '실행 케이스를 찾을 수 없습니다.',
          );
        }
        runId = runCase.testRunId;
      }

      const bug = await tx.bugReport.create({
        data: {
          title: dto.title,
          description: dto.description,
          stepsToReproduce: dto.stepsToReproduce,
          severity: dto.severity,
          testRunCaseId: dto.testRunCaseId,
          reportedById: userId,
          // steps와 동일한 이유(cases.service.ts 주석 참고)로 unknown을 거친다.
        } as unknown as Prisma.BugReportUncheckedCreateInput,
      });
      await this.audit.record(tx, {
        action: 'BUG_CREATED',
        targetType: 'BUG_REPORT',
        targetId: bug.id,
      });
      return { bug, runId };
    });

    const reporterName = await this.nameOf(userId);
    this.events.emitBugCreated(organizationId, {
      bugId: created.bug.id,
      title: created.bug.title,
      severity: created.bug.severity,
      runId: created.runId,
      reportedBy: { id: userId, name: reporterName },
    });
    return created.bug;
  }

  /** API.md 6장: QA_LEAD+ 전용. status=RESOLVED면 resolvedAt 세팅, 상태 변경분은 BUG_STATUS_CHANGED로 구분 기록. */
  async update(userId: string, bugId: string, dto: UpdateBugDto) {
    const organizationId = this.requireOrganizationId();
    const updated = await this.tx.run(async (tx) => {
      const existing = await tx.bugReport.findUnique({ where: { id: bugId } });
      if (!existing) {
        throw new DomainException(404, 'NOT_FOUND', '버그를 찾을 수 없습니다.');
      }

      const statusChanged = dto.status && dto.status !== existing.status;
      const data: Prisma.BugReportUpdateInput = {
        title: dto.title,
        description: dto.description,
        stepsToReproduce: dto.stepsToReproduce,
        severity: dto.severity,
        status: dto.status,
        assigneeId: dto.assigneeId,
      };
      if (dto.status === 'RESOLVED' && existing.status !== 'RESOLVED') {
        data.resolvedAt = new Date();
      }

      const bug = await tx.bugReport.update({ where: { id: bugId }, data });
      await this.audit.record(tx, {
        action: statusChanged ? 'BUG_STATUS_CHANGED' : 'BUG_UPDATED',
        targetType: 'BUG_REPORT',
        targetId: bugId,
        metadata: diffFields(
          existing,
          bug,
          Object.keys(dto) as (keyof typeof existing)[],
        ),
      });
      return bug;
    });

    const actorName = await this.nameOf(userId);
    this.events.emitBugUpdated(organizationId, {
      bugId: updated.id,
      title: updated.title,
      status: updated.status,
      severity: updated.severity,
      assigneeId: updated.assigneeId,
      updatedBy: { id: userId, name: actorName },
    });
    return updated;
  }

  private requireOrganizationId(): string {
    const organizationId = getRequestContext()?.organizationId;
    if (!organizationId) {
      // OrgContextGuard가 항상 먼저 채우므로 실사용 경로에선 발생하지 않는다 — 배선 실수 조기 발견용.
      throw new Error('조직 컨텍스트 없이 BugsService가 호출되었습니다.');
    }
    return organizationId;
  }

  private async nameOf(userId: string): Promise<string> {
    const user = await this.rawPrisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true },
    });
    return user.name;
  }
}
