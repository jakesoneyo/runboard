import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { getRequestContext } from '../context/request-context';
import { DomainException } from '../errors/domain-exception';
import { REQUIRE_ROLE_KEY } from '../decorators/require-role.decorator';

/** ADMIN > QA_LEAD > TESTER > VIEWER — API.md 1장 "N+ " 표기의 등급 순서. */
const ROLE_RANK: Record<Role, number> = {
  [Role.VIEWER]: 0,
  [Role.TESTER]: 1,
  [Role.QA_LEAD]: 2,
  [Role.ADMIN]: 3,
};

/**
 * OrgContextGuard 다음에 실행된다. @RequireRole()이 없으면 "조직 멤버"(OrgContextGuard 통과)만으로 충분하다.
 * 역할은 매 요청 Membership 조회 결과(ALS)에서만 읽는다 — access token에는 role이 없으므로
 * 역할 강등/제거가 토큰 만료를 기다리지 않고 다음 요청부터 즉시 반영된다(T-12, ARCHITECTURE.md 3장).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role | undefined>(
      REQUIRE_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const role = getRequestContext()?.role;
    if (!role || ROLE_RANK[role] < ROLE_RANK[required]) {
      throw new DomainException(
        403,
        'ORG_FORBIDDEN',
        '이 작업을 수행할 권한이 없습니다.',
      );
    }
    return true;
  }
}
