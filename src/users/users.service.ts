import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, type User } from '../generated/prisma/client.js';
import { hashPassword } from '../common/password.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOwnerAccountDto } from './dto/create-owner-account.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

type PublicUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOwnerAccount(createOwnerAccountDto: CreateOwnerAccountDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { username: createOwnerAccountDto.username },
    });

    if (existingUser) {
      throw new ConflictException('Username is already taken');
    }

    const passwordHash = await hashPassword(createOwnerAccountDto.password);
    const { business } = createOwnerAccountDto;

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: createOwnerAccountDto.fullName,
          username: createOwnerAccountDto.username,
          passwordHash,
        },
      });

      const createdBusiness = await tx.business.create({
        data: {
          name: business.name,
          type: business.type,
          currency: business.currency,
          targetFoodCost: business.targetFoodCost,
          unitSystem: business.unitSystem,
          members: {
            create: {
              userId: user.id,
              role: MemberRole.OWNER,
            },
          },
        },
        include: {
          members: true,
        },
      });

      return { user, business: createdBusiness };
    });

    return {
      user: this.toPublicUser(result.user),
      business: result.business,
      membership: result.business.members[0],
    };
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: {
        memberships: {
          include: {
            business: true,
          },
        },
      },
    });
  }

  async findAuthIdentity(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        tokenVersion: true,
      },
    });
  }

  async bumpTokenVersion(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        tokenVersion: {
          increment: 1,
        },
      },
      select: {
        id: true,
        username: true,
        tokenVersion: true,
      },
    });
  }

  async findAll(): Promise<PublicUser[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => this.toPublicUser(user));
  }

  toPublicUser(user: User): PublicUser {
    const { passwordHash: _, ...publicUser } = user;
    return publicUser;
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            business: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const { passwordHash: _, ...publicUser } = user;
    return publicUser;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<PublicUser> {
    await this.ensureUserExists(id);

    if (updateUserDto.username) {
      const existingUser = await this.prisma.user.findUnique({
        where: { username: updateUserDto.username },
      });

      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('Username is already taken');
      }
    }

    const passwordHash = updateUserDto.password
      ? await hashPassword(updateUserDto.password)
      : undefined;

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: updateUserDto.fullName,
        username: updateUserDto.username,
        passwordHash,
      },
    });

    return this.toPublicUser(user);
  }

  async remove(id: string): Promise<PublicUser> {
    await this.ensureUserExists(id);

    const user = await this.prisma.user.delete({
      where: { id },
    });

    return this.toPublicUser(user);
  }

  private async ensureUserExists(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
  }
}
