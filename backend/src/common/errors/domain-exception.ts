import { HttpException } from '@nestjs/common';

/**
 * 도메인 규칙 위반을 API.md 공통 에러 포맷({statusCode, code, message, details})으로 표현하는 예외.
 * 컨트롤러/서비스는 항상 이 클래스(또는 Nest 내장 예외)만 던진다 — 포맷 통일은 AllExceptionsFilter가 책임진다.
 */
export class DomainException extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown = null,
  ) {
    super({ statusCode: status, code, message, details }, status);
  }
}
