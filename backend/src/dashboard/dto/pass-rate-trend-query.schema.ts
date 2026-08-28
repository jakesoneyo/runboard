import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** API.md 7장 GET /orgs/:orgId/dashboard/pass-rate-trend?limit=10 */
export const passRateTrendQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export class PassRateTrendQueryDto extends createZodDto(
  passRateTrendQuerySchema,
) {}
