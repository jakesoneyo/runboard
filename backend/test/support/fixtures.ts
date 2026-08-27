// 테스트 픽스처 헬퍼 — 여러 e2e 스펙이 "조직 A/B + 역할별 사용자" 구성을 반복해서 만들 때 쓴다.
import type { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { PrismaService } from '../../src/prisma/prisma.service';

export interface AuthedUser {
  userId: string;
  email: string;
  accessToken: string;
}

/** supertest의 `res.body`는 항상 `any`다 — 테스트 전용으로 원하는 모양을 단언할 때 이 헬퍼를 쓴다. */
export function typedBody<T>(res: request.Response): T {
  return res.body as T;
}

interface LoginResponseBody {
  user: { id: string };
  accessToken: string;
}

/**
 * `request(app)`가 반환하는 값은 verb 메서드(get/post/...)를 호출해야 비로소 `.set()`이 있는
 * `Test` 객체가 된다(agent 자체엔 없다) — 이 헬퍼로 "토큰을 미리 세팅한 호출자"를 표현한다.
 */
export function authedAgent(app: INestApplication<App>, accessToken: string) {
  const server = () => request(app.getHttpServer());
  const authHeader = `Bearer ${accessToken}`;
  return {
    get: (url: string) => server().get(url).set('Authorization', authHeader),
    post: (url: string) => server().post(url).set('Authorization', authHeader),
    patch: (url: string) =>
      server().patch(url).set('Authorization', authHeader),
    delete: (url: string) =>
      server().delete(url).set('Authorization', authHeader),
  };
}

/** 회원가입 후 로그인까지 마쳐 access token을 확보한다(실제 인증 절차 그대로 — 우회 없음). */
export async function registerAndLogin(
  app: INestApplication<App>,
  email: string,
  password = 'password123',
  name = '테스트 사용자',
): Promise<AuthedUser> {
  await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email, password, name });
  const login = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password });
  const body = typedBody<LoginResponseBody>(login);
  return {
    userId: body.user.id,
    email,
    accessToken: body.accessToken,
  };
}

/**
 * 조직 + 멤버십을 raw Prisma로 직접 심는다(시드 스크립트와 동일한 성격의 정당한 원본 클라이언트 사용 —
 * API를 거치지 않고 임의 역할의 멤버를 빠르게 준비하기 위한 테스트 전용 지름길).
 */
export async function seedOrganization(
  prisma: PrismaService,
  name: string,
): Promise<{ id: string; slug: string }> {
  return prisma.organization.create({
    data: {
      name,
      slug: `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    },
  });
}

export async function addMember(
  prisma: PrismaService,
  organizationId: string,
  userId: string,
  role: Role,
): Promise<void> {
  await prisma.membership.create({ data: { organizationId, userId, role } });
}

export const ROLES = [
  Role.VIEWER,
  Role.TESTER,
  Role.QA_LEAD,
  Role.ADMIN,
] as const;
