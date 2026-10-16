-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN "calculationSupplierId" TEXT;

-- AlterTable
ALTER TABLE "RecipeIngredient" ADD COLUMN "ingredientSupplierId" TEXT;

-- Backfill default calculation supplier (oldest supplier per ingredient)
UPDATE "Ingredient" i
SET "calculationSupplierId" = s.id
FROM (
    SELECT DISTINCT ON ("ingredientId")
        id,
        "ingredientId"
    FROM "IngredientSupplier"
    ORDER BY "ingredientId", "createdAt" ASC, id ASC
) s
WHERE s."ingredientId" = i.id;

-- Backfill recipe lines to use the ingredient's calculation supplier
UPDATE "RecipeIngredient" ri
SET "ingredientSupplierId" = i."calculationSupplierId"
FROM "Ingredient" i
WHERE ri."ingredientId" = i.id
  AND i."calculationSupplierId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "Ingredient_calculationSupplierId_idx" ON "Ingredient"("calculationSupplierId");

-- CreateIndex
CREATE INDEX "RecipeIngredient_ingredientSupplierId_idx" ON "RecipeIngredient"("ingredientSupplierId");

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_calculationSupplierId_fkey" FOREIGN KEY ("calculationSupplierId") REFERENCES "IngredientSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_ingredientSupplierId_fkey" FOREIGN KEY ("ingredientSupplierId") REFERENCES "IngredientSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RecipeIngredient.ingredientSupplierId required for new rows
ALTER TABLE "RecipeIngredient" ALTER COLUMN "ingredientSupplierId" SET NOT NULL;
