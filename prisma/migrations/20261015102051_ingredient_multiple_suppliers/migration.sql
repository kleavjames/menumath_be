-- CreateTable
CREATE TABLE "IngredientSupplier" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "itemSize" DECIMAL(12,4) NOT NULL,
    "itemSizeUnit" "Unit" NOT NULL,
    "itemPrice" DECIMAL(12,4) NOT NULL,
    "usableCostPerItem" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientSupplier_pkey" PRIMARY KEY ("id")
);

-- Backfill: one supplier row per existing ingredient from legacy columns
INSERT INTO "IngredientSupplier" (
    "id",
    "ingredientId",
    "name",
    "itemSize",
    "itemSizeUnit",
    "itemPrice",
    "usableCostPerItem",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    i."id",
    i."supplier",
    i."itemSize",
    i."itemSizeUnit",
    i."itemPrice",
    i."usableCostPerItem",
    i."createdAt",
    NOW()
FROM "Ingredient" i;

-- CreateIndex
CREATE INDEX "IngredientSupplier_ingredientId_idx" ON "IngredientSupplier"("ingredientId");

-- AddForeignKey
ALTER TABLE "IngredientSupplier" ADD CONSTRAINT "IngredientSupplier_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Ingredient" DROP COLUMN "itemPrice",
DROP COLUMN "itemSize",
DROP COLUMN "itemSizeUnit",
DROP COLUMN "supplier",
DROP COLUMN "usableCostPerItem";
