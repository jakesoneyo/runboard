// API.md 7장 — 대시보드. DATA-MODEL.md 5장 "총 3~4쿼리" 예산을 지키기 위해 TestRunCase를 다시
// 집계하지 않는다: TestRun에 이미 있는 비정규화 카운터(totalCount/passedCount/...)를 status별
// groupBy의 _sum으로 재사용하면 "진행 중/완료 실행 수"와 "결과 분포"를 같은 쿼리 한 번으로 얻는다.
import { Inject, Injectable } from '@nestjs/common';
import type { BugSeverity } from '@prisma/client';
import {
  TENANT_PRISMA,
  type TenantPrismaClient,
} from '../prisma/tenant-transaction.service';
import { computeCounters } from '../runs/lib/run-counters';
import type { PassRateTrendQueryDto } from './dto/pass-rate-trend-query.schema';

/** RESOLVED/WONTFIX는 "열린 버그"가 아니다 — API.md 7장 openBugs는 미해결 건만 센다. */
const OPEN_BUG_STATUSES = ['OPEN', 'IN_PROGRESS'] as const;

const RECENT_RUNS_TAKE = 5;

@Injectable()
export class DashboardService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrismaClient,
  ) {}

  /**
   * API.md 7장 GET .../dashboard/summary. 쿼리 4개 고정:
   * (1) TestRun status별 groupBy(카운트 + 카운터 합) (2) TestCase count
   * (3) BugReport severity별 groupBy(열린 상태만) (4) 최근 실행 findMany.
   */
  async summary() {
    const [statusGroups, casesTotal, openBugGroups, recentRuns] =
      await Promise.all([
        this.prisma.testRun.groupBy({
          by: ['status'],
          _count: { _all: true },
          _sum: {
            totalCount: true,
            passedCount: true,
            failedCount: true,
            blockedCount: true,
            skippedCount: true,
          },
        }),
        this.prisma.testCase.count(),
        this.prisma.bugReport.groupBy({
          by: ['severity'],
          _count: { _all: true },
          where: { status: { in: [...OPEN_BUG_STATUSES] } },
        }),
        // assignees를 include하면 관계 로딩 때문에 쿼리가 2~3개 더 늘어난다(Prisma가 has-many
        // 관계를 별도 배치 쿼리로 로딩). "최근 실행" 카드는 담당자 없이 카운터만 보여줘도 충분하므로
        // select로 스칼라 필드만 뽑아 findMany 1회로 끝낸다(쿼리 예산 4개 고정의 핵심).
        this.prisma.testRun.findMany({
          orderBy: { createdAt: 'desc' },
          take: RECENT_RUNS_TAKE,
          select: {
            id: true,
            name: true,
            status: true,
            totalCount: true,
            passedCount: true,
            failedCount: true,
            blockedCount: true,
            skippedCount: true,
            createdAt: true,
            startedAt: true,
            completedAt: true,
          },
        }),
      ]);

    let active = 0;
    let completed = 0;
    let total = 0;
    let passed = 0;
    let failed = 0;
    let blocked = 0;
    let skipped = 0;
    for (const group of statusGroups) {
      if (group.status === 'IN_PROGRESS') active = group._count._all;
      if (group.status === 'COMPLETED') completed = group._count._all;
      total += group._sum.totalCount ?? 0;
      passed += group._sum.passedCount ?? 0;
      failed += group._sum.failedCount ?? 0;
      blocked += group._sum.blockedCount ?? 0;
      skipped += group._sum.skippedCount ?? 0;
    }
    // PENDING 전용 카운터 컬럼이 없다(run-counters.ts와 동일한 설계) — total에서 나머지를 뺀 값으로 유도.
    const pending = Math.max(total - passed - failed - blocked - skipped, 0);

    const openBugs: Record<BugSeverity, number> = {
      MINOR: 0,
      MAJOR: 0,
      CRITICAL: 0,
    };
    for (const group of openBugGroups) {
      openBugs[group.severity] = group._count._all;
    }

    return {
      runs: { active, completed },
      cases: { total: casesTotal },
      resultDistribution: {
        PASS: passed,
        FAIL: failed,
        BLOCKED: blocked,
        SKIPPED: skipped,
        PENDING: pending,
      },
      openBugs,
      recentRuns: recentRuns.map((run) => ({
        id: run.id,
        name: run.name,
        status: run.status,
        ...computeCounters(run),
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
      })),
    };
  }

  /** API.md 7장 GET .../dashboard/pass-rate-trend — 카운터만 읽는다(재집계 쿼리 없음). */
  async passRateTrend(query: PassRateTrendQueryDto) {
    const runs = await this.prisma.testRun.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take: query.limit,
      select: {
        id: true,
        name: true,
        completedAt: true,
        totalCount: true,
        passedCount: true,
        failedCount: true,
        blockedCount: true,
        skippedCount: true,
      },
    });

    // 최신순으로 가져온 뒤 오래된→최신 순으로 뒤집는다 — 라인차트가 시간순으로 그려지도록.
    return runs
      .slice()
      .reverse()
      .map((run) => ({
        runId: run.id,
        name: run.name,
        completedAt: run.completedAt,
        passRate: computeCounters(run).passRate,
        total: run.totalCount,
      }));
  }
}
