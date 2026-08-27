import { Role } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** API.md 3장 POST /orgs/:orgId/invitations. 초대는 항상 실이메일(admin 우회 없음 — 로그인 스키마만의 예외). */
export const createInvitationSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다.'),
  role: z.nativeEnum(Role),
});

export class CreateInvitationDto extends createZodDto(createInvitationSchema) {}
