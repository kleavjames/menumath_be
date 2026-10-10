import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  createForUser(userId: string) {
    return this.prisma.authSession.create({
      data: {
        userId,
      },
      select: {
        id: true,
        userId: true,
      },
    });
  }

  findValidSession(sessionId: string, userId: string) {
    return this.prisma.authSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      select: {
        id: true,
        userId: true,
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
