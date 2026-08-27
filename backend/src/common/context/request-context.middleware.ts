// 모든 요청의 진입점에서 AsyncLocalStorage 컨텍스트를 연다(app.module.ts에서 '*'에 전역 적용).
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    // req.headers 인덱스 접근이 이 환경의 타입 해석상 any로 잡혀 명시적으로 단언해준다.
    const userAgentHeader = req.headers['user-agent'] as
      string | string[] | undefined;
    const userAgent = Array.isArray(userAgentHeader)
      ? userAgentHeader[0]
      : userAgentHeader;
    runWithRequestContext({ ip: req.ip, userAgent }, () => next());
  }
}
