import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthSessionsService } from './auth-sessions.service.js';

describe('AuthSessionsService', () => {
  it('replaces only the session for that user and device', async () => {
    const tx = {
      authSession: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({
          id: 'sid-2',
          userId: 'user-1',
          deviceId: 'device-a',
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthSessionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    const session = await module
      .get(AuthSessionsService)
      .replaceForDevice('user-1', 'device-a');

    expect(session).toEqual({
      id: 'sid-2',
      userId: 'user-1',
      deviceId: 'device-a',
    });
    expect(tx.authSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', deviceId: 'device-a' },
    });
    expect(tx.authSession.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', deviceId: 'device-a' },
      select: { id: true, userId: true, deviceId: true },
    });
  });

  it('loads a session only when the id, user, and device match', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: 'sid-1',
      userId: 'user-1',
      deviceId: 'device-a',
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthSessionsService,
        {
          provide: PrismaService,
          useValue: { authSession: { findFirst } },
        },
      ],
    }).compile();

    await module
      .get(AuthSessionsService)
      .findValidSession('sid-1', 'user-1', 'device-a');

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'sid-1', userId: 'user-1', deviceId: 'device-a' },
      select: { id: true, userId: true, deviceId: true },
    });
  });

  it('revokes only the current session', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthSessionsService,
        {
          provide: PrismaService,
          useValue: { authSession: { deleteMany } },
        },
      ],
    }).compile();

    await module.get(AuthSessionsService).revoke('sid-1', 'user-1');

    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: 'sid-1', userId: 'user-1' },
    });
  });
});
