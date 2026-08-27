// ARCHITECTURE.md 6장 "감사로그 저장 방식" 구현. 도메인 서비스가 자기 트랜잭션 안에서 호출한다.
import { Injectable } from '@nestjs/common';
import type { AuditAction, AuditTargetType, Prisma } from '@prisma/client';
import { getRequestContext } from '../common/context/request-context';
import type {
  RawAuditTransaction,
  TenantAuditTransaction,
} from '../prisma/tenant-transaction.service';

export interface RecordScopedParams {
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string;
  /** diffFields()로 만든 변경분만 — 민감정보 전체 덤프 금지. */
  metadata?: Record<string, unknown>;
}

export interface RecordGlobalParams {
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string;
  /** 로그인처럼 ALS에 아직 userId가 없는 시점을 위해 명시적으로 받는다(호출부가 이미 조회해둔 값). */
  actorId?: string | null;
  actorEmail?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  /**
   * 조직 스코프 이벤트 기록. tx는 TenantTransactionService.run()에서만 얻을 수 있는 브랜드 타입이라,
   * "도메인 트랜잭션 밖에서 감사로그를 남긴다" 같은 실수가 타입 레벨에서부터 막힌다.
   * actorId/actorEmail/organizationId/ip/userAgent는 전부 ALS 컨텍스트에서 자동 채운다 — 호출부는
   * 도메인 정보(action/targetType/targetId/metadata)만 신경 쓰면 된다.
   * @throws Error organizationId 없이 호출된 경우(프로그래밍 오류 — 전역 이벤트는 recordGlobal 사용)
   */
  async record(
    tx: TenantAuditTransaction,
    params: RecordScopedParams,
  ): Promise<void> {
    const ctx = getRequestContext();
    if (!ctx?.organizationId) {
      throw new Error(
        'AuditService.record()는 조직 컨텍스트가 있을 때만 호출한다. 전역 이벤트는 recordGlobal()을 쓰세요.',
      );
    }
    await tx.auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        actorId: ctx.userId ?? null,
        actorEmail: ctx.actorEmail ?? null,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId ?? null,
        // Record<string, unknown>은 항상 JSON 직렬화 가능한 값만 담기로 한 내부 계약(diffFields 참고)이라
        // Prisma의 정밀한 Json 유니온 타입과는 캐스팅으로만 이어준다.
        metadata: (params.metadata ?? undefined) as
          Prisma.InputJsonValue | undefined,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      },
    });
  }

  /**
   * 조직 미상 전역 이벤트(로그인 성공/실패, refresh 재사용 탐지) 기록. organizationId는 항상 null —
   * DATA-MODEL.md/C2 결정: 이 필드를 nullable로 바꾼 이유가 바로 이 케이스다.
   */
  async recordGlobal(
    tx: RawAuditTransaction,
    params: RecordGlobalParams,
  ): Promise<void> {
    const ctx = getRequestContext();
    await tx.auditLog.create({
      data: {
        organizationId: null,
        actorId: params.actorId ?? null,
        actorEmail: params.actorEmail ?? null,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId ?? null,
        metadata: (params.metadata ?? undefined) as
          Prisma.InputJsonValue | undefined,
        ip: ctx?.ip ?? null,
        userAgent: ctx?.userAgent ?? null,
      },
    });
  }
}
