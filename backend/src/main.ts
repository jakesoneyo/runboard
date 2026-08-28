import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';

/**
 * 부트스트랩: Pino 로거 교체 → 전역 prefix(/api, health 제외 — Render healthCheckPath와 일치) →
 * Zod 검증 파이프 → socket.io 어댑터(RunsGateway) → Swagger(/api/docs).
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.useGlobalPipes(new ZodValidationPipe());
  // Nest 기본 WS 어댑터는 ws 기반이다 — socket.io 게이트웨이(RunsGateway)를 쓰려면 명시적으로 교체해야 한다.
  app.useWebSocketAdapter(new IoAdapter(app));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Runboard API')
    .setDescription(
      'QA 테스트 실행 트래커 — 인증/조직/스위트/케이스/실행/버그/대시보드',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  app.enableCors({ origin: process.env.CORS_ORIGINS?.split(',') ?? true });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
