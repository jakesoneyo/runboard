import { BugSeverity, BugStatus } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** API.md 6장 GET /orgs/:orgId/bugs 쿼리. */
export const listBugsQuerySchema = z.object({
  status: z.nativeEnum(BugStatus).optional(),
  severity: z.nativeEnum(BugSeverity).optional(),
  testRunId: z.string().uuid().optional(),
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).default(20),
});

export class ListBugsQueryDto extends createZodDto(listBugsQuerySchema) {}
