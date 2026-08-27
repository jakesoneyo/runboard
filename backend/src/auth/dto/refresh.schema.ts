import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken이 필요합니다.'),
});

export class RefreshDto extends createZodDto(refreshSchema) {}
