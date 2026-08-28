import { AuditAction, AuditTargetType } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** API.md 7장 GET /orgs/:orgId/audit-logs 쿼리(action/actorId/targetType/targetId/from/to + 커서). */
export const listAuditLogsSchema = z.object({
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).default(20),
  action: z.nativeEnum(AuditAction).optional(),
  actorId: z.string().uuid().optional(),
  targetType: z.nativeEnum(AuditTargetType).optional(),
  targetId: z.string().uuid().optional(),
  // z.coerce.date()는 nestjs-zod의 Swagger JSON Schema 변환기가 Date 타입을 표현하지 못해 실패한다
  // (zod-to-json-schema 한계) — ISO 문자열로 받고 audit-query.service.ts에서 Date로 변환한다.
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export class ListAuditLogsDto extends createZodDto(listAuditLogsSchema) {}
