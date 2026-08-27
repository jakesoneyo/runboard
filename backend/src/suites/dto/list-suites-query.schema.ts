import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** API.md 4장 GET /orgs/:orgId/suites?tree=true. 기본값 true(중첩 트리)가 유일하게 문서화된 형태다. */
export const listSuitesQuerySchema = z.object({
  tree: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export class ListSuitesQueryDto extends createZodDto(listSuitesQuerySchema) {}
