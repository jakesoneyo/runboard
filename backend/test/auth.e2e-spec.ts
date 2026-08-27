import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';

/** API.md 1장 공통 에러 포맷 — supertest의 res.body는 any이므로 단언용 타입만 둔다. */
interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details: unknown;
}

/** API.md 2장 register/login 응답 형태. */
interface TokenPairBody {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string };
  memberships?: unknown[];
}

const errorBody = (res: request.Response) => res.body as ErrorBody;
const tokenBody = (res: request.Response) => res.body as TokenPairBody;

/**
 * 실제 Postgres 컨테이너(Testcontainers) 위에서 회원가입→로그인→refresh 회전→재사용 탐지를
 * 엔드투엔드로 검증한다. C2부터는 이 컨테이너 부트스트랩을 여러 스펙이 공유하는 형태로 정리한다.
 */
describe('Auth (e2e)', () => {
  jest.setTimeout(120_000);

  let container: StartedPostgreSqlContainer;
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('runboard_test')
      .withUsername('runboard')
      .withPassword('runboard')
      .start();
    const connectionUri = container.getConnectionUri();

    process.env.DATABASE_URL = connectionUri;
    process.env.DIRECT_URL = connectionUri;
    process.env.JWT_SECRET ??= 'test-secret';

    // 스키마 적용: 실제 배포 경로(prisma migrate deploy)와 동일한 방식으로 검증한다.
    execSync('npx prisma migrate deploy', {
      cwd: path.resolve(__dirname, '..'),
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

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();

    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  const api = () => request(app.getHttpServer());

  describe('회원가입/로그인', () => {
    it('실이메일 회원가입은 201과 토큰 쌍을 반환한다', async () => {
      const res = await api().post('/api/auth/register').send({
        email: 'member@example.com',
        password: 'password123',
        name: '멤버',
      });
      expect(res.status).toBe(201);
      const body = tokenBody(res);
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.refreshToken).toEqual(expect.any(String));
      expect(body.user.email).toBe('member@example.com');
    });

    it('비이메일 문자열로 회원가입하면 400 VALIDATION_FAILED', async () => {
      const res = await api().post('/api/auth/register').send({
        email: 'not-an-email',
        password: 'password123',
        name: '멤버',
      });
      expect(res.status).toBe(400);
      expect(errorBody(res).code).toBe('VALIDATION_FAILED');
    });

    it('틀린 비밀번호는 401 AUTH_INVALID_CREDENTIALS', async () => {
      const res = await api()
        .post('/api/auth/login')
        .send({ email: 'member@example.com', password: 'wrong-password' });
      expect(res.status).toBe(401);
      expect(errorBody(res).code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('올바른 자격증명은 200과 memberships[]를 반환한다', async () => {
      const res = await api()
        .post('/api/auth/login')
        .send({ email: 'member@example.com', password: 'password123' });
      expect(res.status).toBe(200);
      expect(tokenBody(res).memberships).toEqual([]);
    });
  });

  describe('/auth/me', () => {
    it('토큰 없이 호출하면 401', async () => {
      const res = await api().get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('유효한 access token으로 호출하면 본인 정보를 반환한다', async () => {
      const login = await api()
        .post('/api/auth/login')
        .send({ email: 'member@example.com', password: 'password123' });
      const res = await api()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenBody(login).accessToken}`);
      expect(res.status).toBe(200);
      expect(tokenBody(res).user.email).toBe('member@example.com');
    });
  });

  describe('refresh 회전과 재사용 탐지', () => {
    it('회전 → 구 토큰 재사용 → 401 + 같은 계열 전체 폐기', async () => {
      const login = await api()
        .post('/api/auth/login')
        .send({ email: 'member@example.com', password: 'password123' });
      const originalRefreshToken = tokenBody(login).refreshToken;

      const rotated = await api()
        .post('/api/auth/refresh')
        .send({ refreshToken: originalRefreshToken });
      expect(rotated.status).toBe(200);
      const rotatedRefreshToken = tokenBody(rotated).refreshToken;
      expect(rotatedRefreshToken).not.toBe(originalRefreshToken);

      // 구 토큰 재사용 = 탈취 의심 신호 → 거부 + 계열 전체 폐기
      const reuse = await api()
        .post('/api/auth/refresh')
        .send({ refreshToken: originalRefreshToken });
      expect(reuse.status).toBe(401);
      expect(errorBody(reuse).code).toBe('AUTH_REFRESH_REUSE');

      // 계열 전체 폐기 증명: 방금 정상 발급된 rotatedRefreshToken도 더 이상 쓸 수 없어야 한다
      const afterFamilyRevoke = await api()
        .post('/api/auth/refresh')
        .send({ refreshToken: rotatedRefreshToken });
      expect(afterFamilyRevoke.status).toBe(401);
      expect(errorBody(afterFamilyRevoke).code).toBe('AUTH_REFRESH_REUSE');
    });
  });

  describe('logout', () => {
    it('로그아웃한 refreshToken은 이후 refresh에 쓸 수 없다', async () => {
      const login = await api()
        .post('/api/auth/login')
        .send({ email: 'member@example.com', password: 'password123' });
      const loginBody = tokenBody(login);

      const logoutRes = await api()
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${loginBody.accessToken}`)
        .send({ refreshToken: loginBody.refreshToken });
      expect(logoutRes.status).toBe(204);

      const afterLogout = await api()
        .post('/api/auth/refresh')
        .send({ refreshToken: loginBody.refreshToken });
      expect(afterLogout.status).toBe(401);
    });
  });

  describe("데모 계정 'admin' 리터럴 우회 (CLAUDE.md 데모 계정 규정)", () => {
    beforeAll(async () => {
      // 데모 admin은 register 엔드포인트가 아니라 시드 스크립트가 만드는 계정이다(register는 항상 실이메일만 허용).
      await prisma.user.create({
        data: {
          email: 'admin',
          passwordHash: await bcrypt.hash('admin', 4),
          name: '관리자',
        },
      });
    });

    it("email==='admin' + 올바른 비밀번호 → 200 (형식 검증만 우회, bcrypt 비교는 정상 수행)", async () => {
      const res = await api()
        .post('/api/auth/login')
        .send({ email: 'admin', password: 'admin' });
      expect(res.status).toBe(200);
    });

    it('admin 계정도 틀린 비밀번호면 401 (비밀번호 검증 우회 없음)', async () => {
      const res = await api()
        .post('/api/auth/login')
        .send({ email: 'admin', password: 'wrong' });
      expect(res.status).toBe(401);
    });

    it("'admin'이 아닌 비이메일 문자열은 여전히 400", async () => {
      const res = await api()
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'whatever' });
      expect(res.status).toBe(400);
      expect(errorBody(res).code).toBe('VALIDATION_FAILED');
    });
  });
});
