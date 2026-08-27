import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 7은 schema.prisma에 커넥션 URL을 두지 않는다 — 런타임 클라이언트는
 * @prisma/adapter-pg로 직접 커넥션을 구성한다(DATABASE_URL = Neon 풀러 주소).
 * C2에서 이 클래스 위에 $extends(tenantExtension)을 적용해 조직 스코프를 강제한다.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({ adapter: new PrismaPg(process.env.DATABASE_URL as string) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
