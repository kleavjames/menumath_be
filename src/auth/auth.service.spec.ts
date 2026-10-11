import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service.js';
import { AuthSessionsService } from './auth-sessions.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {},
        },
        {
          provide: AuthSessionsService,
          useValue: {},
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: async () => 'token',
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('AuthService signUp', () => {
  it('returns the access token with user, membership, and business', async () => {
    const createdAt = new Date('2026-10-11T18:29:52.809Z');
    const membership = {
      id: 'mem-1',
      businessId: 'biz-1',
      userId: 'user-1',
      role: 'OWNER',
      createdAt,
      updatedAt: createdAt,
    };
    const business = {
      id: 'biz-1',
      name: 'Let Coffee',
      type: 'CAFE',
      currency: 'PHP',
      targetFoodCost: '30',
      unitSystem: 'METRIC',
      createdAt,
      updatedAt: createdAt,
      members: [membership],
    };
    const user = {
      id: 'user-1',
      fullName: 'Jane Doe',
      username: 'janedoe',
      createdAt,
      updatedAt: createdAt,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            createOwnerAccount: vi.fn().mockResolvedValue({
              user,
              business,
              membership,
            }),
            findAuthIdentity: vi.fn().mockResolvedValue({
              id: user.id,
              username: user.username,
            }),
          },
        },
        {
          provide: AuthSessionsService,
          useValue: {
            createForUser: vi.fn().mockResolvedValue({ id: 'sid-1' }),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: vi.fn().mockResolvedValue('token'),
          },
        },
      ],
    }).compile();

    const result = await module.get(AuthService).signUp({
      fullName: user.fullName,
      username: user.username,
      password: 'password1',
      business: {
        name: business.name,
        type: 'CAFE',
        currency: 'PHP',
        targetFoodCost: 30,
      },
    });

    expect(result).toEqual({
      accessToken: 'token',
      user,
      membership,
      business: {
        id: business.id,
        name: business.name,
        type: business.type,
        currency: business.currency,
        targetFoodCost: business.targetFoodCost,
        unitSystem: business.unitSystem,
        createdAt,
        updatedAt: createdAt,
      },
    });
  });
});

describe('AuthService signIn', () => {
  it('returns the access token with user, membership, and business', async () => {
    const createdAt = new Date('2026-10-11T18:29:52.809Z');
    const business = {
      id: 'biz-1',
      name: 'Let Coffee',
      type: 'CAFE',
      currency: 'PHP',
      targetFoodCost: '30',
      unitSystem: 'METRIC',
      createdAt,
      updatedAt: createdAt,
    };
    const membership = {
      id: 'mem-1',
      businessId: business.id,
      userId: 'user-1',
      role: 'STAFF',
      createdAt,
      updatedAt: createdAt,
      business,
    };
    const user = {
      id: 'user-1',
      fullName: 'Jane Doe',
      username: 'janedoe',
      passwordHash: 'hash',
      createdAt,
      updatedAt: createdAt,
      memberships: [membership],
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByUsername: vi.fn().mockResolvedValue(user),
          },
        },
        {
          provide: AuthSessionsService,
          useValue: {
            createForUser: vi.fn().mockResolvedValue({ id: 'sid-1' }),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: vi.fn().mockResolvedValue('token'),
          },
        },
      ],
    }).compile();

    const authService = module.get(AuthService);
    vi.spyOn(
      await import('../common/password.js'),
      'verifyPassword',
    ).mockResolvedValue(true);

    const result = await authService.signIn({
      username: 'janedoe',
      password: 'password1',
    });

    expect(result).toEqual({
      accessToken: 'token',
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        createdAt,
        updatedAt: createdAt,
      },
      membership: {
        id: membership.id,
        businessId: membership.businessId,
        userId: membership.userId,
        role: membership.role,
        createdAt,
        updatedAt: createdAt,
      },
      business,
    });
  });
});
