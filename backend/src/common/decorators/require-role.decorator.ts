import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

/** RolesGuard가 읽는 메타데이터 키. */
export const REQUIRE_ROLE_KEY = 'requireRole';

/**
 * 핸들러가 요구하는 최소 역할을 표시한다(API.md "VIEWER+ / TESTER+ / QA_LEAD+ / ADMIN" 표기와 대응).
 * 미지정 시 RolesGuard는 OrgContextGuard가 이미 확인한 "조직 멤버"(MEMBER 등급)만 요구한다.
 */
export const RequireRole = (role: Role) => SetMetadata(REQUIRE_ROLE_KEY, role);
