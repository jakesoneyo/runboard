import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** API.md 4장 POST /orgs/:orgId/suites. 4단계 이상/순환은 서비스 계층에서 검증(suite-tree-rules.ts). */
export const createSuiteSchema = z.object({
  name: z.string().min(1, '스위트 이름을 입력해주세요.').max(200),
  description: z.string().max(2000).optional(),
  parentId: z.string().uuid().optional(),
  position: z.number().int().min(0).optional(),
});

export class CreateSuiteDto extends createZodDto(createSuiteSchema) {}
