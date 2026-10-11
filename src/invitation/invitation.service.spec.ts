import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service.js';
import { MemberRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InvitationService } from './invitation.service.js';

describe('InvitationService', () => {
  let service: InvitationService;
  let prisma: {
    business: { findUnique: ReturnType<typeof vi.fn> };
    businessMember: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    invitationCode: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let authService: { issueAccessTokenForUser: ReturnType<typeof vi.fn> };

  const business = {
    id: 'biz-1',
    name: 'Cafe Luna',
    type: 'CAFE',
    currency: 'USD',
    targetFoodCost: 30,
    unitSystem: 'METRIC',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const invitation = {
    id: 'inv-1',
    code: 'ABCD23',
    businessId: business.id,
    role: MemberRole.STAFF,
    createdByUserId: 'owner-1',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    revokedAt: null,
    createdAt: new Date(),
    business,
  };

  beforeEach(async () => {
    prisma = {
      business: { findUnique: vi.fn() },
      businessMember: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      invitationCode: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    authService = {
      issueAccessTokenForUser: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = module.get<InvitationService>(InvitationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generate', () => {
    it('creates an invitation code for an owner', async () => {
      prisma.business.findUnique.mockResolvedValue(business);
      prisma.businessMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        businessId: business.id,
        userId: 'owner-1',
        role: MemberRole.OWNER,
      });
      prisma.invitationCode.findUnique.mockResolvedValue(null);
      prisma.invitationCode.create.mockResolvedValue({
        ...invitation,
        createdByUserId: 'owner-1',
      });

      const result = await service.generate('owner-1', {
        businessId: business.id,
        role: MemberRole.STAFF,
      });

      expect(result.code).toHaveLength(6);
      expect(prisma.invitationCode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: business.id,
          role: MemberRole.STAFF,
          createdByUserId: 'owner-1',
        }),
      });
    });

    it('rejects non-owners', async () => {
      prisma.business.findUnique.mockResolvedValue(business);
      prisma.businessMember.findUnique.mockResolvedValue({
        role: MemberRole.STAFF,
      });

      await expect(
        service.generate('staff-1', {
          businessId: business.id,
          role: MemberRole.STAFF,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects the OWNER role', async () => {
      await expect(
        service.generate('owner-1', {
          businessId: business.id,
          role: MemberRole.OWNER,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('accept', () => {
    it('adds an authenticated user to the business', async () => {
      const user = {
        id: 'user-1',
        fullName: 'Alex Rivera',
        username: 'alex',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const membership = {
        id: 'mem-2',
        businessId: business.id,
        userId: user.id,
        role: MemberRole.STAFF,
      };

      prisma.invitationCode.findUnique.mockResolvedValue(invitation);
      prisma.businessMember.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.businessMember.create.mockResolvedValue(membership);

      const result = await service.accept(
        { code: 'ab-cd23' },
        { id: user.id, username: user.username, sessionId: 'sid-1' },
      );

      expect(result.membership).toEqual(membership);
      expect(result.user).toEqual({
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
      expect(result.business).toEqual(business);
    });

    it('creates a new user and issues a token', async () => {
      const user = {
        id: 'user-2',
        fullName: 'Sam Lee',
        username: 'sam',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const membership = {
        id: 'mem-3',
        businessId: business.id,
        userId: user.id,
        role: MemberRole.STAFF,
      };

      prisma.invitationCode.findUnique.mockResolvedValue(invitation);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => {
        prisma.user.create.mockResolvedValue(user);
        prisma.businessMember.create.mockResolvedValue(membership);
        return fn(prisma);
      });
      authService.issueAccessTokenForUser.mockResolvedValue('token-1');

      const result = await service.accept({
        code: 'ABCD23',
        fullName: 'Sam Lee',
        username: 'sam',
        password: 'password1',
      });

      expect(result).toMatchObject({
        accessToken: 'token-1',
        membership,
        business,
      });
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('rejects expired codes', async () => {
      prisma.invitationCode.findUnique.mockResolvedValue({
        ...invitation,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.accept({
          code: 'ABCD23',
          fullName: 'Sam Lee',
          username: 'sam',
          password: 'password1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects users who are already members', async () => {
      prisma.invitationCode.findUnique.mockResolvedValue(invitation);
      prisma.businessMember.findUnique.mockResolvedValue({
        id: 'mem-existing',
      });

      await expect(
        service.accept(
          { code: 'ABCD23' },
          { id: 'user-1', username: 'alex', sessionId: 'sid-1' },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('requires account details when the caller is not signed in', async () => {
      prisma.invitationCode.findUnique.mockResolvedValue(invitation);

      await expect(service.accept({ code: 'ABCD23' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects codes that are not 6 characters', async () => {
      await expect(service.accept({ code: 'ABC12' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
