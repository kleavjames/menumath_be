import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users/users.service.js';
import { AuthModule } from './auth.module.js';
import { AuthSessionsService } from './auth-sessions.service.js';
import { AuthService } from './auth.service.js';

vi.mock('../common/password.js', () => ({
  verifyPassword: vi.fn(async () => true),
}));

describe('AuthModule', () => {
  it('issues access tokens with no expiry', () => {
    const imports = Reflect.getMetadata('imports', AuthModule) as Array<{
      providers?: Array<{
        useValue?: { signOptions?: { expiresIn?: unknown } };
      }>;
    }>;
    const jwtImport = imports.find((item) =>
      item?.providers?.some((provider) => provider.useValue),
    );
    const options = jwtImport?.providers?.find(
      (provider) => provider.useValue,
    )?.useValue;

    expect(options?.signOptions?.expiresIn).toBeUndefined();
  });
});

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
            replaceForDevice: vi.fn().mockResolvedValue({ id: 'sid-1' }),
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
      deviceId: 'device-1',
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
    expect(
      module.get(AuthSessionsService).replaceForDevice,
    ).toHaveBeenCalledWith(user.id, 'device-1');
    expect(module.get(JwtService).signAsync).toHaveBeenCalledWith({
      sub: user.id,
      username: user.username,
      sid: 'sid-1',
      deviceId: 'device-1',
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
            replaceForDevice: vi.fn().mockResolvedValue({ id: 'sid-1' }),
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

    const result = await authService.signIn({
      username: 'janedoe',
      password: 'password1',
      deviceId: 'device-1',
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

  it('rejects a missing or blank deviceId before looking up the user', async () => {
    const findByUsername = vi.fn();
    const replaceForDevice = vi.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: { findByUsername },
        },
        {
          provide: AuthSessionsService,
          useValue: { replaceForDevice },
        },
        {
          provide: JwtService,
          useValue: { signAsync: vi.fn() },
        },
      ],
    }).compile();
    const authService = module.get(AuthService);
    const invalidDeviceIds = [undefined, '', '   ', 12];

    for (const deviceId of invalidDeviceIds) {
      await expect(
        authService.signIn({
          username: 'janedoe',
          password: 'password1',
          deviceId: deviceId as string,
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'deviceId is required',
        ),
      );
    }

    expect(findByUsername).not.toHaveBeenCalled();
    expect(replaceForDevice).not.toHaveBeenCalled();
  });

  it('stores the trimmed deviceId and signs a token with no expiry', async () => {
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
    const replaceForDevice = vi.fn().mockResolvedValue({ id: 'sid-1' });
    const jwtService = new JwtService({
      secret: 'test-secret',
    });
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
          useValue: { replaceForDevice },
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    const result = await module.get(AuthService).signIn({
      username: 'janedoe',
      password: 'password1',
      deviceId: '  device-1  ',
    });

    expect(replaceForDevice).toHaveBeenCalledWith('user-1', 'device-1');
    const payload = jwtService.decode(result.accessToken);
    expect(payload).toMatchObject({
      sub: 'user-1',
      username: 'janedoe',
      sid: 'sid-1',
      deviceId: 'device-1',
    });
    expect(payload).not.toHaveProperty('exp');
  });
});

describe('AuthService signUp deviceId', () => {
  it('rejects an invalid deviceId before creating the account', async () => {
    const createOwnerAccount = vi.fn();
    const replaceForDevice = vi.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: { createOwnerAccount },
        },
        {
          provide: AuthSessionsService,
          useValue: { replaceForDevice },
        },
        {
          provide: JwtService,
          useValue: { signAsync: vi.fn() },
        },
      ],
    }).compile();

    await expect(
      module.get(AuthService).signUp({
        fullName: 'Jane Doe',
        username: 'janedoe',
        password: 'password1',
        deviceId: ' ',
        business: {
          name: 'Let Coffee',
          type: 'CAFE',
          currency: 'PHP',
          targetFoodCost: 30,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(createOwnerAccount).not.toHaveBeenCalled();
    expect(replaceForDevice).not.toHaveBeenCalled();
  });
});
