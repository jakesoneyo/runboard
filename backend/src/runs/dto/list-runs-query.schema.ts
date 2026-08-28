// API.md 5장 GET /orgs/:orgId/runs 쿼리.
import { RunStatus } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const listRunsQuerySchema = z.object({
  status: z.nativeEnum(RunStatus).optional(),
  assignedToMe: z.coerce.boolean().optional(),
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).default(20),
});

export class ListRunsQueryDto extends createZodDto(listRunsQuerySchema) {}
