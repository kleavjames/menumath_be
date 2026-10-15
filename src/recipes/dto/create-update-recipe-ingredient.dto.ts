import type { Unit } from '../../generated/prisma/client.js';

export class CreateUpdateRecipeIngredientDto {
  ingredientId: string;
  /** Which supplier pricing to use; defaults to the ingredient's calculation supplier. */
  ingredientSupplierId?: string;
  quantity: number;
  pricePerUnit: number;
  unit: Unit;
}
