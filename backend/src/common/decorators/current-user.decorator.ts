import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** JwtStrategy.validate()가 반환한 값(req.user)을 컨트롤러 파라미터로 꺼낸다. */
export interface AuthenticatedUser {
  id: string;
  email: string;
}

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
