/*
  Warnings:

  - Added the required column `pricePerUnit` to the `RecipeIngredient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RecipeIngredient" ADD COLUMN     "pricePerUnit" DECIMAL(12,4) NOT NULL;
