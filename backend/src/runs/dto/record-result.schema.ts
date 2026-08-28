// API.md 5장 PATCH /orgs/:orgId/runs/:runId/cases/:runCaseId.
import { RunCaseResult } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const recordResultSchema = z.object({
  result: z.nativeEnum(RunCaseResult),
  comment: z.string().max(2000).optional(),
});

export class RecordResultDto extends createZodDto(recordResultSchema) {}
