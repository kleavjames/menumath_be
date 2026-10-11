import type { MemberRole } from '../../generated/prisma/client.js';

export class GenerateInvitationDto {
  businessId: string;
  role: MemberRole;
  expiresInDays?: number;
}
