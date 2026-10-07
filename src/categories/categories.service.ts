import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MemberRole,
  type CategoryType,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createCategoryDto: CreateCategoryDto) {
    const { name, type, businessId } = createCategoryDto;

    await this.ensureOwnerMembership(businessId, userId);
    await this.ensureNameAvailable(businessId, type, name);

    return this.prisma.category.create({
      data: {
        name,
        type,
        businessId,
      },
    });
  }

  async findAll(
    userId: string,
    businessId: string,
    type?: CategoryType,
  ) {
    await this.ensureOwnerMembership(businessId, userId);

    return this.prisma.category.findMany({
      where: {
        businessId,
        ...(type ? { type } : {}),
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(userId: string, id: string) {
    const category = await this.getCategoryOrThrow(id);
    await this.ensureOwnerMembership(category.businessId, userId);
    return category;
  }

  async update(
    userId: string,
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ) {
    const category = await this.getCategoryOrThrow(id);
    await this.ensureOwnerMembership(category.businessId, userId);

    if (updateCategoryDto.name !== category.name) {
      await this.ensureNameAvailable(
        category.businessId,
        category.type,
        updateCategoryDto.name,
        id,
      );
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: updateCategoryDto.name,
      },
    });
  }

  async remove(userId: string, id: string) {
    const category = await this.getCategoryOrThrow(id);
    await this.ensureOwnerMembership(category.businessId, userId);

    return this.prisma.category.delete({
      where: { id },
    });
  }

  private async getCategoryOrThrow(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    return category;
  }

  private async ensureNameAvailable(
    businessId: string,
    type: CategoryType,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.category.findUnique({
      where: {
        businessId_type_name: {
          businessId,
          type,
          name,
        },
      },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Category "${name}" of type ${type} already exists for this business`,
      );
    }
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
      throw new ConflictException('User is not an owner of this business');
    }

    return membership;
  }
}
