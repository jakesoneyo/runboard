import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** API.md 3장 PATCH /orgs/:orgId. */
export const updateOrganizationSchema = z.object({
  name: z.string().min(1, '조직 이름을 입력해주세요.').max(100),
});

export class UpdateOrganizationDto extends createZodDto(
  updateOrganizationSchema,
) {}
