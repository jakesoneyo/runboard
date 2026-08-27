// 요청 하나의 수명 동안 공유되는 컨텍스트. Node 내장 AsyncLocalStorage만 쓴다(새 의존성 없음).
// ARCHITECTURE.md 3장: 이 컨텍스트가 Prisma tenant.extension.ts의 조직 스코프 자동 주입 근거가 된다.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Role } from '@prisma/client';

/**
 * request-context.middleware.ts가 요청 진입 시 {ip, userAgent}만 채운 상태로 store를 만든다.
 * JwtAuthGuard가 userId/actorEmail을, OrgContextGuard가 organizationId/role을 이어서 채운다.
 * store는 참조로 공유되므로 이후 어디서 읽어도(Prisma 확장 포함) 최신 값이 보인다.
 */
export interface RequestContextStore {
  userId?: string;
  actorEmail?: string;
  organizationId?: string;
  role?: Role;
  ip?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

/** 요청 진입점(미들웨어)에서만 호출한다. 이 콜백에서 파생된 모든 async 체인이 같은 store를 공유한다. */
export function runWithRequestContext<T>(
  initial: RequestContextStore,
  fn: () => T,
): T {
  return storage.run(initial, fn);
}

/** 현재 요청 컨텍스트를 읽는다. 미들웨어 밖(스크립트/시드/유닛테스트)에서는 undefined. */
export function getRequestContext(): RequestContextStore | undefined {
  return storage.getStore();
}

/**
 * 가드/서비스가 인증·조직 확정 결과를 같은 store 객체에 얹는다.
 * 미들웨어 밖에서 호출되면(=store 자체가 없으면) 조용히 무시한다 — 그 경우 애초에 반영할 대상이 없다.
 */
export function updateRequestContext(
  patch: Partial<RequestContextStore>,
): void {
  const store = storage.getStore();
  if (!store) return;
  Object.assign(store, patch);
}
