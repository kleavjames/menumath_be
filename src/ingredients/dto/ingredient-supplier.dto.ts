import type { Unit } from '../../generated/prisma/client.js';

export class IngredientSupplierDto {
  name: string;
  itemSize: number;
  itemSizeUnit: Unit;
  itemPrice: number;
  usableCostPerItem: number;
}
