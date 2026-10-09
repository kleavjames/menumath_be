import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBusinessDto } from './dto/create-business.dto.js';
import { UpdateBusinessDto } from './dto/update-business.dto.js';

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  async createForOwner(ownerUserId: string, createBusinessDto: CreateBusinessDto) {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
    });

    if (!owner) {
      throw new NotFoundException(`User ${ownerUserId} not found`);
    }

    return this.prisma.business.create({
      data: {
        name: createBusinessDto.name,
        type: createBusinessDto.type,
        currency: createBusinessDto.currency,
        targetFoodCost: createBusinessDto.targetFoodCost,
        unitSystem: createBusinessDto.unitSystem,
        members: {
          create: {
            userId: ownerUserId,
            role: MemberRole.OWNER,
          },
        },
      },
      include: {
        members: true,
      },
    });
  }

  async findAll() {
    return this.prisma.business.findMany({
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!business) {
      throw new NotFoundException(`Business ${id} not found`);
    }

    return business;
  }

  async findByOwner(ownerUserId: string) {
    return this.prisma.business.findMany({
      where: {
        members: {
          some: {
            userId: ownerUserId,
            role: MemberRole.OWNER,
          },
        },
      },
      include: {
        members: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, updateBusinessDto: UpdateBusinessDto) {
    await this.ensureBusinessExists(id);

    return this.prisma.business.update({
      where: { id },
      data: {
        name: updateBusinessDto.name,
        type: updateBusinessDto.type,
        currency: updateBusinessDto.currency,
        targetFoodCost: updateBusinessDto.targetFoodCost,
        unitSystem: updateBusinessDto.unitSystem,
      },
    });
  }

  async remove(id: string) {
    await this.ensureBusinessExists(id);

    return this.prisma.business.delete({
      where: { id },
    });
  }

  async ensureOwnerMembership(businessId: string, userId: string) {
    const membership = await this.prisma.businessMember.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId,
        },
      },
    });

    if (!membership || membership.role !== MemberRole.OWNER) {
      throw new ConflictException('User is not an owner of this business');
    }

    return membership;
  }

  private async ensureBusinessExists(id: string): Promise<void> {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) {
      throw new NotFoundException(`Business ${id} not found`);
    }
  }
}
