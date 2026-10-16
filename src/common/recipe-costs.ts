import { Prisma } from '../generated/prisma/client.js';
import { computeRecipeLineCost, computeRecipeTotals } from './costing.js';

type RecipeCostDb = Pick<
  Prisma.TransactionClient,
  'recipe' | 'recipeIngredient'
>;

/** Recompute stored recipe totals from existing line `pricePerUnit` values. */
export async function recalculateRecipesByIds(
  db: RecipeCostDb,
  recipeIds: string[],
) {
  if (recipeIds.length === 0) {
    return;
  }

  const recipes = await db.recipe.findMany({
    where: { id: { in: recipeIds } },
    select: {
      id: true,
      servings: true,
      pricePerServing: true,
      ingredients: { select: { pricePerUnit: true } },
    },
  });

  await Promise.all(
    recipes.map((recipe) => {
      const totals = computeRecipeTotals({
        servings: recipe.servings,
        pricePerServing: recipe.pricePerServing,
        lineCosts: recipe.ingredients.map((line) => line.pricePerUnit),
      });

      return db.recipe.update({
        where: { id: recipe.id },
        data: totals,
      });
    }),
  );
}

export async function recalculateRecipesForIngredient(
  db: RecipeCostDb,
  ingredientId: string,
) {
  const affected = await db.recipeIngredient.findMany({
    where: { ingredientId },
    select: { recipeId: true },
  });

  const recipeIds = [...new Set(affected.map((row) => row.recipeId))];
  if (recipeIds.length === 0) {
    return;
  }

  const recipes = await db.recipe.findMany({
    where: { id: { in: recipeIds } },
    include: {
      ingredients: {
        include: { ingredientSupplier: true },
      },
    },
  });

  await Promise.all(
    recipes.flatMap((recipe) =>
      recipe.ingredients.map((line) =>
        db.recipeIngredient.update({
          where: { id: line.id },
          data: {
            pricePerUnit: computeRecipeLineCost(
              line.quantity,
              line.ingredientSupplier,
            ),
          },
        }),
      ),
    ),
  );

  await recalculateRecipesByIds(db, recipeIds);
}
