import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AuthService } from '../auth/auth.service.js';
import type { AuthUser } from '../auth/types/auth-user.js';
import { hashPassword } from '../common/password.js';
import {
  MemberRole,
  type Business,
  type InvitationCode,
  type User,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { GenerateInvitationDto } from './dto/generate-invitation.dto.js';

const INVITABLE_ROLES: readonly MemberRole[] = [
  MemberRole.MANAGER,
  MemberRole.STAFF,
];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const DEFAULT_EXPIRY_DAYS = 7;
const MAX_EXPIRY_DAYS = 90;
const MAX_CODE_ATTEMPTS = 5;

type InvitationWithBusiness = InvitationCode & {
  business: Business;
};

type PublicUser = Omit<User, 'passwordHash'>;

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async generate(userId: string, generateInvitationDto: GenerateInvitationDto) {
    const { businessId, role, expiresInDays } = generateInvitationDto;

    if (!businessId) {
      throw new BadRequestException('businessId is required');
    }

    this.ensureInvitableRole(role);
    const days = resolveExpiryDays(expiresInDays);

    await this.ensureOwnerMembership(businessId, userId);

    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    return this.createUniqueInvitation({
      businessId,
      role,
      createdByUserId: userId,
      expiresAt,
    });
  }

  async accept(acceptInvitationDto: AcceptInvitationDto, currentUser?: AuthUser) {
    if (!acceptInvitationDto.code || acceptInvitationDto.code.trim().length === 0) {
      throw new BadRequestException('Invitation code is required');
    }

    const invitation = await this.getValidInvitation(acceptInvitationDto.code);

    if (currentUser) {
      return this.acceptForExistingUser(currentUser.id, invitation);
    }

    return this.acceptForNewUser(acceptInvitationDto, invitation);
  }

  private async acceptForExistingUser(
    userId: string,
    invitation: InvitationWithBusiness,
  ) {
    await this.ensureNotAlreadyMember(invitation.businessId, userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const membership = await this.prisma.businessMember.create({
      data: {
        businessId: invitation.businessId,
        userId,
        role: invitation.role,
      },
    });

    return {
      user: toPublicUser(user),
      membership,
      business: invitation.business,
    };
  }

  private async acceptForNewUser(
    acceptInvitationDto: AcceptInvitationDto,
    invitation: InvitationWithBusiness,
  ) {
    const { fullName, username, password } = acceptInvitationDto;

    if (!fullName || fullName.trim().length === 0) {
      throw new BadRequestException(
        'fullName is required to accept an invitation as a new user',
      );
    }

    if (!username || username.trim().length === 0) {
      throw new BadRequestException(
        'username is required to accept an invitation as a new user',
      );
    }

    if (!password || password.trim().length === 0) {
      throw new BadRequestException('Password must not be empty');
    }

    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      throw new ConflictException('Username is already taken');
    }

    const passwordHash = await hashPassword(password);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName,
          username,
          passwordHash,
        },
      });

      const membership = await tx.businessMember.create({
        data: {
          businessId: invitation.businessId,
          userId: user.id,
          role: invitation.role,
        },
      });

      return { user, membership };
    });

    const accessToken = await this.authService.issueAccessTokenForUser(
      result.user.id,
    );

    return {
      accessToken,
      user: toPublicUser(result.user),
      membership: result.membership,
      business: invitation.business,
    };
  }

  private async getValidInvitation(code: string): Promise<InvitationWithBusiness> {
    const normalizedCode = normalizeInviteCode(code);

    if (normalizedCode.length !== CODE_LENGTH) {
      throw new BadRequestException('Invitation code must be 6 characters');
    }

    const invitation = await this.prisma.invitationCode.findUnique({
      where: { code: normalizedCode },
      include: {
        business: true,
      },
    });

    if (
      !invitation ||
      invitation.revokedAt ||
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Invitation code is invalid or expired');
    }

    return invitation;
  }

  private async createUniqueInvitation(data: {
    businessId: string;
    role: MemberRole;
    createdByUserId: string;
    expiresAt: Date;
  }) {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = generateInviteCode();
      const existing = await this.prisma.invitationCode.findUnique({
        where: { code },
      });

      if (existing) {
        continue;
      }

      return this.prisma.invitationCode.create({
        data: {
          ...data,
          code,
        },
      });
    }

    throw new ConflictException('Unable to generate a unique invitation code');
  }

  private async ensureOwnerMembership(businessId: string, userId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException(`Business ${businessId} not found`);
    }

    const membership = await this.prisma.businessMember.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId,
        },
      },
    });

    if (!membership || membership.role !== MemberRole.OWNER) {
      throw new ForbiddenException(
        'Only owners can generate invitation codes for this business',
      );
    }

    return membership;
  }

  private async ensureNotAlreadyMember(businessId: string, userId: string) {
    const membership = await this.prisma.businessMember.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId,
        },
      },
    });

    if (membership) {
      throw new ConflictException('User is already a member of this business');
    }
  }

  private ensureInvitableRole(role: MemberRole) {
    if (!role) {
      throw new BadRequestException(
        `role must be one of: ${INVITABLE_ROLES.join(', ')}`,
      );
    }

    if (!INVITABLE_ROLES.includes(role)) {
      throw new BadRequestException(
        `Invitation codes can only assign ${INVITABLE_ROLES.join(' or ')}`,
      );
    }
  }
}

function generateInviteCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';

  for (const byte of bytes) {
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length] ?? '';
  }

  return code;
}

function normalizeInviteCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

function resolveExpiryDays(expiresInDays?: number): number {
  if (expiresInDays === undefined) {
    return DEFAULT_EXPIRY_DAYS;
  }

  if (
    !Number.isInteger(expiresInDays) ||
    expiresInDays < 1 ||
    expiresInDays > MAX_EXPIRY_DAYS
  ) {
    throw new BadRequestException(
      `expiresInDays must be an integer between 1 and ${MAX_EXPIRY_DAYS}`,
    );
  }

  return expiresInDays;
}

function toPublicUser(user: User): PublicUser {
  const { passwordHash: _, ...publicUser } = user;
  return publicUser;
}
