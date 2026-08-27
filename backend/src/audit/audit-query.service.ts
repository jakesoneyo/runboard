// 감사로그 조회 전용 서비스. AuditLog는 organizationId가 nullable이라 tenant.extension.ts의
// 화이트리스트에서 의도적으로 제외했다(audit.service.ts 상단 주석 참고) — 그래서 여기서만
// organizationId를 손으로 필터한다. 이 값은 사용자 입력이 아니라 OrgContextGuard가 검증한
// 경로 파라미터에서 오므로 "손으로 쓴 필터가 곧 취약점"인 다른 도메인 모델과는 성격이 다르다.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ListAuditLogsDto } from './dto/list-audit-logs.schema';

@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: ListAuditLogsDto) {
    const items = await this.prisma.auditLog.findMany({
      where: {
        organizationId,
        action: query.action,
        actorId: query.actorId,
        targetType: query.targetType,
        targetId: query.targetId,
      },
      orderBy: { createdAt: 'desc' },
      take: query.take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > query.take;
    const page = hasMore ? items.slice(0, query.take) : items;

    return {
      items: page.map((log) => ({
        id: log.id,
        action: log.action,
        actor: log.actorId ? { id: log.actorId, email: log.actorEmail } : null,
        targetType: log.targetType,
        targetId: log.targetId,
        metadata: log.metadata,
        ip: log.ip,
        createdAt: log.createdAt,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }
}
