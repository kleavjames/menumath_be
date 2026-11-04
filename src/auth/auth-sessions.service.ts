import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  replaceForDevice(userId: string, deviceId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.authSession.deleteMany({
        where: {
          userId,
          deviceId,
        },
      });

      return tx.authSession.create({
        data: {
          userId,
          deviceId,
        },
        select: {
          id: true,
          userId: true,
          deviceId: true,
        },
      });
    });
  }

  findValidSession(sessionId: string, userId: string, deviceId: string) {
    return this.prisma.authSession.findFirst({
      where: {
        id: sessionId,
        userId,
        deviceId,
      },
      select: {
        id: true,
        userId: true,
        deviceId: true,
      },
    });
  }

  revoke(sessionId: string, userId: string) {
    return this.prisma.authSession.deleteMany({
      where: {
        id: sessionId,
        userId,
      },
    });
  }
}
