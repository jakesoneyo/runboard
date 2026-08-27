import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** API.md 3장 POST /orgs. slug 미지정 시 서버가 name에서 생성한다(lib/slugify.ts). */
export const createOrganizationSchema = z.object({
  name: z.string().min(1, '조직 이름을 입력해주세요.').max(100),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'slug는 소문자/숫자/하이픈만 사용할 수 있습니다.')
    .optional(),
});

export class CreateOrganizationDto extends createZodDto(
  createOrganizationSchema,
) {}
