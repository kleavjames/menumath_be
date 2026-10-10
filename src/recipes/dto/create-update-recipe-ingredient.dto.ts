import type { Unit } from '../../generated/prisma/client.js';

export class CreateUpdateRecipeIngredientDto {
  ingredientId: string;
  quantity: number;
  pricePerUnit: number;
  unit: Unit;
}
