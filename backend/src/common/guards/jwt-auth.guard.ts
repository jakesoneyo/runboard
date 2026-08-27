import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { updateRequestContext } from '../context/request-context';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * 전역 가드로 등록된다(main.ts/app.module.ts). @Public()이 없는 모든 라우트는
 * Authorization: Bearer 액세스 토큰을 요구한다. 조직 스코프 인가는 C2의 OrgContextGuard가 이어받는다.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const activated = (await super.canActivate(context)) as boolean;
    if (activated) {
      // AuditService가 매번 User를 다시 조회하지 않도록, "누가"를 요청 시작 시점에 컨텍스트에 스냅샷해둔다.
      const request = context
        .switchToHttp()
        .getRequest<{ user?: AuthenticatedUser }>();
      if (request.user) {
        updateRequestContext({
          userId: request.user.id,
          actorEmail: request.user.email,
        });
      }
    }
    return activated;
  }
}
