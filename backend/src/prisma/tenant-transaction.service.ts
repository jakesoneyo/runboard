// 도메인 트랜잭션 실행 지점을 한 곳으로 모은다. 여기서 발급하는 tx만 브랜드 타입을 가지므로
// AuditService.record()/recordGlobal()은 이 헬퍼(또는 TenantTransactionService.run)를 거치지 않고는
// 호출할 수 없다 — "감사로그는 도메인 트랜잭션 안에서만 기록한다"는 규칙을 타입으로 유도한다.
// (TS 구조적 타이핑 한계상 100% 강제는 아니다 — 브랜드를 만드는 경로를 이 파일 하나로 좁혀
// "직접 캐스팅하지 말 것"이라는 관례로 보강한다. 완전 강제가 필요해지면 eslint 커스텀 룰이 다음 단계.)
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { createTenantScopedClient } from './tenant.extension';

export const TENANT_PRISMA = Symbol('TENANT_PRISMA');

export type TenantPrismaClient = ReturnType<typeof createTenantScopedClient>;

declare const AUDIT_TX_BRAND: unique symbol;
type AuditBrand = { readonly [AUDIT_TX_BRAND]: true };

/** 조직 스코프 도메인 트랜잭션(TenantTransactionService.run)에서만 얻을 수 있는 타입. */
export type TenantAuditTransaction = Parameters<
  Parameters<TenantPrismaClient['$transaction']>[0]
>[0] &
  AuditBrand;

/** 조직 컨텍스트가 없는 전역 트랜잭션(runAuditableTransaction)에서만 얻을 수 있는 타입. */
export type RawAuditTransaction = Parameters<
  Parameters<PrismaService['$transaction']>[0]
>[0] &
  AuditBrand;

/** 조직 스코프 도메인 트랜잭션 실행기 — organizations/suites/cases/runs/bugs 서비스가 공통으로 쓴다. */
@Injectable()
export class TenantTransactionService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrismaClient,
  ) {}

  run<T>(fn: (tx: TenantAuditTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) =>
      fn(tx as unknown as TenantAuditTransaction),
    );
  }
}

/**
 * 조직 컨텍스트가 아직 없는 전역 이벤트(로그인 등)를 다루는 auth 모듈 전용 실행기.
 * 원본(비확장) PrismaService로 트랜잭션을 열고 같은 방식으로 브랜드를 붙여 AuditService.recordGlobal()에 넘긴다.
 */
export function runAuditableTransaction<T>(
  prisma: PrismaService,
  fn: (tx: RawAuditTransaction) => Promise<T>,
): Promise<T> {
  return prisma.$transaction((tx) => fn(tx as unknown as RawAuditTransaction));
}
