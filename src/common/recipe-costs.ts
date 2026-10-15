import { Prisma } from '../generated/prisma/client.js';
import { computeRecipeLineCost, computeRecipeTotals } from './costing.js';

type RecipeCostDb = Pick<
  Prisma.TransactionClient,
  'recipe' | 'recipeIngredient'
>;

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

  for (const recipe of recipes) {
    const pricedLines = recipe.ingredients.map((line) => ({
      id: line.id,
      pricePerUnit: computeRecipeLineCost(
        line.quantity,
        line.ingredientSupplier,
      ),
    }));

    await Promise.all(
      pricedLines.map((line) =>
        db.recipeIngredient.update({
          where: { id: line.id },
          data: { pricePerUnit: line.pricePerUnit },
        }),
      ),
    );

    const totals = computeRecipeTotals({
      servings: recipe.servings,
      pricePerServing: recipe.pricePerServing,
      lineCosts: pricedLines.map((line) => line.pricePerUnit),
    });

    await db.recipe.update({
      where: { id: recipe.id },
      data: totals,
    });
  }
}
