import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/** `$on('query', ...)`가 타입 레벨에서 열리도록 로그 이벤트 구성을 고정한다(리스너가 없으면 비용 없음). */
type PrismaLogOptions = {
  adapter: PrismaPg;
  log: [{ emit: 'event'; level: 'query' }];
};

/**
 * Prisma 7은 schema.prisma에 커넥션 URL을 두지 않는다 — 런타임 클라이언트는
 * @prisma/adapter-pg로 직접 커넥션을 구성한다(DATABASE_URL = Neon 풀러 주소).
 * C2에서 이 클래스 위에 $extends(tenantExtension)을 적용해 조직 스코프를 강제한다.
 * `query` 이벤트는 $extends로 감싼 클라이언트를 거쳐도 같은 엔진에서 발생하므로,
 * N+1 회귀 테스트가 `this.$on('query', ...)`로 실제 SQL 왕복 수를 셀 수 있다(test/support/query-counter.ts).
 */
@Injectable()
export class PrismaService
  extends PrismaClient<PrismaLogOptions>
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg(process.env.DATABASE_URL as string),
      log: [{ emit: 'event', level: 'query' }],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
