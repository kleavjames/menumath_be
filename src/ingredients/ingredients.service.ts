import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CategoryType,
  MemberRole,
  Unit,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateIngredientDto } from './dto/create-ingredient.dto.js';
import { UpdateIngredientDto } from './dto/update-ingredient.dto.js';

@Injectable()
export class IngredientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createIngredientDto: CreateIngredientDto) {
    const {
      businessId,
      categoryId,
      name,
      supplier,
      itemSize,
      itemSizeUnit,
      itemPrice,
      usableCostPerItem,
    } = createIngredientDto;

    this.ensureValidUnit(itemSizeUnit);
    await this.ensureOwnerMembership(businessId, userId);
    await this.ensureIngredientCategory(categoryId, businessId);

    return this.prisma.ingredient.create({
      data: {
        businessId,
        categoryId,
        name,
        supplier,
        itemSize,
        itemSizeUnit,
        itemPrice,
        usableCostPerItem,
      },
    });
  }

  async findAll(userId: string, businessId: string, categoryId?: string) {
    await this.ensureOwnerMembership(businessId, userId);

    return this.prisma.ingredient.findMany({
      where: {
        businessId,
        ...(categoryId ? { categoryId } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    const ingredient = await this.getIngredientOrThrow(id);
    await this.ensureOwnerMembership(ingredient.businessId, userId);
    return ingredient;
  }

  async update(
    userId: string,
    id: string,
    updateIngredientDto: UpdateIngredientDto,
  ) {
    const ingredient = await this.getIngredientOrThrow(id);
    await this.ensureOwnerMembership(ingredient.businessId, userId);

    if (updateIngredientDto.itemSizeUnit !== undefined) {
      this.ensureValidUnit(updateIngredientDto.itemSizeUnit);
    }

    if (
      updateIngredientDto.categoryId !== undefined &&
      updateIngredientDto.categoryId !== ingredient.categoryId
    ) {
      await this.ensureIngredientCategory(
        updateIngredientDto.categoryId,
        ingredient.businessId,
      );
    }

    return this.prisma.ingredient.update({
      where: { id },
      data: {
        categoryId: updateIngredientDto.categoryId,
        name: updateIngredientDto.name,
        supplier: updateIngredientDto.supplier,
        itemSize: updateIngredientDto.itemSize,
        itemSizeUnit: updateIngredientDto.itemSizeUnit,
        itemPrice: updateIngredientDto.itemPrice,
        usableCostPerItem: updateIngredientDto.usableCostPerItem,
      },
    });
  }

  async remove(userId: string, id: string) {
    const ingredient = await this.getIngredientOrThrow(id);
    await this.ensureOwnerMembership(ingredient.businessId, userId);

    return this.prisma.ingredient.delete({
      where: { id },
    });
  }

  private async getIngredientOrThrow(id: string) {
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id },
    });

    if (!ingredient) {
      throw new NotFoundException(`Ingredient ${id} not found`);
    }

    return ingredient;
  }

  private async ensureIngredientCategory(
    categoryId: string,
    businessId: string,
  ) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category ${categoryId} not found`);
    }

    if (category.businessId !== businessId) {
      throw new BadRequestException(
        'Category does not belong to this business',
      );
    }

    if (category.type !== CategoryType.INGREDIENT) {
      throw new BadRequestException(
        'Category must be of type INGREDIENT',
      );
    }

    return category;
  }

  private ensureValidUnit(unit: Unit) {
    if (!Object.values(Unit).includes(unit)) {
      throw new BadRequestException(
        `itemSizeUnit must be one of: ${Object.values(Unit).join(', ')}`,
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
