// API.md 5장 GET /orgs/:orgId/runs/:runId/cases 쿼리.
import { RunCaseResult } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const listRunCasesQuerySchema = z.object({
  result: z.nativeEnum(RunCaseResult).optional(),
});

export class ListRunCasesQueryDto extends createZodDto(
  listRunCasesQuerySchema,
) {}
