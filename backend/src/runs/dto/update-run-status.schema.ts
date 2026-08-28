// API.md 5장 PATCH /orgs/:orgId/runs/:runId/status. PLANNED는 생성 시 기본값일 뿐 목표 상태로
// 다시 지정할 수 없다(전이 규칙: run-status-transition.ts).
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateRunStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'ABORTED']),
});

export class UpdateRunStatusDto extends createZodDto(updateRunStatusSchema) {}
