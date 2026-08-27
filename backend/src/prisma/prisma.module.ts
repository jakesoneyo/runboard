import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  TENANT_PRISMA,
  TenantTransactionService,
} from './tenant-transaction.service';
import { createTenantScopedClient } from './tenant.extension';

/**
 * 전역 모듈. PrismaService(원본, "$system" 역할 — auth/시드 전용)와 TENANT_PRISMA(조직 스코프
 * 자동 주입이 적용된 확장 클라이언트, 도메인 모듈 전용)를 둘 다 제공한다.
 */
@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: TENANT_PRISMA,
      useFactory: (prisma: PrismaService) => createTenantScopedClient(prisma),
      inject: [PrismaService],
    },
    TenantTransactionService,
  ],
  exports: [PrismaService, TENANT_PRISMA, TenantTransactionService],
})
export class PrismaModule {}
