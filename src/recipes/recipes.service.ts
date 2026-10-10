import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoryType, MemberRole, Unit } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import type { CreateUpdateRecipeIngredientDto } from './dto/create-update-recipe-ingredient.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';

const recipeWithIngredientsInclude = {
  ingredients: {
    include: { ingredient: true },
  },
} as const;

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createRecipeDto: CreateRecipeDto) {
    const {
      businessId,
      categoryId,
      name,
      servings,
      pricePerServing,
      costPerServing,
      recipeCost,
      profit,
      margin,
      ingredients,
    } = createRecipeDto;

    if (!businessId) {
      throw new BadRequestException(
        'Cannot create recipe: Missing required field',
      );
    }
    if (!categoryId) {
      throw new BadRequestException(
        'Failed to create recipe: Need to select a category',
      );
    }
    if (!ingredients?.length) {
      throw new BadRequestException(
        'Failed to create recipe: At least one ingredient is required',
      );
    }

    await this.ensureOwnerMembership(businessId, userId);
    await this.ensureRecipeCategory(categoryId, businessId);
    this.ensureUniqueRecipeIngredients(ingredients);
    for (const line of ingredients) {
      this.ensureValidUnit(line.unit);
    }
    await this.ensureRecipeIngredientsForBusiness(businessId, ingredients);

    const recipeIngredients = ingredients.map(
      ({ ingredientId, quantity, pricePerUnit, unit }) => ({
        ingredientId,
        quantity,
        pricePerUnit,
        unit,
      }),
    );

    return this.prisma.recipe.create({
      data: {
        businessId,
        categoryId,
        name,
        servings,
        pricePerServing,
        costPerServing,
        recipeCost,
        profit,
        margin,
        ingredients: {
          create: recipeIngredients,
        },
      },
      include: recipeWithIngredientsInclude,
    });
  }

  async findAll(userId: string, businessId: string, categoryId?: string) {
    await this.ensureOwnerMembership(businessId, userId);

    return this.prisma.recipe.findMany({
      where: {
        businessId,
        ...(categoryId ? { categoryId } : {}),
      },
      orderBy: { name: 'asc' },
      include: recipeWithIngredientsInclude,
    });
  }

  async findOne(userId: string, id: string) {
    const recipe = await this.getRecipeOrThrow(id);
    await this.ensureOwnerMembership(recipe.businessId, userId);
    return recipe;
  }

  async update(userId: string, id: string, updateRecipeDto: UpdateRecipeDto) {
    const recipe = await this.getRecipeOrThrow(id);
    await this.ensureOwnerMembership(recipe.businessId, userId);

    if (
      updateRecipeDto.categoryId !== undefined &&
      updateRecipeDto.categoryId !== recipe.categoryId
    ) {
      await this.ensureRecipeCategory(
        updateRecipeDto.categoryId,
        recipe.businessId,
      );
    }

    const { ingredients, ...recipeFields } = updateRecipeDto;

    if (ingredients !== undefined) {
      if (!ingredients.length) {
        throw new BadRequestException(
          'Failed to update recipe: At least one ingredient is required',
        );
      }
      this.ensureUniqueRecipeIngredients(ingredients);
      for (const line of ingredients) {
        this.ensureValidUnit(line.unit);
      }
      await this.ensureRecipeIngredientsForBusiness(
        recipe.businessId,
        ingredients,
      );
    }

    return this.prisma.recipe.update({
      where: { id },
      data: {
        categoryId: recipeFields.categoryId,
        name: recipeFields.name,
        servings: recipeFields.servings,
        pricePerServing: recipeFields.pricePerServing,
        costPerServing: recipeFields.costPerServing,
        recipeCost: recipeFields.recipeCost,
        profit: recipeFields.profit,
        margin: recipeFields.margin,
        ...(ingredients !== undefined
          ? {
              ingredients: {
                deleteMany: {},
                create: ingredients.map(
                  ({ ingredientId, quantity, pricePerUnit, unit }) => ({
                    ingredientId,
                    quantity,
                    pricePerUnit,
                    unit,
                  }),
                ),
              },
            }
          : {}),
      },
      include: recipeWithIngredientsInclude,
    });
  }

  async remove(userId: string, id: string) {
    const recipe = await this.getRecipeOrThrow(id);
    await this.ensureOwnerMembership(recipe.businessId, userId);

    return this.prisma.recipe.delete({
      where: { id },
    });
  }

  private ensureUniqueRecipeIngredients(
    ingredients: CreateUpdateRecipeIngredientDto[],
  ) {
    const ingredientIds = ingredients.map((line) => line.ingredientId);
    if (new Set(ingredientIds).size !== ingredientIds.length) {
      throw new BadRequestException(
        'Recipe cannot include the same ingredient more than once',
      );
    }
  }

  private async ensureRecipeIngredientsForBusiness(
    businessId: string,
    ingredients: CreateUpdateRecipeIngredientDto[],
  ) {
    const ingredientIds = ingredients.map((line) => line.ingredientId);
    const records = await this.prisma.ingredient.findMany({
      where: {
        id: { in: ingredientIds },
        businessId,
      },
    });

    if (records.length !== ingredientIds.length) {
      throw new BadRequestException(
        'One or more ingredients were not found or do not belong to this business',
      );
    }
  }

  private ensureValidUnit(unit: Unit) {
    if (!Object.values(Unit).includes(unit)) {
      throw new BadRequestException(
        `unit must be one of: ${Object.values(Unit).join(', ')}`,
      );
    }
  }

  private async getRecipeOrThrow(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: recipeWithIngredientsInclude,
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe ${id} not found`);
    }

    return recipe;
  }

  private async ensureRecipeCategory(categoryId: string, businessId: string) {
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

    if (category.type !== CategoryType.RECIPE) {
      throw new BadRequestException('Category must be of type RECIPE');
    }

    return category;
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
