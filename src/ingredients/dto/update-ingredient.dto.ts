import type { Unit } from '../../generated/prisma/client.js';

export class UpdateIngredientDto {
  categoryId?: string;
  name?: string;
  supplier?: string;
  itemSize?: number;
  itemSizeUnit?: Unit;
  itemPrice?: number;
  usableCostPerItem?: number;
}
