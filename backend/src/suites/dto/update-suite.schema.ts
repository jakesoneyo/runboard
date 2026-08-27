import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * API.md 4장 PATCH /orgs/:orgId/suites/:suiteId. 부분 수정.
 * parentId는 명시적으로 `null`을 보내면 "최상위로 이동"을 뜻한다(생략이면 변경 없음).
 */
export const updateSuiteSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export class UpdateSuiteDto extends createZodDto(updateSuiteSchema) {}
