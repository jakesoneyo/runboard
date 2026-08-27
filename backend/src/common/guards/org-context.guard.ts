// ARCHITECTURE.md 3장 "계층 1 — 라우팅 + OrgContextGuard". JwtAuthGuard 다음, RolesGuard보다 먼저 실행돼야 한다.
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { updateRequestContext } from '../context/request-context';
import { DomainException } from '../errors/domain-exception';
import { PrismaService } from '../../prisma/prisma.service';

/** JwtStrategy.validate()가 채운 req.user 형태(순환 import 방지를 위해 여기서 최소 형태만 선언). */
interface RequestWithUser extends Request {
  user?: { id: string; email: string };
}

@Injectable()
export class OrgContextGuard implements CanActivate {
  // 원본(비확장) PrismaService로 조회한다 — 여기서 바로 "조직 컨텍스트를 확정"하는 중이라
  // 아직 ALS에 organizationId가 없고, 확장 클라이언트로는 이 조회 자체가 TENANT_CONTEXT_MISSING이 난다.
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    // Express 5 타입상 params 값은 string | string[]일 수 있으나(정규식 라우트), 우리 라우트는
    // 항상 단일 :orgId 세그먼트라 배열이 오면 이미 라우팅 설계에 문제가 있다는 뜻이다.
    const rawOrgId = request.params.orgId;
    const organizationId = Array.isArray(rawOrgId) ? rawOrgId[0] : rawOrgId;
    const userId = request.user?.id;

    if (!organizationId || !userId) {
      // 라우트 설계 실수(:orgId 없는 곳에 이 가드를 붙였거나 JwtAuthGuard보다 앞에 둠) — 즉시 드러낸다.
      throw new Error(
        'OrgContextGuard는 인증된 사용자 + :orgId 경로 파라미터가 있는 라우트에서만 사용한다.',
      );
    }

    // 남의 조직 id의 존재 여부를 노출하지 않기 위해 403이 아니라 404(ARCHITECTURE.md 3장, API.md 1장).
    // 형식이 잘못된 orgId(비UUID)도 Prisma 검증 오류 대신 동일하게 404로 수렴시킨다.
    const membership = await this.prisma.membership
      .findUnique({
        where: { userId_organizationId: { userId, organizationId } },
      })
      .catch(() => null);

    if (!membership) {
      throw new DomainException(404, 'NOT_FOUND', '조직을 찾을 수 없습니다.');
    }

    updateRequestContext({ organizationId, role: membership.role });
    return true;
  }
}
