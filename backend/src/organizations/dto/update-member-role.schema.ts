import { Role } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** API.md 3장 PATCH /orgs/:orgId/members/:userId. */
export const updateMemberRoleSchema = z.object({
  role: z.nativeEnum(Role),
});

export class UpdateMemberRoleDto extends createZodDto(updateMemberRoleSchema) {}
