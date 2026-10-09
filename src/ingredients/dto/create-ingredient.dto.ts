import type { Unit } from '../../generated/prisma/client.js';

export class CreateIngredientDto {
  businessId: string;
  categoryId: string;
  name: string;
  supplier: string;
  itemSize: number;
  itemSizeUnit: Unit;
  itemPrice: number;
  usableCostPerItem: number;
}
