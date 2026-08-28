import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BugsModule } from './bugs/bugs.module';
import { CasesModule } from './cases/cases.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health/health.controller';
import { OrganizationsModule } from './organizations/organizations.module';
import { PrismaModule } from './prisma/prisma.module';
import { RunsModule } from './runs/runs.module';
import { SuitesModule } from './suites/suites.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        // requestId를 헤더로 받아 전파하고, 없으면 새로 발급한다(ARCHITECTURE.md 7장 로깅 규약).
        genReqId: (req, res) => {
          const existing = req.headers['x-request-id'];
          const id =
            (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        redact: ['req.headers.authorization'],
        autoLogging: process.env.NODE_ENV !== 'test',
        // 테스트에서는 pretty transport의 워커 스레드가 Jest 프로세스 종료를 지연시킬 수 있어 끈다.
        transport:
          process.env.NODE_ENV === 'production' ||
          process.env.NODE_ENV === 'test'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
      },
    }),
    PrismaModule,
    AuthModule,
    AuditModule,
    OrganizationsModule,
    SuitesModule,
    CasesModule,
    RunsModule,
    BugsModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 모든 요청이 ALS 컨텍스트 안에서 처리되도록 가장 먼저 적용한다(가드보다 먼저 실행돼야 한다).
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
