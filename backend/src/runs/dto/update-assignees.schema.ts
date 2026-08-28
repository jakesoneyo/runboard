// API.md 5장 PUT /orgs/:orgId/runs/:runId/assignees — 전체 치환.
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateAssigneesSchema = z.object({
  userIds: z.array(z.string().uuid()),
});

export class UpdateAssigneesDto extends createZodDto(updateAssigneesSchema) {}
