import { BadRequestException } from '@nestjs/common';
import { createZodValidationPipe } from 'nestjs-zod';
import type { ZodError } from 'zod';

/**
 * nestjs-zod 기본 예외는 {statusCode, message, errors}만 담는다.
 * API.md 공통 포맷({statusCode, code:'VALIDATION_FAILED', message, details})으로 바꿔주는 어댑터.
 */
export const ZodValidationPipe = createZodValidationPipe({
  createValidationException: (error: unknown) => {
    const issues =
      error && typeof error === 'object' && 'issues' in error
        ? (error as ZodError).issues
        : [];
    return new BadRequestException({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: '입력값이 올바르지 않습니다.',
      details: issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  },
});
