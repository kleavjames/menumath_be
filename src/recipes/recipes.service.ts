import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  computeRecipeLineCost,
  computeRecipeTotals,
  decimalToNumber,
} from '../common/costing.js';
import {
  CategoryType,
  MemberRole,
  Prisma,
  Unit,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import type { CreateUpdateRecipeIngredientDto } from './dto/create-update-recipe-ingredient.dto.js';
import type { RecipeStepDto } from './dto/recipe-step.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';

const recipeWithIngredientsInclude = {
  ingredients: {
    include: {
      ingredient: {
        include: {
          calculationSupplier: true,
          suppliers: { orderBy: { name: 'asc' as const } },
        },
      },
      ingredientSupplier: true,
    },
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
      ingredients,
      steps,
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
    this.ensureValidServings(servings);
    this.ensureValidPricePerServing(pricePerServing);
    this.ensureUniqueRecipeIngredients(ingredients);
    for (const line of ingredients) {
      this.ensureValidUnit(line.unit);
      this.ensureValidQuantity(line.quantity);
    }
    const recipeIngredients = await this.resolveRecipeIngredientLines(
      businessId,
      ingredients,
    );

    const recipeSteps = this.normalizeSteps(steps ?? []);
    this.ensureValidSteps(recipeSteps);
    const totals = computeRecipeTotals({
      servings,
      pricePerServing,
      lineCosts: recipeIngredients.map((line) => line.pricePerUnit),
    });

    return this.prisma.recipe.create({
      data: {
        businessId,
        categoryId,
        name,
        servings,
        pricePerServing,
        ...totals,
        steps: this.toRecipeStepsJson(recipeSteps),
        ingredients: {
          create: recipeIngredients,
        },
      },
      include: recipeWithIngredientsInclude,
    });
  }

  async findAll(userId: string, businessId: string, categoryId?: string) {
    await this.ensureMembership(businessId, userId);

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
    await this.ensureMembership(recipe.businessId, userId);
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

    const { ingredients, steps, servings, pricePerServing, categoryId, name } =
      updateRecipeDto;

    let recipeSteps: RecipeStepDto[] | undefined;
    if (steps !== undefined) {
      recipeSteps = this.normalizeSteps(steps);
      this.ensureValidSteps(recipeSteps);
    }

    if (servings !== undefined) {
      this.ensureValidServings(servings);
    }
    if (pricePerServing !== undefined) {
      this.ensureValidPricePerServing(pricePerServing);
    }

    if (ingredients !== undefined) {
      if (!ingredients.length) {
        throw new BadRequestException(
          'Failed to update recipe: At least one ingredient is required',
        );
      }
      this.ensureUniqueRecipeIngredients(ingredients);
      for (const line of ingredients) {
        this.ensureValidUnit(line.unit);
        this.ensureValidQuantity(line.quantity);
      }
    }

    let resolvedRecipeIngredients:
      | Awaited<ReturnType<RecipesService['resolveRecipeIngredientLines']>>
      | undefined;
    if (ingredients !== undefined) {
      resolvedRecipeIngredients = await this.resolveRecipeIngredientLines(
        recipe.businessId,
        ingredients,
      );
    }

    const shouldRecalculate =
      resolvedRecipeIngredients !== undefined ||
      servings !== undefined ||
      pricePerServing !== undefined;

    const totals = shouldRecalculate
      ? computeRecipeTotals({
          servings: servings ?? recipe.servings,
          pricePerServing:
            pricePerServing ?? decimalToNumber(recipe.pricePerServing),
          lineCosts:
            resolvedRecipeIngredients?.map((line) => line.pricePerUnit) ??
            recipe.ingredients.map((line) =>
              computeRecipeLineCost(line.quantity, line.ingredientSupplier),
            ),
        })
      : undefined;

    return this.prisma.recipe.update({
      where: { id },
      data: {
        categoryId,
        name,
        servings,
        pricePerServing,
        ...totals,
        ...(recipeSteps !== undefined
          ? { steps: this.toRecipeStepsJson(recipeSteps) }
          : {}),
        ...(resolvedRecipeIngredients !== undefined
          ? {
              ingredients: {
                deleteMany: {},
                create: resolvedRecipeIngredients,
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

  private toRecipeStepsJson(steps: RecipeStepDto[]): Prisma.InputJsonValue {
    return steps.map(({ order, text }) => ({ order, text }));
  }

  private normalizeSteps(steps: RecipeStepDto[]): RecipeStepDto[] {
    return [...steps].sort((a, b) => a.order - b.order);
  }

  private ensureValidSteps(steps: RecipeStepDto[]) {
    for (const step of steps) {
      if (!Number.isInteger(step.order) || step.order < 1) {
        throw new BadRequestException(
          'Each step order must be a positive integer starting at 1',
        );
      }
      if (typeof step.text !== 'string' || !step.text.trim()) {
        throw new BadRequestException('Each step must include non-empty text');
      }
    }

    const orders = steps.map((step) => step.order);
    if (new Set(orders).size !== orders.length) {
      throw new BadRequestException(
        'Recipe steps must have unique order values',
      );
    }
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

  private async resolveRecipeIngredientLines(
    businessId: string,
    ingredients: CreateUpdateRecipeIngredientDto[],
  ) {
    const ingredientIds = ingredients.map((line) => line.ingredientId);
    const records = await this.prisma.ingredient.findMany({
      where: {
        id: { in: ingredientIds },
        businessId,
      },
      include: {
        suppliers: true,
      },
    });

    if (records.length !== ingredientIds.length) {
      throw new BadRequestException(
        'One or more ingredients were not found or do not belong to this business',
      );
    }

    const ingredientById = new Map(
      records.map((record) => [record.id, record]),
    );

    return ingredients.map((line) => {
      const ingredient = ingredientById.get(line.ingredientId);
      if (!ingredient) {
        throw new BadRequestException(
          `Ingredient ${line.ingredientId} was not found for this business`,
        );
      }

      const ingredientSupplierId =
        line.ingredientSupplierId ?? ingredient.calculationSupplierId;

      if (!ingredientSupplierId) {
        throw new BadRequestException(
          `Ingredient "${ingredient.name}" has no calculation supplier configured`,
        );
      }

      const supplier = ingredient.suppliers.find(
        (item) => item.id === ingredientSupplierId,
      );
      if (!supplier) {
        throw new BadRequestException(
          'ingredientSupplierId must belong to the selected ingredient',
        );
      }

      return {
        ingredientId: line.ingredientId,
        ingredientSupplierId,
        quantity: line.quantity,
        pricePerUnit: computeRecipeLineCost(line.quantity, supplier),
        unit: line.unit,
      };
    });
  }

  private ensureValidServings(servings: number) {
    if (!Number.isInteger(servings) || servings < 1) {
      throw new BadRequestException(
        'servings must be an integer of at least 1',
      );
    }
  }

  private ensureValidPricePerServing(pricePerServing: number) {
    if (!(decimalToNumber(pricePerServing) > 0)) {
      throw new BadRequestException('pricePerServing must be greater than 0');
    }
  }

  private ensureValidQuantity(quantity: number) {
    if (!(decimalToNumber(quantity) >= 0)) {
      throw new BadRequestException('quantity must be 0 or greater');
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
