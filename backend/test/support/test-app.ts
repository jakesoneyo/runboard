// e2e 스펙 여러 개가 Testcontainers Postgres + Nest 앱 부트스트랩을 공유하기 위한 헬퍼(ponytail: 중복 제거).
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { ZodValidationPipe } from '../../src/common/pipes/zod-validation.pipe';
import { PrismaService } from '../../src/prisma/prisma.service';

export interface TestApp {
  app: INestApplication<App>;
  prisma: PrismaService;
  container: StartedPostgreSqlContainer;
  /** tenant.extension.ts 등 DI 토큰을 직접 꺼내 검증해야 하는 스펙(tenant-extension.e2e-spec.ts)용. */
  moduleRef: TestingModule;
  /** RunsGateway 소켓 e2e가 실제 포트에 io()로 접속해야 해서 필요하다(supertest는 포트 없이도 동작하지만 소켓은 아니다). */
  url: string;
}

/**
 * 실제 Postgres 컨테이너를 띄우고 배포와 동일한 `prisma migrate deploy`로 스키마를 적용한 뒤
 * AppModule 전체를 부트스트랩한다. 스펙 파일마다 독립된 컨테이너를 갖는다(격리 우선, 속도보다).
 */
export async function bootstrapTestApp(): Promise<TestApp> {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('runboard_test')
    .withUsername('runboard')
    .withPassword('runboard')
    .start();
  const connectionUri = container.getConnectionUri();

  process.env.DATABASE_URL = connectionUri;
  process.env.DIRECT_URL = connectionUri;
  process.env.JWT_SECRET ??= 'test-secret';

  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '../..'),
    env: {
      ...process.env,
      DATABASE_URL: connectionUri,
      DIRECT_URL: connectionUri,
    },
    stdio: 'pipe',
  });

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.useGlobalPipes(new ZodValidationPipe());
  app.useWebSocketAdapter(new IoAdapter(app));
  // socket.io-client가 실제 TCP 포트로 접속해야 하므로 init()이 아니라 listen(0)(임의 포트)을 쓴다.
  // supertest는 이후에도 app.getHttpServer()로 동일하게 동작한다(listen 여부와 무관).
  await app.listen(0);

  const prisma = moduleRef.get(PrismaService);
  const url = await app.getUrl();
  return { app, prisma, container, moduleRef, url };
}

export async function teardownTestApp(ctx: TestApp): Promise<void> {
  await ctx.app.close();
  await ctx.container.stop();
}
