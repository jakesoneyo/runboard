import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { Logger } from 'nestjs-pino';

/** API.md 1장 공통 에러 포맷. */
interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details: unknown;
}

/** 상태코드만 알고 도메인 code가 없는 예외(Nest 내장 등)에 붙일 기본 코드. */
const DEFAULT_CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
};

/**
 * 모든 예외를 API.md 공통 포맷 하나로 수렴시킨다.
 * 도메인 코드는 DomainException(또는 code 필드를 실은 HttpException)이 지정한 값을 그대로 쓰고,
 * 없으면 상태코드 기반 기본값으로 채운다. 처리 못한 예외는 500 + 내부 로그로만 상세를 남긴다.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.normalize(exception);

    if (status >= 500) {
      this.logger.error({ err: exception }, '처리되지 않은 예외');
    }

    response.status(status).json(body);
  }

  private normalize(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const asRecord = res as Record<string, unknown>;
        return {
          status,
          body: {
            statusCode: status,
            code:
              typeof asRecord.code === 'string'
                ? asRecord.code
                : (DEFAULT_CODE_BY_STATUS[status] ?? 'ERROR'),
            message:
              typeof asRecord.message === 'string'
                ? asRecord.message
                : exception.message,
            details: asRecord.details ?? null,
          },
        };
      }
      return {
        status,
        body: {
          statusCode: status,
          code: DEFAULT_CODE_BY_STATUS[status] ?? 'ERROR',
          message: typeof res === 'string' ? res : exception.message,
          details: null,
        },
      };
    }

    // 유니크 제약 위반 등은 클라이언트 재시도로 이어질 수 있는 409로 취급한다(예: register 경합).
    if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2002'
    ) {
      return {
        status: HttpStatus.CONFLICT,
        body: {
          statusCode: HttpStatus.CONFLICT,
          code: 'CONFLICT',
          message: '이미 존재하는 값입니다.',
          details: null,
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message: '서버 오류가 발생했습니다.',
        details: null,
      },
    };
  }
}
