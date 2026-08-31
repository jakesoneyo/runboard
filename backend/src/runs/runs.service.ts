// API.md 5장 — 실행(TestRun) 생성·조회·결과 기록·상태 전이·배정. DATA-MODEL.md 5장의 3쿼리 고정
// 트랜잭션(RunCase update + TestRun 카운터 update + AuditLog.create)이 이 파일의 핵심 규칙이다.
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, RunCaseResult } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { DomainException } from '../common/errors/domain-exception';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import {
  TENANT_PRISMA,
  TenantTransactionService,
  type TenantAuditTransaction,
  type TenantPrismaClient,
} from '../prisma/tenant-transaction.service';
import type { CreateRunDto } from './dto/create-run.schema';
import type { ListRunCasesQueryDto } from './dto/list-run-cases-query.schema';
import type { ListRunsQueryDto } from './dto/list-runs-query.schema';
import type { RecordResultDto } from './dto/record-result.schema';
import type { UpdateAssigneesDto } from './dto/update-assignees.schema';
import type { UpdateRunStatusDto } from './dto/update-run-status.schema';
import { RunEventsService } from './run-events.service';
import {
  COUNTER_FIELD_BY_RESULT,
  computeCounters,
  type CounterField,
} from './lib/run-counters';
import { assertValidRunTransition } from './lib/run-status-transition';

@Injectable()
export class RunsService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrismaClient,
    // 조직 컨텍스트가 아직 성립하지 않는 소켓 인가 체크(assertReadable/isOrgMember) 전용 — 그 외에는
    // 절대 이 클라이언트로 테넌트 데이터를 읽지 않는다(다른 서비스와 동일한 원칙, prisma.service.ts 참고).
    private readonly rawPrisma: PrismaService,
    private readonly tx: TenantTransactionService,
    private readonly audit: AuditService,
    private readonly events: RunEventsService,
  ) {}

  async list(query: ListRunsQueryDto, userId: string) {
    const runs = await this.prisma.testRun.findMany({
      where: {
        status: query.status,
        assignees: query.assignedToMe ? { some: { userId } } : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: query.take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        assignees: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    const hasMore = runs.length > query.take;
    const page = hasMore ? runs.slice(0, query.take) : runs;
    return {
      items: page.map((run) => this.toRunSummary(run)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async getOne(runId: string) {
    const run = await this.prisma.testRun.findUnique({
      where: { id: runId },
      include: {
        assignees: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    if (!run) {
      throw new DomainException(404, 'NOT_FOUND', '실행을 찾을 수 없습니다.');
    }
    return this.toRunSummary(run);
  }

  /** API.md 5장: steps 포함 전체 케이스 목록. recordedBy는 User 관계가 없어 별도 배치 조회로 붙인다. */
  async listCases(runId: string, query: ListRunCasesQueryDto) {
    const run = await this.prisma.testRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) {
      throw new DomainException(404, 'NOT_FOUND', '실행을 찾을 수 없습니다.');
    }
    const runCases = await this.prisma.testRunCase.findMany({
      where: { testRunId: runId, result: query.result },
      orderBy: { position: 'asc' },
    });
    const recorderIds = [
      ...new Set(
        runCases
          .map((c) => c.recordedById)
          .filter((id): id is string => id !== null),
      ),
    ];
    const recorders = recorderIds.length
      ? await this.rawPrisma.user.findMany({
          where: { id: { in: recorderIds } },
          select: { id: true, name: true },
        })
      : [];
    const recorderNameById = new Map(recorders.map((u) => [u.id, u.name]));

    return runCases.map((c) => ({
      id: c.id,
      position: c.position,
      title: c.title,
      steps: c.steps,
      expectedResult: c.expectedResult,
      priority: c.priority,
      result: c.result,
      comment: c.comment,
      recordedBy: c.recordedById
        ? { id: c.recordedById, name: recorderNameById.get(c.recordedById) }
        : null,
      recordedAt: c.recordedAt,
    }));
  }

  /**
   * 선택된 케이스를 RunCase로 스냅샷 복사한다(트랜잭션 1회, createMany). 이후 원본 TestCase가
   * 바뀌어도 이 스냅샷은 절대 갱신되지 않는다(UBIQUITOUS_LANGUAGE.md "실행" 정의, T-14).
   * @throws DomainException 400 RUN_NO_CASES — suiteIds/caseIds가 실제로는 케이스 0건으로 귀결된 경우.
   */
  async create(userId: string, dto: CreateRunDto) {
    return this.tx.run(async (tx) => {
      const orConditions: Prisma.TestCaseWhereInput[] = [];
      if (dto.suiteIds?.length) {
        orConditions.push({ suiteId: { in: dto.suiteIds } });
      }
      if (dto.caseIds?.length) {
        orConditions.push({ id: { in: dto.caseIds } });
      }
      const cases = orConditions.length
        ? await tx.testCase.findMany({
            where: { OR: orConditions },
            orderBy: { createdAt: 'asc' },
          })
        : [];
      if (cases.length === 0) {
        throw new DomainException(
          400,
          'RUN_NO_CASES',
          '실행에 포함할 케이스가 없습니다.',
        );
      }

      if (dto.assigneeIds?.length) {
        await this.assertAssigneesAreMembers(tx, dto.assigneeIds);
      }

      const run = await tx.testRun.create({
        data: {
          name: dto.name,
          description: dto.description,
          createdById: userId,
          totalCount: cases.length,
        } as unknown as Prisma.TestRunUncheckedCreateInput,
      });
      await tx.testRunCase.createMany({
        data: cases.map((c, index) => ({
          testRunId: run.id,
          sourceCaseId: c.id,
          title: c.title,
          steps: c.steps,
          expectedResult: c.expectedResult,
          priority: c.priority,
          position: index,
        })) as unknown as Prisma.TestRunCaseUncheckedCreateInput[],
      });
      if (dto.assigneeIds?.length) {
        await tx.testRunAssignee.createMany({
          data: dto.assigneeIds.map((assigneeId) => ({
            testRunId: run.id,
            userId: assigneeId,
          })) as unknown as Prisma.TestRunAssigneeUncheckedCreateInput[],
        });
      }
      await this.audit.record(tx, {
        action: 'RUN_CREATED',
        targetType: 'TEST_RUN',
        targetId: run.id,
        metadata: { caseCount: cases.length },
      });
      return run;
    });
  }

  /**
   * 결과 기록 — DATA-MODEL.md 5장 3쿼리 고정 트랜잭션. emit은 트랜잭션이 완전히 커밋된 뒤
   * (이 메서드가 tx.run()의 await를 통과한 뒤)에만 호출한다 — 롤백 시 아래 emit 코드 자체가
   * 실행되지 않는다는 점이 T-16("트랜잭션 실패 시 이벤트 미발행")의 실제 보장 근거다.
   * @throws DomainException 409 RUN_NOT_IN_PROGRESS — 진행 중이 아닌 실행에 기록 시도.
   */
  async recordResult(
    runId: string,
    runCaseId: string,
    userId: string,
    dto: RecordResultDto,
  ) {
    const outcome = await this.tx.run(async (tx) => {
      const run = await tx.testRun.findUnique({ where: { id: runId } });
      if (!run) {
        throw new DomainException(404, 'NOT_FOUND', '실행을 찾을 수 없습니다.');
      }
      if (run.status !== 'IN_PROGRESS') {
        throw new DomainException(
          409,
          'RUN_NOT_IN_PROGRESS',
          '진행 중인 실행이 아닙니다.',
        );
      }
      const runCase = await tx.testRunCase.findUnique({
        where: { id: runCaseId },
      });
      if (!runCase || runCase.testRunId !== runId) {
        throw new DomainException(
          404,
          'NOT_FOUND',
          '실행 케이스를 찾을 수 없습니다.',
        );
      }

      const previousResult = runCase.result;
      const isPending = dto.result === 'PENDING';
      const updatedCase = await tx.testRunCase.update({
        where: { id: runCaseId },
        data: {
          result: dto.result,
          comment: dto.comment,
          recordedById: isPending ? null : userId,
          recordedAt: isPending ? null : new Date(),
        },
      });

      const updatedRun = await this.applyCounterShift(
        tx,
        runId,
        previousResult,
        dto.result,
      );

      await this.audit.record(tx, {
        action: 'RUNCASE_RESULT_RECORDED',
        targetType: 'TEST_RUN_CASE',
        targetId: runCaseId,
        metadata: { result: [previousResult, dto.result] },
      });

      return { updatedCase, updatedRun, previousResult };
    });

    const counters = computeCounters(outcome.updatedRun);
    const actorName = await this.nameOf(userId);
    this.events.emitCaseRecorded(runId, {
      runCaseId,
      result: outcome.updatedCase.result,
      previousResult: outcome.previousResult,
      comment: outcome.updatedCase.comment,
      recordedBy: { id: userId, name: actorName },
      recordedAt: outcome.updatedCase.recordedAt,
    });
    this.events.emitProgressUpdated(runId, counters);

    return { runCase: outcome.updatedCase, counters };
  }

  async updateStatus(runId: string, userId: string, dto: UpdateRunStatusDto) {
    const organizationId = getRequestContext()?.organizationId;
    const updated = await this.tx.run(async (tx) => {
      const run = await tx.testRun.findUnique({ where: { id: runId } });
      if (!run) {
        throw new DomainException(404, 'NOT_FOUND', '실행을 찾을 수 없습니다.');
      }
      assertValidRunTransition(run.status, dto.status);

      const now = new Date();
      const data: Prisma.TestRunUpdateInput = { status: dto.status };
      if (dto.status === 'IN_PROGRESS' && !run.startedAt) data.startedAt = now;
      if (dto.status === 'COMPLETED' || dto.status === 'ABORTED') {
        data.completedAt = now;
      }

      const result = await tx.testRun.update({ where: { id: runId }, data });
      await this.audit.record(tx, {
        action: this.statusAuditAction(dto.status),
        targetType: 'TEST_RUN',
        targetId: runId,
        metadata: { status: [run.status, dto.status] },
      });
      return result;
    });

    if (organizationId) {
      const actorName = await this.nameOf(userId);
      this.events.emitStatusChanged({
        runId,
        organizationId,
        status: updated.status,
        changedBy: { id: userId, name: actorName },
        at: updated.updatedAt,
      });
    }
    return updated;
  }

  /** API.md 5장: 전체 치환 — 기존 배정을 지우고 새 목록으로 대체한다. */
  async updateAssignees(runId: string, dto: UpdateAssigneesDto) {
    const assignees = await this.tx.run(async (tx) => {
      const run = await tx.testRun.findUnique({ where: { id: runId } });
      if (!run) {
        throw new DomainException(404, 'NOT_FOUND', '실행을 찾을 수 없습니다.');
      }
      if (dto.userIds.length) {
        await this.assertAssigneesAreMembers(tx, dto.userIds);
      }
      await tx.testRunAssignee.deleteMany({ where: { testRunId: runId } });
      if (dto.userIds.length) {
        await tx.testRunAssignee.createMany({
          data: dto.userIds.map((assigneeId) => ({
            testRunId: runId,
            userId: assigneeId,
          })) as unknown as Prisma.TestRunAssigneeUncheckedCreateInput[],
        });
      }
      await this.audit.record(tx, {
        action: 'RUN_ASSIGNEES_CHANGED',
        targetType: 'TEST_RUN',
        targetId: runId,
        metadata: { assigneeIds: [null, dto.userIds] },
      });
      return this.loadAssigneesWithNames(tx, runId);
    });

    this.events.emitAssigneesChanged(runId, assignees);
    return { runId, assignees };
  }

  /** API.md 5장: RunCase 스냅샷 기반 버그 초안(저장 안 함). */
  async bugDraft(runId: string, runCaseId: string) {
    const runCase = await this.prisma.testRunCase.findUnique({
      where: { id: runCaseId },
    });
    if (!runCase || runCase.testRunId !== runId) {
      throw new DomainException(
        404,
        'NOT_FOUND',
        '실행 케이스를 찾을 수 없습니다.',
      );
    }
    const steps = Array.isArray(runCase.steps)
      ? (runCase.steps as Array<{
          order: number;
          action: string;
          expected?: string;
        }>)
      : [];
    return {
      title: `[버그] ${runCase.title}`,
      description: [
        `기대 결과: ${runCase.expectedResult}`,
        `기록된 코멘트: ${runCase.comment ?? '(없음)'}`,
      ].join('\n'),
      stepsToReproduce: steps.map((s) => ({
        order: s.order,
        action: s.action,
        expected: s.expected,
      })),
    };
  }

  // ───────── 소켓 게이트웨이 전용 인가(핸드셰이크는 HTTP 미들웨어 체인을 타지 않아 ALS가 비어 있다) ─────────

  /** ARCHITECTURE.md 5장 "run:join 수신 시 REST와 동일한 인가 로직을 재사용" — RunsGateway가 호출한다. */
  async assertReadable(
    organizationId: string,
    runId: string,
    userId: string,
  ): Promise<boolean> {
    if (!(await this.isOrgMember(organizationId, userId))) return false;
    const run = await this.rawPrisma.testRun.findUnique({
      where: { id: runId },
    });
    return run?.organizationId === organizationId;
  }

  async isOrgMember(organizationId: string, userId: string): Promise<boolean> {
    const membership = await this.rawPrisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    return !!membership;
  }

  // ───────── 내부 헬퍼 ─────────

  private async applyCounterShift(
    tx: TenantAuditTransaction,
    runId: string,
    previousResult: RunCaseResult,
    nextResult: RunCaseResult,
  ) {
    const prevField = COUNTER_FIELD_BY_RESULT[previousResult];
    const nextField = COUNTER_FIELD_BY_RESULT[nextResult];
    // 두 갱신을 각각 별도 { decrement/increment } 로 넘기면 같은 필드일 때
    // Prisma가 마지막 값(increment)으로 덮어써 decrement가 사라진다(예: PASS→PASS 재기록 시
    // total은 그대로인데 passedCount만 +1 되는 이중 증가 버그). 필드별 순증감을 delta로 먼저
    // 합산한 뒤 0이 아닌 필드만 반영해야 "같은 결과 재기록 = 무변화"가 보장된다.
    const delta: Partial<Record<CounterField, number>> = {};
    if (prevField) delta[prevField] = (delta[prevField] ?? 0) - 1;
    if (nextField) delta[nextField] = (delta[nextField] ?? 0) + 1;

    const data: Prisma.TestRunUpdateInput = {};
    for (const [field, value] of Object.entries(delta) as Array<
      [CounterField, number]
    >) {
      if (value === 0) continue;
      data[field] = value > 0 ? { increment: value } : { decrement: -value };
    }
    if (Object.keys(data).length === 0) {
      return tx.testRun.findUniqueOrThrow({ where: { id: runId } });
    }
    return tx.testRun.update({ where: { id: runId }, data });
  }

  /** 조직 밖 사용자를 배정에 끼워 넣는 것을 막는다(API.md 5장 "조직 밖 사용자 포함 시 404"). */
  private async assertAssigneesAreMembers(
    tx: TenantAuditTransaction,
    userIds: string[],
  ): Promise<void> {
    const uniqueIds = [...new Set(userIds)];
    const memberCount = await tx.membership.count({
      where: { userId: { in: uniqueIds } },
    });
    if (memberCount !== uniqueIds.length) {
      throw new DomainException(
        404,
        'NOT_FOUND',
        '조직에 속하지 않은 사용자가 포함되어 있습니다.',
      );
    }
  }

  private async loadAssigneesWithNames(
    tx: TenantAuditTransaction,
    runId: string,
  ) {
    const assignees = await tx.testRunAssignee.findMany({
      where: { testRunId: runId },
      include: { user: { select: { id: true, name: true } } },
    });
    return assignees.map((a) => ({ userId: a.user.id, name: a.user.name }));
  }

  /**
   * WS 이벤트 페이로드(recordedBy/changedBy)에 이름을 싣기 위한 조회.
   * access token엔 name이 없어(ARCHITECTURE.md 4장) 트랜잭션 밖에서 한 번 더 조회한다 —
   * DATA-MODEL.md 5장의 "3쿼리 고정" 트랜잭션 본문에는 포함하지 않는다.
   */
  private async nameOf(userId: string): Promise<string> {
    const user = await this.rawPrisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true },
    });
    return user.name;
  }

  private statusAuditAction(status: UpdateRunStatusDto['status']) {
    switch (status) {
      case 'IN_PROGRESS':
        return 'RUN_STARTED' as const;
      case 'COMPLETED':
        return 'RUN_COMPLETED' as const;
      case 'ABORTED':
        return 'RUN_ABORTED' as const;
    }
  }

  private toRunSummary(
    run: Prisma.TestRunGetPayload<{
      include: {
        assignees: { include: { user: { select: { id: true; name: true } } } };
      };
    }>,
  ) {
    return {
      id: run.id,
      name: run.name,
      description: run.description,
      status: run.status,
      ...computeCounters(run),
      assignees: run.assignees.map((a) => ({
        userId: a.user.id,
        name: a.user.name,
      })),
      createdAt: run.createdAt,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
    };
  }
}
