import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** API.md 3장 POST /invitations/accept. */
export const acceptInvitationSchema = z.object({
  token: z.string().min(1, '초대 토큰이 필요합니다.'),
});

export class AcceptInvitationDto extends createZodDto(acceptInvitationSchema) {}
