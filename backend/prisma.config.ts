// Prisma 7 CLI 설정 — schema.prisma는 더 이상 datasource url을 갖지 않는다(migrate/introspect 전용 설정을 여기로 분리).
// 런타임 PrismaClient는 @prisma/adapter-pg로 별도 연결한다(src/prisma/prisma.service.ts).
import 'dotenv/config'; // Prisma 7 CLI는 .env를 자동 로드하지 않는다 — 평가 전에 직접 로드
import { defineConfig } from 'prisma/config';

// prisma/config의 env()는 변수가 없으면 즉시 throw한다 — `prisma generate`(Docker 빌드 단계 등
// DB 자격증명이 아직 없는 시점)까지 실패하게 만들므로, 여기서는 일부러 process.env를 직접 읽는다.
// migrate/introspect처럼 실제로 DIRECT_URL이 필요한 명령은 그 시점에 각자 명확한 에러를 낸다.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DIRECT_URL, // migrate/introspect는 항상 직결 커넥션 사용
  },
});
