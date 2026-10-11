import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  const prisma = {
    business: { findUnique: vi.fn() },
    businessMember: { findUnique: vi.fn(), findMany: vi.fn() },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns users that belong to the business', async () => {
    const createdAt = new Date('2026-10-11T18:29:52.809Z');
    prisma.business.findUnique.mockResolvedValue({ id: 'biz-1' });
    prisma.businessMember.findUnique.mockResolvedValue({
      id: 'mem-1',
      businessId: 'biz-1',
      userId: 'user-1',
    });
    prisma.businessMember.findMany.mockResolvedValue([
      {
        id: 'mem-1',
        businessId: 'biz-1',
        userId: 'user-1',
        role: 'OWNER',
        createdAt,
        updatedAt: createdAt,
        user: {
          id: 'user-1',
          fullName: 'Jane Doe',
          username: 'janedoe',
          passwordHash: 'hash',
          createdAt,
          updatedAt: createdAt,
        },
      },
    ]);

    const result = await service.findByBusiness('user-1', 'biz-1');

    expect(result).toEqual([
      {
        id: 'user-1',
        fullName: 'Jane Doe',
        username: 'janedoe',
        createdAt,
        updatedAt: createdAt,
        membership: {
          id: 'mem-1',
          businessId: 'biz-1',
          userId: 'user-1',
          role: 'OWNER',
          createdAt,
          updatedAt: createdAt,
        },
      },
    ]);
  });

  it('rejects callers who are not members of the business', async () => {
    prisma.business.findUnique.mockResolvedValue({ id: 'biz-1' });
    prisma.businessMember.findUnique.mockResolvedValue(null);

    await expect(service.findByBusiness('user-2', 'biz-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
