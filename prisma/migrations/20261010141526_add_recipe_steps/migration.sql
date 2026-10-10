-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "steps" JSONB NOT NULL DEFAULT '[]';
