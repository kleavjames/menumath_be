import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { storedUsableCostPerItem } from '../common/costing.js';
import {
  recalculateRecipesByIds,
  recalculateRecipesForIngredient,
} from '../common/recipe-costs.js';
import { CategoryType, MemberRole, Unit } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateIngredientDto } from './dto/create-ingredient.dto.js';
import type { IngredientSupplierDto } from './dto/ingredient-supplier.dto.js';
import { UpdateIngredientDto } from './dto/update-ingredient.dto.js';

const ingredientWithSuppliersInclude = {
  suppliers: {
    orderBy: { name: 'asc' as const },
  },
  calculationSupplier: true,
} as const;

@Injectable()
export class IngredientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createIngredientDto: CreateIngredientDto) {
    const { businessId, categoryId, name, suppliers, calculationSupplierId } =
      createIngredientDto;

    if (!businessId) {
      throw new BadRequestException(
        'Cannot create ingredient: Missing required field',
      );
    }
    if (!categoryId) {
      throw new BadRequestException(
        'Failed to create ingredient: Need to select a category',
      );
    }
    if (!suppliers?.length) {
      throw new BadRequestException(
        'Failed to create ingredient: At least one supplier is required',
      );
    }

    this.ensureValidSuppliers(suppliers);
    await this.ensureOwnerMembership(businessId, userId);
    await this.ensureIngredientCategory(categoryId, businessId);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.ingredient.create({
        data: {
          businessId,
          categoryId,
          name,
          suppliers: {
            create: suppliers.map((supplier) =>
              this.toSupplierCreateData(supplier),
            ),
          },
        },
        include: { suppliers: { orderBy: { name: 'asc' } } },
      });

      const resolvedCalculationSupplierId = this.resolveCalculationSupplierId(
        created.suppliers,
        calculationSupplierId,
      );

      return tx.ingredient.update({
        where: { id: created.id },
        data: { calculationSupplierId: resolvedCalculationSupplierId },
        include: ingredientWithSuppliersInclude,
      });
    });
  }

  async findAll(userId: string, businessId: string, categoryId?: string) {
    await this.ensureMembership(businessId, userId);

    return this.prisma.ingredient.findMany({
      where: {
        businessId,
        ...(categoryId ? { categoryId } : {}),
      },
      orderBy: { name: 'asc' },
      include: ingredientWithSuppliersInclude,
    });
  }

  async findOne(userId: string, id: string) {
    const ingredient = await this.getIngredientOrThrow(id);
    await this.ensureMembership(ingredient.businessId, userId);
    return ingredient;
  }

  async update(
    userId: string,
    id: string,
    updateIngredientDto: UpdateIngredientDto,
  ) {
    const ingredient = await this.getIngredientOrThrow(id);
    await this.ensureOwnerMembership(ingredient.businessId, userId);

    const { suppliers, calculationSupplierId, ...ingredientFields } =
      updateIngredientDto;

    if (suppliers !== undefined) {
      if (!suppliers.length) {
        throw new BadRequestException(
          'Failed to update ingredient: At least one supplier is required',
        );
      }
      this.ensureValidSuppliers(suppliers);
    }

    if (
      ingredientFields.categoryId !== undefined &&
      ingredientFields.categoryId !== ingredient.categoryId
    ) {
      await this.ensureIngredientCategory(
        ingredientFields.categoryId,
        ingredient.businessId,
      );
    }

    if (suppliers !== undefined) {
      return this.prisma.$transaction(async (tx) => {
        const createdSuppliers = await Promise.all(
          suppliers.map((supplier) =>
            tx.ingredientSupplier.create({
              data: {
                ingredientId: id,
                ...this.toSupplierCreateData(supplier),
              },
            }),
          ),
        );

        const newSupplierIds = createdSuppliers.map((supplier) => supplier.id);
        const resolvedCalculationSupplierId =
          this.resolveCalculationSupplierIdAfterReplace(
            createdSuppliers,
            calculationSupplierId,
            ingredient.suppliers,
          );

        await tx.recipeIngredient.updateMany({
          where: {
            ingredientId: id,
            ingredientSupplierId: { notIn: newSupplierIds },
          },
          data: { ingredientSupplierId: resolvedCalculationSupplierId },
        });

        await tx.ingredient.update({
          where: { id },
          data: {
            categoryId: ingredientFields.categoryId,
            name: ingredientFields.name,
            calculationSupplierId: resolvedCalculationSupplierId,
          },
        });

        await tx.ingredientSupplier.deleteMany({
          where: {
            ingredientId: id,
            id: { notIn: newSupplierIds },
          },
        });

        return tx.ingredient.findUniqueOrThrow({
          where: { id },
          include: ingredientWithSuppliersInclude,
        });
      }).then(async (updated) => {
        await recalculateRecipesForIngredient(this.prisma, id);
        return updated;
      });
    }

    if (calculationSupplierId !== undefined) {
      this.ensureCalculationSupplierBelongsToIngredient(
        calculationSupplierId,
        ingredient.suppliers,
      );
    }

    const calculationSupplierChanged =
      calculationSupplierId !== undefined &&
      calculationSupplierId !== ingredient.calculationSupplierId;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (calculationSupplierChanged) {
        await tx.recipeIngredient.updateMany({
          where: { ingredientId: id },
          data: { ingredientSupplierId: calculationSupplierId },
        });
      }

      return tx.ingredient.update({
        where: { id },
        data: {
          categoryId: ingredientFields.categoryId,
          name: ingredientFields.name,
          calculationSupplierId,
        },
        include: ingredientWithSuppliersInclude,
      });
    });

    if (calculationSupplierChanged) {
      await recalculateRecipesForIngredient(this.prisma, id);
    }

    return updated;
  }

  async remove(userId: string, id: string) {
    const ingredient = await this.getIngredientOrThrow(id);
    await this.ensureOwnerMembership(ingredient.businessId, userId);

    return this.prisma.$transaction(async (tx) => {
      const affected = await tx.recipeIngredient.findMany({
        where: { ingredientId: id },
        select: { recipeId: true },
      });
      const recipeIds = [...new Set(affected.map((row) => row.recipeId))];

      await tx.recipeIngredient.deleteMany({
        where: { ingredientId: id },
      });

      await recalculateRecipesByIds(tx, recipeIds);

      return tx.ingredient.delete({
        where: { id },
        include: ingredientWithSuppliersInclude,
      });
    });
  }

  private resolveCalculationSupplierIdAfterReplace(
    createdSuppliers: { id: string }[],
    requestedId: string | undefined,
    previousSuppliers: { id: string }[],
  ): string {
    if (requestedId !== undefined) {
      if (createdSuppliers.some((supplier) => supplier.id === requestedId)) {
        return requestedId;
      }

      const previousIndex = previousSuppliers.findIndex(
        (supplier) => supplier.id === requestedId,
      );
      if (previousIndex >= 0 && createdSuppliers[previousIndex] !== undefined) {
        return createdSuppliers[previousIndex].id;
      }

      this.ensureCalculationSupplierBelongsToIngredient(
        requestedId,
        createdSuppliers,
      );
    }

    return this.resolveCalculationSupplierId(createdSuppliers, undefined);
  }

  private resolveCalculationSupplierId(
    suppliers: { id: string }[],
    requestedId?: string,
  ): string {
    if (requestedId !== undefined) {
      this.ensureCalculationSupplierBelongsToIngredient(requestedId, suppliers);
      return requestedId;
    }

    const first = suppliers[0];
    if (!first) {
      throw new BadRequestException(
        'Failed to save ingredient: At least one supplier is required',
      );
    }

    return first.id;
  }

  private ensureCalculationSupplierBelongsToIngredient(
    calculationSupplierId: string,
    suppliers: { id: string }[],
  ) {
    if (!suppliers.some((supplier) => supplier.id === calculationSupplierId)) {
      throw new BadRequestException(
        "calculationSupplierId must match one of this ingredient's suppliers",
      );
    }
  }

  private async getIngredientOrThrow(id: string) {
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id },
      include: ingredientWithSuppliersInclude,
    });

    if (!ingredient) {
      throw new NotFoundException(`Ingredient ${id} not found`);
    }

    return ingredient;
  }

  private toSupplierCreateData(supplier: IngredientSupplierDto) {
    return {
      name: supplier.name,
      itemSize: supplier.itemSize,
      itemSizeUnit: supplier.itemSizeUnit,
      itemPrice: supplier.itemPrice,
      usableCostPerItem: storedUsableCostPerItem(
        supplier.itemSize,
        supplier.itemPrice,
        supplier.itemSizeUnit,
      ),
    };
  }

  private ensureValidSuppliers(suppliers: IngredientSupplierDto[]) {
    for (const supplier of suppliers) {
      this.ensureValidUnit(supplier.itemSizeUnit);
      if (!(supplier.itemSize > 0)) {
        throw new BadRequestException('Pack size must be greater than 0');
      }
      if (!(supplier.itemPrice > 0)) {
        throw new BadRequestException('Pack price must be greater than 0');
      }
    }
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
      throw new BadRequestException('Category must be of type INGREDIENT');
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

  private async ensureMembership(businessId: string, userId: string) {
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

    if (!membership) {
      throw new ForbiddenException('You are not a member of this business');
    }

    return membership;
  }

  private async ensureOwnerMembership(businessId: string, userId: string) {
    const membership = await this.ensureMembership(businessId, userId);

    if (membership.role !== MemberRole.OWNER) {
      throw new ConflictException('User is not an owner of this business');
    }

    return membership;
  }
}
