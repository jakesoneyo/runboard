// PLAN.md C4 — 결과 기록 엔드포인트 전용 인가. RolesGuard(@RequireRole(TESTER))가 먼저 VIEWER를
// 걸러내고, 이 가드는 그 위에서 "TESTER는 배정된 실행만, QA_LEAD+는 배정 무관"을 판정한다.
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { getRequestContext } from '../context/request-context';
import { DomainException } from '../errors/domain-exception';
import {
  TENANT_PRISMA,
  type TenantPrismaClient,
} from '../../prisma/tenant-transaction.service';
import { ROLE_RANK } from './roles.guard';

@Injectable()
export class RunAssignmentGuard implements CanActivate {
  // OrgContextGuard가 먼저 실행돼 ALS에 organizationId를 채워둔 뒤이므로 TENANT_PRISMA를 안전하게 쓸 수 있다.
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrismaClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = getRequestContext();
    if (ctx?.role && ROLE_RANK[ctx.role] >= ROLE_RANK[Role.QA_LEAD]) {
      return true; // QA_LEAD 이상은 배정 여부와 무관하게 기록 가능(API.md 5장).
    }

    const request = context.switchToHttp().getRequest<Request>();
    const rawRunId = request.params.runId;
    const runId = Array.isArray(rawRunId) ? rawRunId[0] : rawRunId;
    const userId = ctx?.userId;
    if (!runId || !userId) {
      throw new Error(
        'RunAssignmentGuard는 :runId 경로 파라미터가 있는 라우트에서만 사용한다.',
      );
    }

    const assignment = await this.prisma.testRunAssignee.findUnique({
      where: { testRunId_userId: { testRunId: runId, userId } },
    });
    if (!assignment) {
      throw new DomainException(
        403,
        'RUN_NOT_ASSIGNED',
        '이 실행에 배정되지 않았습니다.',
      );
    }
    return true;
  }
}
