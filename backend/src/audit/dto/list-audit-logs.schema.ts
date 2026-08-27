import { AuditAction, AuditTargetType } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** API.md 7장 GET /orgs/:orgId/audit-logs 쿼리. 필터는 이번 청크에서 핵심만(action/actorId/targetType/targetId). */
export const listAuditLogsSchema = z.object({
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).default(20),
  action: z.nativeEnum(AuditAction).optional(),
  actorId: z.string().uuid().optional(),
  targetType: z.nativeEnum(AuditTargetType).optional(),
  targetId: z.string().uuid().optional(),
});

export class ListAuditLogsDto extends createZodDto(listAuditLogsSchema) {}
